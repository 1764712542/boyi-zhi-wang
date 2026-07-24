/* ============================================
   skills.js — 博弈之王 · 被动技能系统 v4.0
   被动触发 / 主动技能扩展 / 三英B王强化
   依赖：data.js (PASSIVE_TRIGGER, CHARACTERS, THREE_HEROES_BKING)
         engine.js (getLegalAIMoves, getBestMoveFromMoves, makeMv/undoMv)
         game.js (state, speakTaunt, renderAll, etc.)
   ============================================ */
'use strict';

/* 选将技能状态：记录每角色选中的主动 (0|1|2) 与被动 (0|1) */
const skillState = {
  selected: {}       /* {charId: {active: 0, passive: 0}} */
};

/* 被动运行时状态：周期计数器等（与选将选择分离） */
const passiveState = {
  counters: {},      /* {charId: {period: N}} 周期计数 */
  bkingDisabled: 0,  /* 被剥夺被动回合数（仙帝天罚/大爱无疆） */
  immunityUsed: {},  /* 免疫型被动已使用标记 */
  firstTurn: true    /* 首回合标记 */
};

/* 重置被动状态（每局开始）
   v15: 修复误清空 skillState.selected 导致被动选择失效。
   skillState.selected 保存的是选将时的主动/被动选择索引，应跨局保留，
   只清空 passiveState（运行时计数器等）。 */
function resetPassives(){
  /* 注意：不清空 skillState.selected — 保留选将选择 */
  passiveState.counters={};
  passiveState.bkingDisabled=0;
  passiveState.immunityUsed={};
  passiveState.firstTurn=true;
}

/* 获取角色当前选中的被动（三英模式返回两个） */
function getActivePassives(charId){
  const ch=CHARACTERS[charId];
  if(!ch||!ch.passives) return [];
  if(state.gameMode==='three'){  /* v15: 修复字符串不匹配（原 'threeHeroes' 导致三英被动全开失效） */
    /* 三英模式：被动全开 */
    return ch.passives.slice();
  }
  const idx=skillState.selected[charId]?.passive||0;
  return [ch.passives[idx]];
}

/* 获取B王当前生效的被动 */
function getBkingPassives(){
  if(passiveState.bkingDisabled>0) return []; /* 被剥夺 */
  const diff=DIFFICULTIES[state.difficulty];
  let ids=diff.bkingPassives?diff.bkingPassives.slice():['p_aura'];
  if(state.gameMode==='three'){  /* v15: 修复字符串不匹配（原 'threeHeroes' 导致三英被动全开失效） */
    ids=THREE_HEROES_BKING.passives.slice();
  }
  return ids.map(id=>{
    if(id==='p_kingaura') return BKING_EXTRA_PASSIVE;
    /* 在三英的额外被动 */
    const extra=THREE_HEROES_BKING.extraPassives.find(p=>p.id===id);
    if(extra) return extra;
    return CHARACTERS.bking.passives.find(p=>p.id===id);
  }).filter(Boolean);
}

/* ===== 被动触发入口 ===== */

/* 回合开始时：检查所有光环/周期/首回合被动 */
function passivesOnTurnStart(){
  if(passiveState.firstTurn){
    passivesFirstTurn();
    passiveState.firstTurn=false;
  }
  /* AURA 类型被动：每回合开始时应用效果 */
  passivesApplyAuras();
  /* 周期性被动 */
  triggerPeriodicPassives();
  /* B王被动联动：仙帝威压增加B王CD */
  applyBkingPassiveEffects();
}

/* AURA 被动：每回合开始触发当前行动方角色的光环被动 */
function passivesApplyAuras(){
  /* v5.0 多阵营/4v4：触发当前玩家的角色光环 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.color===state.currentPlayer);
    if(mp) applyAurasForChar(mp.char);
    return;
  }
  const myChar=state.character;
  if(myChar) applyAurasForChar(myChar);
}

function applyAurasForChar(charId){
  const ap=getActivePassives(charId);
  ap.forEach(p=>{
    if(p.trigger===PASSIVE_TRIGGER.AURA){
      triggerPassive(charId,p,'aura');
    }
  });
}

/* 首回合被动触发 */
function passivesFirstTurn(){
  /* 己方角色首回合被动 */
  const myChar=state.character;
  if(myChar){
    const ap=getActivePassives(myChar);
    ap.forEach(p=>triggerPassive(myChar,p,'first_turn'));
  }
}

/* 吃子时触发被动 */
/* HP system: ON_CAPTURE should only trigger when a piece is actually KILLED (hp <= 0 and removed).
   doMove only calls this when defender.hp <= 0, but we add a safety check via isPieceKilled(). */
function passivesOnCapture(capturer, captured, fromR, fromC, toR, toC){
  /* capturer 是吃子方的角色 */
  if(!capturer) return;
  /* HP system 安全检查：仅在棋子真正被击杀时触发 */
  if(!isPieceKilled(captured)) return;
  const ap=getActivePassives(capturer);
  ap.forEach(p=>{
    if(p.trigger===PASSIVE_TRIGGER.ON_CAPTURE){
      triggerPassive(capturer,p,'on_capture',{captured,fromR,fromC,toR,toC});
    }
  });
  /* B王被吃时触发反吃被动 (v16: 修复字符串不匹配，原 'threeHeroes' 导致三英反吃失效) */
  if(state.gameMode==='three'&&THREE_HEROES_BKING.revengeChance>0){
    const revP=THREE_HEROES_BKING.extraPassives.find(p=>p.id==='p_revenge');
    if(revP&&Math.random()<THREE_HEROES_BKING.revengeChance){
      /* 30%反吃：找一颗能吃对方子的B王棋子 */
      tryRevengeCapture(captured);
    }
  }
}

/* 被吃时触发被动 */
/* HP system: ON_CAPTURED should only trigger when a piece is actually KILLED (hp <= 0 and removed).
   doMove only calls this when defender.hp <= 0, but we add a safety check via isPieceKilled(). */
function passivesOnCaptured(victim, capturer, capturedPiece){
  if(!victim) return;
  /* HP system 安全检查：仅在棋子真正被击杀时触发 */
  if(!isPieceKilled(capturedPiece)) return;
  const ap=getActivePassives(victim);
  ap.forEach(p=>{
    /* ON_CAPTURED 被动 + IMMUNE 型被动（如 p_shield/p_shameless 的免吃子/免沉默，
       其触发时机与被吃同步，需在此转发才能生效） */
    if(p.trigger===PASSIVE_TRIGGER.ON_CAPTURED || p.trigger===PASSIVE_TRIGGER.IMMUNE){
      triggerPassive(victim,p,'on_captured',{capturer,capturedPiece});
    }
  });
}

/* 周期性被动触发 */
function triggerPeriodicPassives(){
  /* v5.0 多阵营/4v4：触发当前玩家的角色被动 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.color===state.currentPlayer);
    if(mp) triggerPeriodicForChar(mp.char);
    return;
  }
  /* 己方 */
  const myChar=state.character;
  if(myChar) triggerPeriodicForChar(myChar);
  /* B王（三英模式） */
  if(state.gameMode==='three'){  /* v15: 修复字符串不匹配（原 'threeHeroes' 导致三英被动全开失效） */
    const thb=THREE_HEROES_BKING;
    if(thb.comboTurns>0){
      passiveState.counters['bking_combo']=(passiveState.counters['bking_combo']||0)+1;
      if(passiveState.counters['bking_combo']>=thb.comboTurns){
        passiveState.counters['bking_combo']=0;
        state.aiExtraMoves=1;
        speakTaunt('连环双杀！本王再走一步！');
      }
    }
  }
}

function triggerPeriodicForChar(charId){
  const ap=getActivePassives(charId);
  ap.forEach(p=>{
    if(p.trigger!==PASSIVE_TRIGGER.PERIODIC) return;
    passiveState.counters[charId+'_period']=((passiveState.counters[charId+'_period']||0)+1);
    const period=getPassivePeriod(p.id);
    if(period>0&&passiveState.counters[charId+'_period']>=period){
      passiveState.counters[charId+'_period']=0;
      triggerPassive(charId,p,'periodic');
    }
  });
}

/* 被动周期配置 */
function getPassivePeriod(passiveId){
  const map={
    p_joke:3, p_clone:5, p_rhythm:4, p_debug:5, p_samsara:3,
    p_longevity:3, p_leap:3, p_combo:4
  };
  return map[passiveId]||0;
}

/* ===== 被动效果实现 ===== */
function triggerPassive(charId, passive, event, ctx){
  if(!passive) return;
  if(passiveState.bkingDisabled>0 && isBkingPassive(passive.id)) return;
  /* v16: 仙帝审判/逻辑爆破的 oppPassiveDisabled 也会使 B王被动失效（之前只写不读） */
  if(state.oppPassiveDisabled>0 && isBkingPassive(passive.id)) return;
  switch(passive.id){
    /* ===== 侯智博 ===== */
    case 'p_strategy':
      if(event==='first_turn'&&state.gameMode!=='pvp'){
        /* 看穿B王下一步 */
        const mv=getBestMove(state.board,state.aiColor,2);
        if(mv) state.hintMove=mv;
      }
      break;
    case 'p_chain':
      if(event==='on_capture'){
        state.extraMove = (state.extraMove||0) + 1;  /* v15: 修复 playerExtraMove 只写不读，改用 extraMove */
        speakTaunt('连环计！下回合再走一步！');
      }
      break;

    /* ===== 王昕 ===== */
    case 'p_teach':
      /* v16: 光环：仕相防御+15%（每回合刷新 buff） */
      if(event==='aura') addBuffToPlayerPieces(charId, 'defenseBoost', 15, 2, [T.ADVISOR, T.ELEPHANT]);
      break;
    case 'p_joke':
      if(event==='periodic'){
        state.bkingAtkDebuff=2; /* B王攻击-20% 持续2回合 */
        speakTaunt('妙语连珠！B王你这下慌了吧？');
      }
      break;

    /* ===== 周子翰 ===== */
    case 'p_plan':
      if(event==='first_turn'){
        const mv=getBestMove(state.board,state.aiColor,3);
        if(mv) state.routePreview=mv;
      }
      break;
    case 'p_elegant':
      if(event==='on_captured'){
        if(Math.random()<0.3){
          /* 闪避：撤销这次吃子 */
          speakTaunt('风度翩翩！你打不中我！');
          /* 注：实际撤销逻辑需在doMove中处理 */
          state.dodgeNext=true;
        }
      }
      break;

    /* ===== 三金 ===== */
    case 'p_brother':
      /* v16: 光环：己方棋子少于8颗时攻击+30%（绝境狂暴） */
      if(event==='aura'){
        const myColor = myColorForChar(charId);
        if(myColor && countPieces(myColor) < 8){
          addBuffToPlayerPieces(charId, 'attackBoost', 30, 2);
        }
      }
      break;
    case 'p_attack':
      if(event==='on_capture'){
        /* 吃子后复活最近被吃的己方棋子 */
        reviveLastPiece(charId);
        speakTaunt('以攻代守！兄弟复活！');
      }
      break;

    /* ===== 鸡哥 ===== */
    case 'p_dodge':
      if(event==='on_captured'&&Math.random()<0.3){
        state.dodgeNext=true;
        speakTaunt('虚实难辨！你打偏了！');
      }
      break;
    case 'p_clone':
      if(event==='periodic'){
        summonPawn(charId);
        speakTaunt('分身幻象！新的棋子登场！');
      }
      break;

    /* ===== ikun ===== */
    case 'p_rhythm':
      if(event==='periodic'){
        state.extraMove = (state.extraMove||0) + 1;  /* v15: 修复 playerExtraMove 只写不读，改用 extraMove */
        speakTaunt('节奏掌控！跟上我的节奏，再走一步！');
      }
      break;
    case 'p_rebound':
      if(event==='on_captured'){
        state.bkingAtkDebuff=2;
        speakTaunt('全给你！反弹伤害！');
      }
      break;

    /* ===== 胡浩 ===== */
    case 'p_shield':
      if(event==='on_captured'&&!passiveState.immunityUsed['huhao_shield']){
        passiveState.immunityUsed['huhao_shield']=true;
        state.dodgeNext=true;
        speakTaunt('正道护体！本次免疫！');
      }
      break;
    case 'p_unity':
      /* 光环：将受保护（将死需多吃1子） */
      break;

    /* ===== 解宇轩 ===== */
    case 'p_logic':
      if(event==='first_turn'){
        revealStrongestPiece(oppColor());
        speakTaunt('逻辑闭环！已锁定对方最强子！');
      }
      break;
    case 'p_deduce':
      if(event==='on_capture'){
        /* 看穿对方下2步 */
        const route=buildAIRoutePlan(2);
        state.routePreview=route;
        speakTaunt('演绎推理！已看穿对方下2步！');
      }
      break;

    /* ===== 陆星辰 ===== */
    case 'p_debug':
      if(event==='periodic'){
        clearOpponentBuffs();
        speakTaunt('Debug！清除对方增益！');
      }
      break;
    case 'p_refactor':
      if(event==='on_captured'&&Math.random()<0.2){
        reviveLastPiece(charId);
        speakTaunt('重构！代码已修复！');
      }
      break;

    /* ===== 唐昊博涵 ===== */
    case 'p_knowledge':
      if(event==='first_turn'){
        state.routePreview=buildAIRoutePlan(2);
      }
      break;
    case 'p_fullmark':
      /* v16: 光环：己方炮、马攻击+15%（每回合刷新 buff） */
      if(event==='aura') addBuffToPlayerPieces(charId, 'attackBoost', 15, 2, [T.CANNON, T.HORSE]);
      break;

    /* ===== 仙帝Alice ===== */
    case 'p_pressure':
      /* v16: 光环：B王技能CD+1回合，释放概率-15%（每回合刷新标记） */
      if(event==='aura'){
        state.bkingCdIncrease = 1;
        state.bkingSkillChanceReduce = 0.15;
      }
      break;
    case 'p_samsara':
      if(event==='periodic'){
        reviveLastPiece(charId);
        speakTaunt('天道轮回！棋子重生！');
      }
      break;

    /* ===== 大汉棋圣 ===== */
    case 'p_bold':
      /* 免疫沉默/禁锢 */
      break;
    case 'p_flipgod':
      if(event==='on_capture'){
        state.skillCdReduce=1;
        speakTaunt('掀桌之神！技能加速！');
      }
      break;

    /* ===== 刘雪沛 ===== */
    case 'p_insight':
      /* 光环：看穿B王CD与下步 */
      if(state.gameMode!=='pvp'){
        const mv=getBestMove(state.board,state.aiColor,2);
        if(mv) state.hintMove=mv;
      }
      break;
    case 'p_nemesis':
      /* v16: 光环：对B王伤害+50% — 己方全体攻击时伤害加成（仅对B王棋子） */
      if(event==='aura') addBuffToPlayerPieces(charId, 'bkiller', 0.5, 2);
      break;

    /* ===== 刘佳伟 ===== */
    case 'p_stable':
      /* v16: 光环：己方将防御+20%（每回合刷新 buff） */
      if(event==='aura') addBuffToPlayerPieces(charId, 'defenseBoost', 20, 2, [T.KING]);
      break;
    case 'p_revenge':
      if(event==='on_captured'){
        revengeCapture(charId, ctx&&ctx.capturedPiece);
      }
      break;

    /* ===== 袁清山 ===== */
    case 'p_hide':
      /* v19: 改用 buff 系统使免疫生效（原 state.immuneFirstTurn 只写不读） */
      if(event==='first_turn'){
        const mc = state.gameMode==='pvp' ? state.currentPlayer : state.playerColor;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc) addBuff(p, 'immune', 1, 1);
        }
        speakTaunt('隐忍！首回合免疫所有伤害！','self');
      }
      break;
    case 'p_leap':
      if(event==='periodic'){
        // HP system: this boost increases piece atk during damage calculation in doMove
        state.attackBoost=2;
        speakTaunt('龙跃！攻击大幅提升！');
      }
      break;

    /* ===== 罗伦杰 ===== (v15: 修复 case 'p_chain' 重复定义，改为 p_chainatk) */
    case 'p_chainatk':
      if(event==='on_capture'){
        // HP system: this boost increases piece atk during damage calculation in doMove
        state.attackBoost=(state.attackBoost||0)+1;
        speakTaunt('连击！攻击提升！');
      }
      break;
    case 'p_break':
      /* v16: 光环：攻击无视对方防御增益（破防）— 己方全体攻击穿透 */
      if(event==='aura') addBuffToPlayerPieces(charId, 'pierce', 1, 2);
      break;

    /* ===== 大爱仙尊（古月方源 · 冷漠无情型） ===== */
    case 'p_ironheart':
      /* IMMUNE：首回合己方全体免疫所有伤害（铁石心肠，冷漠无情） */
      if(event==='first_turn'){
        const mc = state.gameMode==='pvp' ? state.currentPlayer : state.playerColor;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc) addBuff(p, 'immune', 1, 1);
        }
        speakTaunt('铁石心肠...首回合，万法不侵。','self');
      }
      break;
    case 'p_gumaster':
      /* ON_CAPTURED：己方棋子被吃时，己方全体回血25 + 方源叠攻击buff（蛊师本能） */
      if(event==='on_captured'){
        passiveState.counters[charId+'_gumaster']=(passiveState.counters[charId+'_gumaster']||0)+1;
        const stacks=Math.min(3, passiveState.counters[charId+'_gumaster']);
        const mc = state.gameMode==='pvp' ? state.currentPlayer : state.playerColor;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && p.maxHp){
            p.hp=Math.min(p.maxHp, p.hp+25);
          }
        }
        /* 方源（核心将）获得攻击强化，可叠加3层 */
        const king=findKing(state.board, mc);
        if(king){
          addBuff(state.board[king.row][king.col], 'attackBoost', 10, 2);
        }
        speakTaunt('蛊师本能...残值，也要榨干。','self');
      }
      break;

    /* ===== B王被动 ===== */
    case 'p_aura':
      /* v16: 光环：对手攻击-10% — 通过给对方全体加 weakness 实现 */
      if(event==='aura' && state.gameMode!=='pvp'){
        const oppColor = state.aiColor===BLACK ? RED : BLACK;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===oppColor) addBuff(p, 'weakness', 0.1, 2);
        }
      }
      break;
    case 'p_shameless':
      if(event==='on_captured'&&!passiveState.immunityUsed['bking_shameless']){
        passiveState.immunityUsed['bking_shameless']=true;
        state.dodgeNext=true;
        speakTaunt('厚颜无耻！本次沉默无效！');
      }
      break;
    case 'p_kingaura':
      /* v16: 光环：CD-1，释放概率+10%（每回合刷新标记） */
      if(event==='aura'){
        state.bkingCdIncrease = -(1); /* 负值表示 CD 减少 */
        state.bkingSkillChanceReduce = -(0.10); /* 负值表示概率增加 */
      }
      break;
    case 'p_combo':
      /* 三英：周期双杀（在triggerPeriodicPassives处理） */
      break;
    case 'p_revenge':
      /* 三英：反吃（在passivesOnCapture处理） */
      break;
  }
}

/* ===== 辅助函数 ===== */

/* v16: 给指定角色的指定类型棋子加 buff（光环被动使用）
   pieceTypes: 棋子类型数组（如 [T.ADVISOR, T.ELEPHANT]），null 表示全体 */
function addBuffToPlayerPieces(charId, type, value, duration, pieceTypes){
  const myColor = myColorForChar(charId);
  if(!myColor) return;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = state.board[r][c];
    if(p && p.player===myColor && (!pieceTypes || pieceTypes.indexOf(p.type)>=0)){
      addBuff(p, type, value, duration);
    }
  }
}

/* HP system: 判断棋子是否真正被击杀（仅当进入阵亡名单时才算死亡）。
   在 HP 系统中，棋子被攻击时只会扣血，只有 hp<=0 才会被移入
   state.redCaptured / state.blackCaptured。因此通过检查这两个数组
   来判断棋子是否真正死亡，避免在双方均存活的伤害交互中误触发
   ON_CAPTURE / ON_CAPTURED 被动。 */
function isPieceKilled(capturedPiece){
  if(!capturedPiece) return false;
  const inRed = state.redCaptured && state.redCaptured.indexOf(capturedPiece) !== -1;
  const inBlack = state.blackCaptured && state.blackCaptured.indexOf(capturedPiece) !== -1;
  return inRed || inBlack;
}

function isBkingPassive(passiveId){
  return ['p_aura','p_shameless','p_kingaura','p_combo','p_revenge'].includes(passiveId);
}

/* 复活最近被吃的己方棋子 */
/* HP system: 复活时将 hp 重置为 maxHp，保证复活后的棋子满血参战
   v16: 注入角色属性加成（charAtk/charDef/charInt），避免复活后失去角色 buff */
function reviveLastPiece(charId){
  const ch=CHARACTERS[charId];
  if(!ch) return;
  const myColor=myColorForChar(charId);
  const captured=myColor===RED?state.redCaptured:state.blackCaptured;
  if(captured.length===0) return;
  const piece=captured.pop();
  const pieceType=piece.type||piece;
  const pieceHp=piece.maxHp||PIECE_STATS[pieceType].hp;
  /* 角色属性加成（与 createInitialBoard 一致） */
  const bonus = getCharBonus(charId);
  /* 找空位（优先本方半区） */
  for(let r=(myColor===RED?5:0); r<(myColor===RED?10:5); r++){
    for(let c=0;c<COLS;c++){
      if(!state.board[r][c]){
        const s=PIECE_STATS[pieceType];
        state.board[r][c]={
          type:pieceType, player:myColor,
          hp:pieceHp, maxHp:pieceHp,
          atk:s.atk, def:s.def, ptype:s.type,
          charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt
        };
        return;
      }
    }
  }
}

/* 召唤兵到空位 */
/* HP system: 召唤的兵也需具备完整的战斗属性
   v16: 注入角色属性加成 */
function summonPawn(charId){
  const myColor=myColorForChar(charId);
  const bonus = getCharBonus(charId);
  for(let r=(myColor===RED?5:0); r<(myColor===RED?10:5); r++){
    for(let c=0;c<COLS;c++){
      if(!state.board[r][c]){
        const s=PIECE_STATS[T.PAWN];
        state.board[r][c]={
          type:T.PAWN, player:myColor,
          hp:s.hp, maxHp:s.hp, atk:s.atk, def:s.def, ptype:s.type,
          charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt
        };
        return;
      }
    }
  }
}

/* 揭示对方最强子 */
function revealStrongestPiece(oppColor){
  let best=null;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(p&&p.player===oppColor&&p.type!==T.KING){
      if(!best||PIECE_VALUE[p.type]>PIECE_VALUE[best.p.type]) best={r,c,p};
    }
  }
  if(best) state.revealedPiece=best;
}

/* 清除对方增益 */
function clearOpponentBuffs(){
  state.bkingAtkDebuff=0;
  state.playerCannotCapture=false;
  state.playerConfusedMove=null;
  speakTaunt('Debug完毕，对方增益已清除！');
}

/* 退步反击：反吃对方价值相当的子 */
function revengeCapture(charId, capturedPiece){
  if(!capturedPiece) return;
  const myColor=myColorForChar(charId);
  const oc=myColor===RED?BLACK:RED;
  const targetValue=capturedPiece.type?PIECE_VALUE[capturedPiece.type]:100;
  /* 找对方价值相当的子并吃掉 */
  let best=null;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(p&&p.player===oc&&p.type!==T.KING){
      const v=PIECE_VALUE[p.type];
      if(!best||Math.abs(v-targetValue)<Math.abs(PIECE_VALUE[best.p.type]-targetValue)) best={r,c,p};
    }
  }
  if(best){
    state.board[best.r][best.c]=null;
    if(oc===RED) state.redCaptured.push(best.p); else state.blackCaptured.push(best.p);
    speakTaunt('退步反击！反吃对方一子！');
    renderAll();
  }
}

/* B王反吃（三英模式） */
function tryRevengeCapture(captured){
  const ai=state.aiColor;
  const mc=state.playerColor;
  /* 找一颗能吃对方子的B王棋子 */
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(p&&p.player===ai){
      const ms=getPieceMoves(state.board,r,c);
      const cap=ms.find(m=>state.board[m.row]&&state.board[m.row][m.col]&&state.board[m.row][m.col].player===mc);
      if(cap){
        const target=state.board[cap.row][cap.col];
        state.board[cap.row][cap.col]=p;
        state.board[r][c]=null;
        if(target.player===RED) state.redCaptured.push(target); else state.blackCaptured.push(target);
        speakTaunt('天命所归！本王反吃一子！');
        renderAll();
        return;
      }
    }
  }
}

/* B王被动效果应用（光环） */
function applyBkingPassiveEffects(){
  /* v5.0 多阵营/4v4：无 B王，无需应用 B王被动联动 */
  if(state.gameMode==='faction'||state.gameMode==='4v4') return;
  /* 仙帝威压：B王CD+1，释放概率-15% */
  const myChar=state.character;
  if(myChar){
    const ap=getActivePassives(myChar);
    if(ap.some(p=>p.id==='p_pressure')){
      state.bkingCdIncrease=1;
      state.bkingSkillChanceReduce=0.15;
    }
  }
}

/* 颜色 → 角色 ID（myColorForChar 的反向映射，供战斗修饰查被动用） */
function charForColor(color){
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.color===color);
    return mp?mp.char:null;
  }
  if(state.gameMode==='pvp'){
    return color===RED?state.pvpRedChar:(color===BLACK?state.pvpBlackChar:state.character);
  }
  /* PVE：玩家=playerColor，AI/B王=aiColor */
  return color===state.playerColor?state.character:'bking';
}

/* 统计某方棋盘上的棋子数量（用于 p_brother 绝境狂暴判定） */
function countPieces(color){
  let n=0;
  if(!state.board) return 0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(p&&p.player===color) n++;
  }
  return n;
}

/* 将被动战斗修饰应用到伤害结果（在 doMove 的 calcDamage 之后调用）。
   读取 state.attackBoost / state.bkingAtkDebuff / 各方 AURA 被动，
   直接修改 dmg.defenderDmg，并消耗一次性加成。
   engine.js 的 calcDamage 保持纯逻辑，所有 state 相关修饰集中于此。 */
function applyPassiveCombatMods(attacker, defender, dmg){
  if(!attacker||!defender||!dmg) return dmg;
  const aChar=charForColor(attacker.player);
  const dChar=charForColor(defender.player);
  const aIsPlayer = attacker.player===state.playerColor;
  const aIsBking  = attacker.player===state.aiColor;
  let mul=1;

  /* attackBoost：玩家方攻击加成（p_leap 设为2层=+40%，p_chain 每层+20%），一次性消耗 */
  if(aIsPlayer && state.attackBoost>0){
    mul *= (1 + 0.2*state.attackBoost);
    state.attackBoost=0;
  }
  /* bkingAtkDebuff：B王攻击削弱（p_joke/p_rebound，-20%），每次B王进攻消耗1层 */
  if(aIsBking && state.bkingAtkDebuff>0){
    mul *= 0.8;
    state.bkingAtkDebuff=Math.max(0, state.bkingAtkDebuff-1);
  }

  /* AURA 被动战斗修饰 */
  const aPassives = aChar ? getActivePassives(aChar) : [];
  const dPassives = dChar ? getActivePassives(dChar) : [];

  /* p_aura：B王光环 → 对手（玩家）攻击-10% */
  if(aIsPlayer){
    const bp=getBkingPassives();
    if(bp.some(p=>p.id==='p_aura')) mul *= 0.9;
  }
  /* p_teach：王昕 → 己方仕/相减伤15% */
  if(dPassives.some(p=>p.id==='p_teach') && (defender.type===T.ADVISOR||defender.type===T.ELEPHANT)){
    mul *= 0.85;
  }
  /* p_fullmark：唐昊博涵 → 己方炮/马攻击+15% */
  if(aPassives.some(p=>p.id==='p_fullmark') && (attacker.type===T.CANNON||attacker.type===T.HORSE)){
    mul *= 1.15;
  }
  /* p_stable：刘佳伟 → 己方将减伤20% */
  if(dPassives.some(p=>p.id==='p_stable') && defender.type===T.KING){
    mul *= 0.8;
  }
  /* p_brother：三金 → 己方棋子<8时攻击+30%（绝境狂暴） */
  if(aPassives.some(p=>p.id==='p_brother') && countPieces(attacker.player)<8){
    mul *= 1.3;
  }
  /* p_nemesis：刘雪沛 → 对B王伤害+50% */
  if(aPassives.some(p=>p.id==='p_nemesis') && dChar==='bking'){
    mul *= 1.5;
  }

  dmg.defenderDmg = Math.max(1, Math.floor(dmg.defenderDmg * mul));
  return dmg;
}

/* 根据角色ID获取其颜色 */
function myColorForChar(charId){
  if(state.gameMode==='pvp'){
    return state.pvpRedChar===charId?RED:(state.pvpBlackChar===charId?BLACK:state.playerColor);
  }
  /* v5.0 多阵营/4v4：按 multiPlayers 找该角色对应的颜色 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.char===charId);
    if(mp) return mp.color;
    /* 回退：玩家角色 = playerColor */
    if(charId===state.character) return state.playerColor;
  }
  /* PVE：玩家角色=playerColor */
  if(charId===state.character) return state.playerColor;
  /* B王/AI = aiColor */
  return state.aiColor;
}

/* v5.0 阵营被动联动：返回该阵营所有角色的被动列表（光环叠加）
   faction: 阵营 key (bking/immortal/strategist/brother/hermit)
   返回 [{char, passive}, ...]，仅包含该阵营所有成员的选中被动 */
function getFactionPassives(faction){
  const f=FORMATIONS[faction];
  if(!f||!f.members) return [];
  const result=[];
  f.members.forEach(charId=>{
    const ch=CHARACTERS[charId];
    if(!ch||!ch.passives) return;
    const idx=skillState.selected[charId]?.passive||0;
    const p=ch.passives[idx];
    if(p) result.push({char:charId, passive:p});
  });
  return result;
}

/* v5.0 多阵营：返回指定颜色阵营所有角色光环被动的聚合效果
   用于在多阵营模式下叠加多个角色的光环被动 */
function getActiveFactionAuras(color){
  const mp=state.multiPlayers.find(p=>p.color===color);
  if(!mp||!mp.faction) return [];
  const all=getFactionPassives(mp.faction);
  /* 仅返回光环类被动 */
  return all.filter(item=>item.passive.trigger===PASSIVE_TRIGGER.AURA);
}
