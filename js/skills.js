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
  immunityUsed: {},  /* 免疫型被动已使用标记（p_shield 等） */
  immunityCount: {}, /* v23 P0-8: p_shameless 每局2次计数器 */
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
  passiveState.immunityCount={}; /* v23 P0-8: p_shameless 每局2次计数器 */
  passiveState.firstTurn=true;
  /* v22 修复 Bug 8（被动技能）：重置 p_pressure PVP 播报标记 */
  passiveState.pressureAnnounced=false;
  /* v22 修复 Bug 3（被动技能）：insightAnnounced 标记需重置，否则第二局起无播报 */
  passiveState.insightAnnounced=false;
  /* v10：重置帝国元首/布罗利新被动状态 */
  passiveState.disciplineAnnounced=false;
  passiveState.overchargeStacks=0;
  passiveState._legendUsed=false;
  /* v10：重置 p_reich / p_bking_confuse / p_bking_insight 状态 */
  passiveState.reichAnnounced=false;
  passiveState._confuseUsed=false;
  passiveState.insightStacks=0;
  /* v32-fix P1: 跨局残留清理 — 以下字段原本只写不重置，
     第二局起会导致首回合跳过播报或叠加层数异常 */
  passiveState.greedyStacks = 0;          /* p_greedy 攻击加成层数 */
  passiveState.introvertedAnnounced = false; /* p_introverted 内敛气场播报标记 */
  passiveState.steadyAuraAnnounced = false;  /* p_steady_aura 稳健气场播报标记 */
}

/* 获取角色当前选中的被动（三英模式返回两个）
   v33-fix P2: 合并 envy 偷取的被动
   v34: 通天教主支持5选2 — passive 字段可以是数字（单选）或数组（多选）*/
function getActivePassives(charId){
  const ch=CHARACTERS[charId];
  if(!ch||!ch.passives) return [];
  let result;
  if(state.gameMode==='three'){
    /* 三英模式：被动全开 */
    result = ch.passives.slice();
  } else {
    const sel=skillState.selected[charId]?.passive;
    /* v34: 通天教主5选2 — passive 为数组时返回多个 */
    if(Array.isArray(sel)){
      result = sel.map(i => ch.passives[i]).filter(Boolean);
    } else {
      const idx = sel||0;
      result = [ch.passives[idx]];
    }
  }
  /* v33-fix P2: 合并 envy 偷的被动（仅当当前角色是 bking 且有偷取记录） */
  if(charId==='bking' && state.envyStolenPassives && state.envyStolenPassives.length>0){
    const bkingColor = (state.gameMode==='pvp'||state.gameMode==='online')
      ? (state.pvpRedChar==='bking' ? RED : (state.pvpBlackChar==='bking' ? BLACK : null))
      : state.aiColor;
    if(bkingColor){
      const stolen = state.envyStolenPassives
        .filter(e => e.stolenFrom !== bkingColor)
        .map(e => {
          const victimCharId = (state.gameMode==='pvp'||state.gameMode==='online')
            ? (bkingColor===RED ? state.pvpBlackChar : state.pvpRedChar)
            : state.character;
          const victimChar = victimCharId && CHARACTERS[victimCharId] ? CHARACTERS[victimCharId] : null;
          return victimChar && victimChar.passives ? victimChar.passives.find(p => p.id === e.id) : null;
        })
        .filter(Boolean);
      result = result.concat(stolen);
    }
  }
  return result;
}

/* 获取B王当前生效的被动 */
function getBkingPassives(){
  if(passiveState.bkingDisabled>0) return []; /* 被剥夺 */
  const diff=DIFFICULTIES[state.difficulty];
  let ids=diff.bkingPassives?diff.bkingPassives.slice():['p_aura'];
  /* v28: 故事模式 — 从 BKING_LAYERS 读取可用被动列表（按章节难度递增） */
  if(state.storyChapterId && state.bkingLayer && typeof BKING_LAYERS!=='undefined'){
    const layer=BKING_LAYERS[state.bkingLayer];
    if(layer && layer.passives) ids=layer.passives.slice();
  }
  if(state.gameMode==='three'){  /* v15: 修复字符串不匹配（原 'threeHeroes' 导致三英被动全开失效） */
    ids=THREE_HEROES_BKING.passives.slice();
  }
  let passives = ids.map(id=>{
    if(id==='p_kingaura') return BKING_EXTRA_PASSIVE;
    /* 在三英的额外被动 */
    const extra=THREE_HEROES_BKING.extraPassives.find(p=>p.id===id);
    if(extra) return extra;
    return CHARACTERS.bking.passives.find(p=>p.id===id);
  }).filter(Boolean);
  /* v31-fix P1: envy 复制的被动 — 原 state.envyStolenPassives 只写不读，
     复制对方被动给己方这部分完全未实现。现从此处读取并合并。 */
  if(state.envyStolenPassives && state.envyStolenPassives.length>0){
    /* 仅取偷自玩家的被动（B王偷的，stolenFrom===RED 表示原属红方） */
    const stolen = state.envyStolenPassives
      .filter(e => e.stolenFrom===state.playerColor)
      .map(e => {
        /* 从玩家所选角色的 passives 列表中查找对应被动 */
        const playerChar = CHARACTERS[state.character];
        if(playerChar && playerChar.passives){
          return playerChar.passives.find(p => p.id === e.id);
        }
        return null;
      })
      .filter(Boolean);
    passives = passives.concat(stolen);
  }
  return passives;
}

/* ===== 被动触发入口 ===== */

/* 回合开始时：检查所有光环/周期/首回合被动
   v22 修复：首回合被动在 startNewGame 末尾预先触发一次（不再依赖 advanceToNextPlayer 后的 passivesOnTurnStart），
   避免 p_strategy/p_plan/p_logic/p_knowledge/p_insight/p_hide/p_ironheart 等"首回合"效果延迟到玩家走完第一步后才生效。
   v22 修复 Bug 5（被动技能）：每回合开始时先重置 bkingCdIncrease/bkingSkillChanceReduce 为 0，
   再由 p_pressure/p_kingaura 累加，避免互相覆盖。 */
function passivesOnTurnStart(){
  /* v22: 先重置 B王 CD 调整标记，由各方光环被动累加 */
  state.bkingCdIncrease = 0;
  state.bkingSkillChanceReduce = 0;
  /* AURA 类型被动：每回合开始时应用效果 */
  passivesApplyAuras();
  /* 周期性被动 */
  triggerPeriodicPassives();
  /* B王被动联动：仙帝威压增加B王CD */
  applyBkingPassiveEffects();
  /* v22 修复 Bug 6：刘佳伟·后发制人 counter — 3回合内每回合给对方叠加 weakness。
     原 addTeamBuff weakness 0.1 3回合因 addBuff 取 max 恒 -10% 不叠加。
     现改为每回合（对方回合开始）重新施加 weakness（stacks*0.15）1回合，实现累积叠加。
     v10 弱角色增强：每回合 weakness 0.1→0.15（-15%/-30%/-45%）。 */
  if(state.counterActiveTurns>0){
    const skillOwner = state.skillOwnerColor || state.playerColor;
    const skillOpp = skillOwner===RED?BLACK:RED;
    if(state.currentPlayer===skillOpp){
      state.counterStacks = (state.counterStacks||0) + 1;
      addTeamBuff(state.board, skillOpp, 'weakness', state.counterStacks*0.15, 1);
      state.counterActiveTurns--;
      if(state.counterActiveTurns<=0) state.counterStacks=0;
    }
  }
  /* v10 新增：帅的指挥光环 — 相邻己方单位获得 defenseBoost（+10 防御，1回合，光环） */
  applyKingCommandAura();
  /* v23 修复 P0-1：分发 TURN_START 被动（原 passivesOnTurnStart 只触发 AURA/PERIODIC，
     导致 p_bking_insight (TURN_START) 永远不生效）。 */
  passivesOnTurnStartTrigger();
  /* v30-fix: 处理 envy 复制的被动 — 递减剩余回合数，归零时移除
     原 state.envyStolenPassives 只写不读，复制效果未实现。
     现每回合递减 remainingTurns，归零时移除条目（对方被动恢复）。 */
  if(state.envyStolenPassives && state.envyStolenPassives.length>0){
    for(let i=state.envyStolenPassives.length-1; i>=0; i--){
      const entry = state.envyStolenPassives[i];
      /* 仅在偷取方的回合开始时递减（避免双方回合都递减导致持续时间减半） */
      const stealerColor = entry.stolenFrom===RED ? BLACK : RED;
      if(state.currentPlayer === stealerColor){
        entry.remainingTurns--;
        if(entry.remainingTurns <= 0){
          state.envyStolenPassives.splice(i, 1);
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>嫉妒·东施效颦</b> 复制的被动效果消失，对方被动恢复');
        }
      }
    }
  }
}

/* v23 P0-1：分发 TURN_START 被动
   按 currentPlayer 识别当前行动方角色，触发其 TURN_START 被动。
   - PVE/三英：玩家方用 state.character，B王方用 getBkingPassives() 取难度被动
   - PVP/联机/多阵营：按当前行动方颜色反查角色 */
function passivesOnTurnStartTrigger(){
  /* 多阵营/4v4：按 multiPlayers 反查 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.color===state.currentPlayer);
    if(!mp||!mp.char) return;
    const ap=getActivePassives(mp.char);
    ap.forEach(p=>{
      if(p.trigger===PASSIVE_TRIGGER.TURN_START) triggerPassive(mp.char, p, 'turn_start');
    });
    return;
  }
  /* PVP/联机：按当前行动方颜色反查角色 */
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    const curChar=charForColor(state.currentPlayer);
    if(!curChar) return;
    const ap=getActivePassives(curChar);
    ap.forEach(p=>{
      if(p.trigger===PASSIVE_TRIGGER.TURN_START) triggerPassive(curChar, p, 'turn_start');
    });
    return;
  }
  /* PVE/三英：玩家方走时触发玩家角色，B王走时触发 B王难度被动 */
  if(state.currentPlayer===state.playerColor){
    if(!state.character) return;
    const ap=getActivePassives(state.character);
    ap.forEach(p=>{
      if(p.trigger===PASSIVE_TRIGGER.TURN_START) triggerPassive(state.character, p, 'turn_start');
    });
  } else if(state.currentPlayer===state.aiColor){
    /* B王被动来自 DIFFICULTIES[diff].bkingPassives，必须用 getBkingPassives() 而非 getActivePassives('bking') */
    const bkPassives=getBkingPassives();
    bkPassives.forEach(p=>{
      if(p.trigger===PASSIVE_TRIGGER.TURN_START) triggerPassive('bking', p, 'turn_start');
    });
  }
}

/* v10: 帅的指挥光环 — 帅/将作为棋子固有被动
   每回合开始时，给帅的相邻己方单位施加 defenseBoost 光环 buff（+10 防御，1回合）。
   说明：帅不是角色（无 charId），故不通过 triggerPassive 触发，而是在 passivesOnTurnStart 中直接处理。
   _aura 标记的 buff 由 addBuff 续期合并，下回合重新施加时刷新。 */
function applyKingCommandAura(){
  if(!state.board) return;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = state.board[r][c];
    if(p && p.type === T.KING){
      /* 指挥光环：相邻己方单位 defenseBoost +10 / attackBoost +10（1回合） */
      for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){
        if(dr===0 && dc===0) continue;
        const nr = r+dr, nc = c+dc;
        if(nr>=0 && nr<ROWS && nc>=0 && nc<COLS){
          const adj = state.board[nr][nc];
          if(adj && adj.player === p.player){
            addBuff(adj, 'defenseBoost', 10, 1, true);
            addBuff(adj, 'attackBoost', 10, 1, true);
          }
        }
      }
      /* 核心守护：帅存活时，己方全体每回合回 maxHp×3% */
      for(let rr=0; rr<ROWS; rr++) for(let cc=0; cc<COLS; cc++){
        const ally = state.board[rr][cc];
        if(ally && ally.player === p.player){
          const heal = Math.floor((ally.maxHp || 0) * 0.03);
          if(heal > 0 && ally.hp < ally.maxHp){
            ally.hp = Math.min(ally.maxHp, ally.hp + heal);
          }
        }
      }
    }
  }
}

/* v22: 首回合被动单独入口，由 startNewGame 在初始化棋盘后立即触发一次 */
function passivesTriggerFirstTurn(){
  if(!passiveState.firstTurn) return;
  passivesFirstTurn();
  passiveState.firstTurn=false;
}

/* AURA 被动：每回合开始触发当前行动方角色的光环被动
   v22 修复 Bug 1/2：原逻辑只触发 state.character（玩家角色）的光环，
   永远不触发 B王/PVP 对手的光环，导致 B王 p_aura/p_kingaura、PVP 黑方角色光环全失效。
   现按 currentPlayer 触发对应角色的光环。 */
function passivesApplyAuras(){
  /* v5.0 多阵营/4v4：触发当前玩家的角色光环 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.color===state.currentPlayer);
    if(mp) applyAurasForChar(mp.char);
    return;
  }
  /* v22: PVP/联机模式按当前行动方触发各自角色光环 */
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    const curChar=charForColor(state.currentPlayer);
    if(curChar) applyAurasForChar(curChar);
    return;
  }
  /* v22: PVE/三英模式 — 玩家走时触发玩家光环；B王走时触发B王光环（原逻辑漏掉B王） */
  if(state.currentPlayer===state.playerColor){
    if(state.character) applyAurasForChar(state.character);
  } else if(state.currentPlayer===state.aiColor){
    /* B王光环（p_aura / p_kingaura） */
    const bkPassives=getBkingPassives();
    bkPassives.forEach(p=>{
      if(p.trigger===PASSIVE_TRIGGER.AURA) triggerPassive('bking', p, 'aura');
    });
  }
}

function applyAurasForChar(charId){
  const ap=getActivePassives(charId);
  ap.forEach(p=>{
    if(p.trigger===PASSIVE_TRIGGER.AURA){
      triggerPassive(charId,p,'aura');
    }
  });
}

/* 首回合被动触发
   v22 修复 Bug 12（被动技能）：原仅触发 state.character（PVE/三英当前武将/PVP红方），
   PVP 黑方角色的 first_turn 被动全失效。现 PVP 下对双方角色都触发。 */
function passivesFirstTurn(){
  /* PVE/三英：仅触发玩家角色 */
  if(state.gameMode!=='pvp' && state.gameMode!=='online'){
    const myChar=state.character;
    if(myChar){
      const ap=getActivePassives(myChar);
      ap.forEach(p=>triggerPassive(myChar,p,'first_turn'));
    }
    return;
  }
  /* PVP/联机：对双方角色都触发首回合被动 */
  const chars=[state.pvpRedChar, state.pvpBlackChar].filter(Boolean);
  for(const ch of chars){
    const ap=getActivePassives(ch);
    ap.forEach(p=>triggerPassive(ch,p,'first_turn'));
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
function passivesOnCaptured(victim, capturer, capturedPiece, attackerPiece){
  if(!victim) return;
  /* HP system 安全检查：仅在棋子真正被击杀时触发 */
  if(!isPieceKilled(capturedPiece)) return;
  const ap=getActivePassives(victim);
  ap.forEach(p=>{
    /* ON_CAPTURED 被动 + IMMUNE 型被动（如 p_shield 的免吃子，
       其触发时机与被吃同步，需在此转发才能生效）。
       v22 修复 Bug 3：闪避类被动 (p_dodge/p_elegant/p_shield) 已由 tryDodgePassive
       在 calcDamage 之前预检处理，此处不再触发，避免双重设 dodgeNext。 */
    if(p.trigger===PASSIVE_TRIGGER.ON_CAPTURED || p.trigger===PASSIVE_TRIGGER.IMMUNE){
      /* 跳过闪避/免疫类（已由 tryDodgePassive 在 calcDamage 之前预检处理）*/
      if(p.id==='p_dodge' || p.id==='p_elegant' || p.id==='p_shield' || p.id==='p_wanxian_guard') return;
      triggerPassive(victim,p,'on_captured',{capturer,capturedPiece,attackerPiece});
    }
  });
}

/* v22 修复 Bug 3：闪避被动在 calcDamage 之前预检
   原 p_dodge/p_elegant/p_shield 在 on_captured 中设 state.dodgeNext，
   但 on_captured 在 calcDamage 与伤害结算之后才触发，导致：
   - 守方已掉血/已阵亡，闪避无效
   - dodgeNext 只对"下一次"攻击生效，违背被动设计意图
   现在改为：在 doMove 调用 calcDamage 之前预检，若闪避触发则直接取消本次攻击。
   返回 true 表示闪避成功（攻击落空），false 表示正常进行伤害结算。 */
function tryDodgePassive(defender, attacker){
  if(!defender) return false;
  /* 查找守方角色 ID */
  let victimChar = null;
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const vicMp=state.multiPlayers.find(p=>p.color===defender.player);
    victimChar = vicMp ? vicMp.char : null;
  } else if(state.gameMode==='pvp'||state.gameMode==='online'){
    victimChar = defender.player===RED ? state.pvpRedChar : state.pvpBlackChar;
  } else {
    /* PVE/三英：玩家方 = state.character，B王方 = 'bking' */
    victimChar = defender.player===state.playerColor ? state.character : 'bking';
  }
  if(!victimChar) return false;
  const ap=getActivePassives(victimChar);
  for(const p of ap){
    if(p.id==='p_dodge' && Math.random()<0.3){
      speakTaunt('虚实难辨！你打偏了！');
      /* v22: 战报 — 闪避触发 */
      if(typeof addBattleLog==='function') addBattleLog('state', `<b>虚实难辨</b> 闪避触发！攻击落空`);
      return true;
    }
    if(p.id==='p_elegant' && Math.random()<0.3){
      speakTaunt('风度翩翩！你打不中我！');
      /* v22: 战报 — 闪避触发 */
      if(typeof addBattleLog==='function') addBattleLog('state', `<b>风度翩翩</b> 闪避触发！攻击落空`);
      return true;
    }
    /* p_shield：每局1次免疫（消耗 immunityUsed 标记） */
    if(p.id==='p_shield' && !passiveState.immunityUsed['huhao_shield']){
      passiveState.immunityUsed['huhao_shield']=true;
      speakTaunt('正道护体！本次免疫！','self');
      /* v22: 战报 — 免疫触发 */
      if(typeof addBattleLog==='function') addBattleLog('state', `<b>正道护体</b> 免疫触发！本次伤害无效`);
      return true;
    }
    /* v34: 通天教主·万仙护体 — 每局1次，帅/将被攻击且血<30%时免疫+反伤200真伤 */
    if(p.id==='p_wanxian_guard' && !passiveState.immunityUsed['tongtian_wanxian_guard']
       && defender.type===T.KING && defender.hp < (defender.maxHp||1)*0.3){
      passiveState.immunityUsed['tongtian_wanxian_guard']=true;
      speakTaunt('万仙护体！因果逆转！','self');
      if(typeof addBattleLog==='function') addBattleLog('state', `<b>万仙护体</b> 免疫触发！帅/将免于阵亡，反伤攻击方 120 真实伤害`);
      /* 反伤 120 真实伤害（无视防御）（v36: 200→120，避免秒杀大部分棋子）*/
      if(attacker && attacker.hp!==undefined){
        attacker.hp = Math.max(0, attacker.hp - 120);
        if(attacker.hp<=0){
          /* 攻击方被反伤击杀 — 清理棋盘 */
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            if(state.board[r][c]===attacker){ state.board[r][c]=null; break; }
          }
        }
      }
      return true;
    }
  }
  return false;
}

/* 周期性被动触发
   v22 修复 Bug 13：原逻辑每个回合（含对方回合）都触发玩家周期性被动，
   导致 p_joke/p_clone/p_rhythm/p_debug/p_samsara/p_leap 计数器在对方回合也+1，
   实际周期变成"每 N 回合（不分敌我）"而非设计意图"每 N 个己方回合"。
   现按 currentPlayer 只触发当前行动方的周期性被动。 */
function triggerPeriodicPassives(){
  /* v5.0 多阵营/4v4：触发当前玩家的角色被动 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.color===state.currentPlayer);
    if(mp) triggerPeriodicForChar(mp.char);
    return;
  }
  /* v22: PVP/联机模式按当前行动方触发各自周期性被动 */
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    const curChar=charForColor(state.currentPlayer);
    if(curChar) triggerPeriodicForChar(curChar);
    return;
  }
  /* PVE/三英：玩家走时触发玩家周期被动；B王走时触发 B王 combo */
  if(state.currentPlayer===state.playerColor){
    const myChar=state.character;
    if(myChar) triggerPeriodicForChar(myChar);
  }
  /* B王（三英模式） */
  if(state.gameMode==='three'){  /* v15: 修复字符串不匹配（原 'threeHeroes' 导致三英被动全开失效） */
    const thb=THREE_HEROES_BKING;
    if(thb.comboTurns>0 && state.currentPlayer===state.aiColor){
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
    p_leap:3, p_combo:4, p_blitz:3,
    p_tongtian_pressure:4, p_hunyuan_golden:3  /* v34: 通天教主周期被动 */
  };
  return map[passiveId]||0;
}

/* v22: PVP 预测类被动改造 — 随机强制对方下回合走一步指定的棋
   原 PVP 下预测类被动仅展示 AI 路线（无 AI 对手），实际无效。
   现改为：随机选择对方一步合法走法，强制对方下回合执行该走法。
   返回 true 表示成功设置，false 表示无可用走法或非 PVP 模式。
   label: 技能名称（用于日志和语音）
   v22 修复：仅在 pvp 模式下生效。online 模式下两端独立用 Math.random
   选走法必然 desync，预测被动在 online 下不可用，直接禁用。 */
function forceOpponentRandomMove(charId, label){
  if(state.gameMode!=='pvp') return false;
  const mc = myColorForChar(charId);
  if(mc!==RED && mc!==BLACK) return false;
  const oc = mc===RED ? BLACK : RED;
  /* 已有强制走法时跳过，避免多被动相互覆盖 */
  if(state.predForcedMoves && state.predForcedMoves[oc]) return false;
  const moves = getLegalAIMoves(state.board, oc);
  if(!moves || moves.length===0) return false;
  const m = moves[Math.floor(Math.random()*moves.length)];
  if(!state.predForcedMoves) state.predForcedMoves = {};
  state.predForcedMoves[oc] = {from:{r:m.fr,c:m.fc}, to:{r:m.tr,c:m.tc}};
  /* 日志与语音 */
  const myName = (CHARACTERS[charId] && CHARACTERS[charId].name) || '预测者';
  const oppName = (charForColor(oc) && CHARACTERS[charForColor(oc)] && CHARACTERS[charForColor(oc)].name) || (oc===RED?'红方':'黑方');
  const sideKey = oc===RED ? 'red' : 'black';
  const pChar = state.board[m.fr][m.fc] ? (PIECE_CHAR[sideKey] && PIECE_CHAR[sideKey][state.board[m.fr][m.fc].type]) || '?' : '?';
  const logText = `<b>${myName}</b> ${label||'预测命中'}！<b>${oppName}</b> 下回合被强制走 <b>${pChar}</b>`;
  if(typeof addBattleLog==='function') addBattleLog('passive', logText);
  speakTaunt(`${label||'预测'}！${oppName}，下回合按我的算计走吧！`,'self');
  return true;
}

/* ===== 被动效果实现 ===== */
function triggerPassive(charId, passive, event, ctx){
  if(!passive) return;
  if(passiveState.bkingDisabled>0 && isBkingPassive(passive.id)) return;
  /* v22: 战报 — 被动触发（避免太频繁，仅记录有具体效果的被动） */
  if(typeof addBattleLog==='function' && passive.id){
    const charName = (charId==='bking') ? 'B王' : (CHARACTERS[charId]&&CHARACTERS[charId].name) || charId;
    /* 首回合被动只在首回合触发，跳过日志避免噪音 */
    if(event!=='first_turn' && event!=='aura'){
      addBattleLog('passive', `<b>${charName}</b> 被动 <b>${passive.name||passive.id}</b> 触发（${event}）`);
    }
  }
  /* v16: 仙帝审判/逻辑爆破的 oppPassiveDisabled 也会使 B王被动失效（之前只写不读）
     v22 修复 Bug 11（被动技能）：PVP 下 oppPassiveDisabled 应屏蔽对方角色所有被动，
     而非仅 isBkingPassive。现按 charId 判断：若该角色是"对方"（非技能释放方）则屏蔽。
     PVE 下保持原逻辑（屏蔽 B王被动）。 */
  if(state.oppPassiveDisabled>0){
    if(isBkingPassive(passive.id) && charId==='bking') return;
    /* PVP 下：对方角色被动也屏蔽 */
    if(state.gameMode==='pvp' || state.gameMode==='online'){
      const skillOwnerColor = state.skillOwnerColor || state.playerColor;
      const charColor = myColorForChar(charId);
      if(charColor && charColor!==skillOwnerColor) return;
    }
  }
  switch(passive.id){
    /* ===== 侯智博 ===== */
    case 'p_strategy':
      /* v22 重新设计：奇兵突袭 — 每回合开始 25% 概率，己方攻击最高棋子攻击+30%（1回合）
         v31: 高亮目标棋子+战报中标注坐标，让玩家立刻看到目标 */
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        if(Math.random()<0.25){
          /* 找己方攻击力最高的非帅棋子 */
          let bestPiece=null, bestAtk=0, bestR=-1, bestC=-1;
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            const p=state.board[r][c];
            if(p && p.player===mc && p.type!==T.KING){
              const atk = (p.atk||0) + Math.floor((p.charAtk||0)/10);
              if(atk>bestAtk){ bestAtk=atk; bestPiece=p; bestR=r; bestC=c; }
            }
          }
          if(bestPiece){
            const buffVal = Math.floor((bestPiece.atk||0)*0.3);
            addBuff(bestPiece, 'attackBoost', buffVal, 1);
            speakTaunt('奇兵突袭！全军最强子获得攻击增益！','self');
            if(typeof addBattleLog==='function') addBattleLog('passive', `<b>奇兵突袭</b> 触发！(${bestR+1}行${bestC+1}列)获得攻击+${buffVal}（1回合）`);
            /* v31: 棋盘高亮目标棋子 4 秒 */
            if(typeof highlightPieces==='function'){
              highlightPieces([{r:bestR, c:bestC, label:'奇兵突袭', color:'#b8945a'}], 4000);
            }
          }
        }
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
      /* v16: 光环：仕相防御+15%（每回合刷新 buff）
         v22 P2 Bug 1: 标记 _aura，避免 tickBuffs 递减导致永不过期前的过期问题 */
      if(event==='aura') addBuffToPlayerPieces(charId, 'defenseBoost', 15, 2, [T.ADVISOR, T.ELEPHANT], true);
      break;
    case 'p_joke':
      if(event==='periodic'){
        /* v22 修复 Bug 2（被动技能）：改为按颜色分桶，避免 p_joke/p_rebound
           共享 state.bkingAtkDebuff/bkingAtkDebuffTarget 时互相覆盖。
           对方攻击-20% 持续2回合（叠加）。 */
        const oc_joke = myColorForChar(charId)===RED ? BLACK : RED;
        state.atkDebuffByColor = state.atkDebuffByColor || {};
        state.atkDebuffByColor[oc_joke] = (state.atkDebuffByColor[oc_joke]||0) + 2;
        speakTaunt('妙语连珠！你这下慌了吧？');
      }
      break;

    /* ===== 周子翰 ===== */
    case 'p_plan':
      /* v22 重新设计：布局精算 — 己方棋子被吃时，己方所有棋子获得36点护盾（2回合）
         放弃原"预测"概念，改为防御反制类被动
         v23 P1: 30/1→36/2 对齐 data.js 描述 */
      if(event==='on_captured'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        /* 给己方所有非帅棋子加护盾 */
        addTeamBuff(state.board, mc, 'shield', 36, 2);
        speakTaunt('布局精算！全军护盾！','self');
        if(typeof addBattleLog==='function') addBattleLog('passive', `<b>布局精算</b> 触发！己方全军获得36点护盾（2回合）`);
      }
      break;
    case 'p_elegant':
      /* v22: 闪避逻辑已迁移至 tryDodgePassive（calcDamage 前预检），此处保留 case 占位 */
      break;

    /* ===== 三金 ===== */
    case 'p_brother':
      /* v16: 光环：己方棋子少于8颗时攻击+30%（绝境狂暴）
         v22 P2 Bug 1: 标记 _aura，避免 buff 被错误递减 */
      if(event==='aura'){
        const myColor = myColorForChar(charId);
        if(myColor && countPieces(myColor) < 8){
          addBuffToPlayerPieces(charId, 'attackBoost', 30, 2, null, true);
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
      /* v22: 闪避逻辑已迁移至 tryDodgePassive（calcDamage 前预检），此处保留 case 占位 */
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
        /* v22 修复 Bug 2（被动技能）：改为按颜色分桶，避免与 p_joke 互相覆盖。
           被削弱方=攻击方颜色，攻击-20% 持续2回合（叠加）。 */
        if(ctx && ctx.attackerPiece){
          const oc_rb = ctx.attackerPiece.player;
          state.atkDebuffByColor = state.atkDebuffByColor || {};
          state.atkDebuffByColor[oc_rb] = (state.atkDebuffByColor[oc_rb]||0) + 2;
        }
        /* v21: 真正实现反弹伤害 — 立即给攻击方扣血（30%被吃方maxHp） */
        if(ctx && ctx.attackerPiece){
          const reflectDmg = Math.floor((ctx.capturedPiece?.maxHp || 100) * 0.3);
          ctx.attackerPiece.hp = Math.max(0, (ctx.attackerPiece.hp || 0) - reflectDmg);
          speakTaunt('全给你！反弹'+reflectDmg+'伤害！','self');
          /* v22 修复 Bug 1（P0）：反弹致死时走统一死亡流程，
             避免 attacker.hp=0 但棋子仍留在棋盘上。
             用 passiveState._reflecting 守护，防止对方 ON_CAPTURED 链式
             触发再次反弹导致无限递归。 */
          if(ctx.attackerPiece.hp<=0 && !passiveState._reflecting){
            passiveState._reflecting = true;
            try {
              /* 在棋盘上找到攻击方棋子位置并移除 */
              let foundPos = false;
              for(let r=0;r<ROWS && !foundPos;r++){
                for(let c=0;c<COLS && !foundPos;c++){
                  if(state.board[r][c]===ctx.attackerPiece){
                    state.board[r][c]=null;
                    foundPos = true;
                  }
                }
              }
              /* 推入对应颜色的阵亡列表（pushCaptured 由 game.js 提供全局函数） */
              if(typeof pushCaptured==='function'){
                pushCaptured(ctx.attackerPiece);
              } else if(ctx.attackerPiece.player===RED){
                state.redCaptured && state.redCaptured.push(ctx.attackerPiece);
              } else {
                state.blackCaptured && state.blackCaptured.push(ctx.attackerPiece);
              }
              if(typeof addBattleLog==='function'){
                addBattleLog('passive', '<b>全给你</b> 反弹致命！攻击方阵亡');
              }
              /* 触发攻击方颜色的 ON_CAPTURED 被动链（capturer 为反弹被动持有者）。
                 attackerPiece 传 null，因反弹被动持有者本就是被吃方，已死亡。 */
              if(typeof passivesOnCaptured==='function'){
                const victimChar = charForColor(ctx.attackerPiece.player);
                if(victimChar){
                  passivesOnCaptured(victimChar, charId, ctx.attackerPiece, null);
                }
              }
            } finally {
              passiveState._reflecting = false;
            }
          }
        } else {
          speakTaunt('全给你！反弹伤害！');
        }
      }
      break;

    /* ===== 胡浩 ===== */
    case 'p_shield':
      /* v22: 闪避逻辑已迁移至 tryDodgePassive（calcDamage 前预检），此处保留 case 占位 */
      break;
    case 'p_unity':
      /* v21: 光环：己方将每回合获得80点护盾（吸收伤害），相当于"将受保护"，
         攻击方需先打掉护盾才能实质伤害到将
         v22 P2 Bug 1: 标记 _aura，避免 buff 被错误递减 */
      if(event==='aura') addBuffToPlayerPieces(charId, 'shield', 80, 2, [T.KING], true);
      break;

    /* ===== 解宇轩 ===== */
    case 'p_logic':
      /* v22 重新设计：逻辑压制 — 每回合开始，对方攻防最高的棋子被「虚弱」（攻击-25%，1回合）
         放弃原"预测"概念，改为减益控制类被动 */
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        const oc = mc===RED ? BLACK : RED;
        /* 找对方攻防综合最高的非帅棋子 */
        let bestPiece=null, bestScore=0;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===oc && p.type!==T.KING){
            const score = (p.atk||0) + (p.def||0);
            if(score>bestScore){ bestScore=score; bestPiece=p; }
          }
        }
        if(bestPiece){
          addBuff(bestPiece, 'weakness', 0.25, 1, true);
          speakTaunt('逻辑压制！对方最强子被虚弱！','self');
          if(typeof addBattleLog==='function') addBattleLog('passive', `<b>逻辑压制</b> 触发！对方最强子攻击-25%（1回合）`);
        }
      }
      break;
    case 'p_deduce':
      /* v20: 修复只写不读 — 改用 displayRoutePlan 显示2步路线（不强制AI） */
      if(event==='on_capture'){
        const plan=buildAIRoutePlan(2);
        if(plan&&plan.length>0){
          displayRoutePlan(plan,'#8a4c6b','解');
          speakTaunt('演绎推理！已看穿对方下2步！','self');
        }
      }
      break;

    /* ===== 陆星辰 ===== */
    case 'p_debug':
      if(event==='periodic'){
        /* v22: 传入触发方角色 ID，正确识别"对方"颜色 */
        clearOpponentBuffs(charId);
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
      /* v22 重新设计：题海战术 — 每回合开始，己方血量最低的棋子回复30HP
         放弃原"预测"概念，改为治疗辅助类被动 */
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        /* 找己方血量最低且未满血的非帅棋子 */
        let lowPiece=null, lowRatio=1.1;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && p.type!==T.KING && p.maxHp && p.hp<p.maxHp){
            const ratio = p.hp/p.maxHp;
            if(ratio<lowRatio){ lowRatio=ratio; lowPiece=p; }
          }
        }
        if(lowPiece){
          const before = lowPiece.hp;
          lowPiece.hp = Math.min(lowPiece.maxHp, lowPiece.hp + 30);
          const healed = lowPiece.hp - before;
          if(healed>0){
            speakTaunt('题海战术！全军最低血量棋子已回血！','self');
            if(typeof addBattleLog==='function') addBattleLog('passive', `<b>题海战术</b> 触发！己方血量最低棋子回血 ${healed}HP`);
          }
        }
      }
      break;
    case 'p_fullmark':
      /* v16: 光环：己方炮、马攻击+15%（每回合刷新 buff）
         v22 P2 Bug 1: 标记 _aura，避免 buff 被错误递减 */
      if(event==='aura') addBuffToPlayerPieces(charId, 'attackBoost', 15, 2, [T.CANNON, T.HORSE], true);
      break;

    /* ===== 仙帝Alice ===== */
    case 'p_pressure':
      /* v16: 光环：B王技能CD+1回合，释放概率-15%（每回合刷新标记）
         v22 修复 Bug 5（被动技能）：原直接赋值会覆盖 p_kingaura 的 -1，
         改为累加（+=），在 passivesOnTurnStart 开始时由调用方重置为 0。
         v22 修复 Bug 8（被动技能）：PVP/online 模式下无 B王，bkingCdIncrease
         无消费方。PVP 下改为给己方全体加 attackBoost +10（2回合）。 */
      if(event==='aura'){
        const mc=myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        if(state.gameMode==='pvp'||state.gameMode==='online'){
          /* PVP 下改为全体攻击+10点（2回合）
             v22 P2 Bug 1: 标记 _aura，避免 buff 被错误递减 */
          addBuffToPlayerPieces(charId, 'attackBoost', 10, 2, null, true);
          if(!passiveState.pressureAnnounced){
            passiveState.pressureAnnounced=true;
            if(typeof addBattleLog==='function') addBattleLog('passive', '<b>仙帝威压</b> 己方全体攻击+10');
          }
        } else {
          state.bkingCdIncrease = (state.bkingCdIncrease||0) + 1;
          state.bkingSkillChanceReduce = (state.bkingSkillChanceReduce||0) + 0.15;
        }
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
      /* v22: 免疫逻辑由 tryConsumeSilenceImmunity 处理，此处保留 case 占位 */
      break;
    case 'p_flipgod':
      if(event==='on_capture'){
        /* v22 修复 Bug 8（被动技能）：原 skillCdReduce 永不消耗，变成永久 -1 CD。
           改为一次性 buff（duration=1，下回合开始 tickBuffs 时移除）。
           由于 skillCdReduce 是全局 state 而非 piece buff，
           这里设为 1 并在玩家下回合结束时清零（doMove 回调中处理）。
           v22 修复 Bug 7（被动技能）：删除死代码 skillCdReduceUsed（全代码库无读取点）。 */
        state.skillCdReduce=1;
        speakTaunt('掀桌之神！技能加速！');
      }
      break;

    /* ===== 刘雪沛 ===== */
    case 'p_insight':
      /* v22 重新设计：破妄气场 — B王所有棋子攻击-15%（光环，持续全场）
         放弃原"预测"概念，改为永久减益光环 */
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        const oc = mc===RED ? BLACK : RED;
        /* 给对方所有非帅棋子加 weakness（攻击-15%，1回合，每回合刷新）
           v22 P2 Bug 1: 标记 _aura，避免 buff 被错误递减 */
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===oc && p.type!==T.KING){
            addBuff(p, 'weakness', 0.15, 1, true);
          }
        }
        /* 仅首回合播报，避免刷屏 */
        if(!passiveState.insightAnnounced){
          passiveState.insightAnnounced = true;
          speakTaunt('破妄气场！B王棋子攻击永久降低！','self');
          if(typeof addBattleLog==='function') addBattleLog('passive', `<b>破妄气场</b> 启动！对方所有棋子攻击-15%（光环）`);
        }
      }
      break;
    case 'p_nemesis':
      /* v16: 光环：对B王伤害+50% — 己方全体攻击时伤害加成（仅对B王棋子）
         v22 修复 Bug 4（被动技能）：PVP 下 bkiller 会对所有对手生效（过强）。
         PVP/online 模式下不触发此光环（bkiller 仅 PVE/三英对 B王 有效）。
         v22 P2 Bug 1: 标记 _aura，避免 buff 被错误递减 */
      if(event==='aura' && state.gameMode!=='pvp' && state.gameMode!=='online'){
        addBuffToPlayerPieces(charId, 'bkiller', 0.5, 2, null, true);
      }
      break;

    /* ===== 刘佳伟 ===== */
    case 'p_stable':
      /* v16: 光环：己方将防御+20%（每回合刷新 buff）
         v22 P2 Bug 1: 标记 _aura，避免 buff 被错误递减 */
      if(event==='aura') addBuffToPlayerPieces(charId, 'defenseBoost', 20, 2, [T.KING], true);
      break;
    case 'p_revenge':
      if(event==='on_captured'){
        revengeCapture(charId, ctx&&ctx.capturedPiece);
      }
      break;

    /* ===== 袁清山 ===== */
    case 'p_hide':
      /* v19: 改用 buff 系统使免疫生效（原 state.immuneFirstTurn 只写不读）
         v22 修复 Bug 6：原 PVP 模式下用 state.currentPlayer（攻击方）颜色，
         导致 immune buff 加到对方棋子上。改用 myColorForChar(charId) 取被动持有方颜色。 */
      if(event==='first_turn'){
        const mc = myColorForChar(charId);
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
        /* v22 修复 Bug 2（被动技能）：记录触发方颜色，避免 PVP 下被对方消耗
           v22 修复 Bug 6（被动技能）：原直接赋值会覆盖 p_chainatk 的累加结果，
           改为 Math.max 取大者，避免互相覆盖。 */
        state.attackBoost = Math.max(state.attackBoost||0, 2);
        state.attackBoostOwner=myColorForChar(charId);
        speakTaunt('龙跃！攻击大幅提升！');
      }
      break;

    /* ===== 罗伦杰 ===== (v15: 修复 case 'p_chain' 重复定义，改为 p_chainatk) */
    case 'p_chainatk':
      if(event==='on_capture'){
        // HP system: this boost increases piece atk during damage calculation in doMove
        /* v22 修复 Bug 2（被动技能）：记录触发方颜色
           v10 弱角色增强：每层 +30%（原 +20%），最多 2 层（+60%）。
           使用独立 chainatkStacks 计数器，避免与 p_leap 的 state.attackBoost 冲突。 */
        state.chainatkStacks=Math.min((state.chainatkStacks||0)+1, 2);
        state.attackBoostOwner=myColorForChar(charId);
        speakTaunt('连击！攻击提升！');
      }
      break;
    case 'p_break':
      /* v16: 光环：攻击无视对方防御增益（破防）— 己方全体攻击穿透
         v22 P2 Bug 1: 标记 _aura，避免 buff 被错误递减 */
      if(event==='aura') addBuffToPlayerPieces(charId, 'pierce', 1, 2, null, true);
      break;

    /* ===== 大爱仙尊（古月方源 · 冷漠无情型） ===== */
    case 'p_ironheart':
      /* IMMUNE：首回合己方全体免疫所有伤害（铁石心肠，冷漠无情）
         v22 修复 Bug 6：PVP 下用 myColorForChar(charId) 而非 state.currentPlayer（攻击方）。 */
      if(event==='first_turn'){
        const mc = myColorForChar(charId);
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc) addBuff(p, 'immune', 1, 1);
        }
        speakTaunt('铁石心肠...首回合，万法不侵。','self');
      }
      break;
    case 'p_gumaster':
      /* ON_CAPTURED：己方棋子被吃时，己方全体回血25 + 方源叠攻击buff（蛊师本能）
         v22 修复 Bug 6：PVP 下 myColorForChar(charId) 取被动持有方颜色（被吃方），
         原 state.currentPlayer 是攻击方（吃子方），导致回血加到攻击方棋子上。
         v22 修复 Bug 9（被动技能）：原 stacks 变量死代码，攻击 buff 不叠加
         （addBuff 对同类取 max 而非累加）。现用 stacks*10 作为 value，
         实现"可叠加3层"的设计意图。 */
      if(event==='on_captured'){
        passiveState.counters[charId+'_gumaster']=(passiveState.counters[charId+'_gumaster']||0)+1;
        const stacks=Math.min(3, passiveState.counters[charId+'_gumaster']);
        const mc = myColorForChar(charId);
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && p.maxHp){
            p.hp=Math.min(p.maxHp, p.hp+25);
          }
        }
        /* 方源（核心将）获得攻击强化，可叠加3层（10*stacks） */
        const king=findKing(state.board, mc);
        if(king){
          addBuff(state.board[king.row][king.col], 'attackBoost', 10*stacks, 2);
        }
        speakTaunt('蛊师本能...残值，也要榨干。','self');
      }
      break;

    /* ===== B王被动 ===== */
    case 'p_aura':
      /* v16: 光环：对手攻击-10% — 通过给对方全体加 weakness 实现
         v22 修复 Bug 17（被动技能）：原 guard 仅排除 pvp，online 模式下 state.aiColor
         未定义会导致 oppColor 计算错误。显式限定为 pve/three 模式。
         v22 P2 Bug 1: 标记 _aura，避免 buff 被错误递减 */
      if(event==='aura' && (state.gameMode==='pve'||state.gameMode==='three')){
        const oppColor = state.aiColor===BLACK ? RED : BLACK;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===oppColor) addBuff(p, 'weakness', 0.1, 2, true);
        }
      }
      break;
    case 'p_shameless':
      /* v22: 免疫逻辑由 tryConsumeSilenceImmunity 处理，此处保留 case 占位 */
      break;
    case 'p_kingaura':
      /* v16: 光环：CD-1，释放概率+10%（每回合刷新标记）
         v22 修复 Bug 5（被动技能）：原直接赋值会覆盖 p_pressure 的 +1，
         改为累加（+= -1）。 */
      if(event==='aura'){
        state.bkingCdIncrease = (state.bkingCdIncrease||0) - 1;
        state.bkingSkillChanceReduce = (state.bkingSkillChanceReduce||0) - 0.10;
      }
      break;
    case 'p_combo':
      /* 三英：周期双杀（在triggerPeriodicPassives处理） */
      break;

    /* ===== 帝国元首 ===== */
    case 'p_discipline':
      /* AURA：永久光环：己方棋子数<10时，全体攻击+15点（永久） */
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        let count = 0;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc) count++;
        }
        if(count < 10){
          /* 给己方全体加永久 attackBoost buff */
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            const p=state.board[r][c];
            if(p && p.player===mc){
              addBuff(p, 'attackBoost', 15, -1, true, true); /* isAura=true, permanent=true */
            }
          }
          if(!passiveState.disciplineAnnounced){
            passiveState.disciplineAnnounced = true;
            if(typeof addBattleLog==='function') addBattleLog('passive', '<b>铁血纪律</b> 永久光环：全体攻击+15点');
          }
        }
      }
      break;
    case 'p_blitz':
      /* PERIODIC：每3回合加速，下回合连走2步（参考 p_rhythm 实现） */
      if(event==='periodic'){
        state.extraMove = Math.max(state.extraMove||0, 1);
        speakTaunt('闪电战！下回合连走两步！','self');
        if(typeof addBattleLog==='function') addBattleLog('passive', '<b>闪电战专家</b> 加速，连走两步');
      }
      break;

    /* ===== 布罗利 ===== */
    case 'p_overcharge':
      /* AURA：永久光环：本方单位每回合增长5%攻击力和5%防御力（递增，永久） */
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        /* 每回合给己方棋子叠加 attackBoost 和 defenseBoost（永久，递增）
           addBuff 在续期时会取 max(value)，所以累加需要先移除旧 buff */
        passiveState.overchargeStacks = (passiveState.overchargeStacks||0) + 1;
        const stacks = passiveState.overchargeStacks;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc){
            /* 攻击+5%（每回合），按基础攻击的 5% 累加 */
            const atkBonus = Math.floor((p.atk + (p.charAtk||0)/10) * 0.05 * stacks);
            const defBonus = Math.floor((p.def + (p.charDef||0)/10) * 0.05 * stacks);
            /* v39 修复 P1 bug: p_overcharge 用独立 buff 类型 overchargeAtk/overchargeDef，
               避免污染 blitz/leap/storm 等施加的同类型临时 buff（原代码会把它们永久化）*/
            if(p.buffs){
              p.buffs = p.buffs.filter(b => b.type !== 'overchargeAtk' && b.type !== 'overchargeDef');
            }
            if(atkBonus > 0) addBuff(p, 'overchargeAtk', atkBonus, -1, true, true);
            if(defBonus > 0) addBuff(p, 'overchargeDef', defBonus, -1, true, true);
          }
        }
        if(stacks === 1){
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>溢出的气</b> 永久光环启动！本方单位每回合+5%攻击+5%防御（递增）');
        }
      }
      break;
    case 'p_legend':
      /* IMMUNE：每局1次，给布罗利的帅加 immune buff 1回合（被动触发时） */
      if(event==='aura' && !passiveState._legendUsed){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        /* 找到布罗利的帅，给它加 immune buff 1回合 */
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && p.type===T.KING){
            /* 检查是否已有 immune buff */
            const hasImmune = (p.buffs||[]).some(b => b.type === 'immune');
            if(!hasImmune){
              addBuff(p, 'immune', 1, 1, false, false);
              passiveState._legendUsed = true;
              if(typeof addBattleLog==='function') addBattleLog('passive', '<b>传说体质</b> 帅获得免疫1回合（每局1次）');
            }
            break;
          }
        }
      }
      break;

    /* ===== v10 新增被动 ===== */
    case 'p_reich':
      /* AURA：永久光环：己方所有棋子防御+20，HP+30（永久） */
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc){
            addBuff(p, 'defenseBoost', 20, -1, true, true); /* 永久 */
            /* HP 加成：通过 maxHpBonus buff 实现，或直接加 maxHp 和 hp */
            if(!p._reichApplied){
              p.maxHp = (p.maxHp || p.hp) + 30;
              p.hp = (p.hp || 0) + 30;
              p._reichApplied = true;
            }
          }
        }
        if(!passiveState.reichAnnounced){
          passiveState.reichAnnounced = true;
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>第三帝国</b> 永久光环：己方全体防御+20，HP+30');
        }
      }
      break;
    case 'p_bking_confuse':
      /* AURA：每回合30%概率强制对方下回合走指定一步（对己方有利） */
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        /* 仅B王回合触发 */
        if(state.currentPlayer !== mc) break;
        /* v10 修复：原 _confuseUsed 标记导致每局只触发1次，与"每回合30%概率"描述不符。
           改为检查 state.confuseForcedMove 是否已存在（本回合已施加则不再触发）。 */
        if(state.confuseForcedMove) break;
        if(Math.random() > 0.30) break;
        /* 找对方帅 */
        const oc = mc===RED ? BLACK : RED;
        let kingPos = null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===oc && p.type===T.KING){ kingPos={r,c,p}; break; }
        }
        if(!kingPos) break;
        /* 找己方攻击棋子中距离对方帅最近的 */
        let attacker = null, minDist = 99;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && p.type!==T.KING){
            const d = Math.abs(r-kingPos.r) + Math.abs(c-kingPos.c);
            if(d < minDist){ minDist = d; attacker = {r,c,p}; }
          }
        }
        if(!attacker) break;
        /* 找对方帅的合法走法中，向己方攻击者方向移动的那一步 */
        const moves = getLegalMoves(state.board, kingPos.r, kingPos.c);
        if(moves.length === 0) break;
        /* 按距离攻击者排序，选最近的（对己方有利） */
        moves.sort((a,b) =>
          (Math.abs(a.r-attacker.r)+Math.abs(a.c-attacker.c)) -
          (Math.abs(b.r-attacker.r)+Math.abs(b.c-attacker.c))
        );
        const forcedMove = moves[0];
        state.confuseForcedMove = {
          color: oc,
          from: { r: kingPos.r, c: kingPos.c },
          to: { r: forcedMove.r, c: forcedMove.c }
        };
        speakTaunt('指鹿为马！下回合你必须走B王指定的步！','self');
        if(typeof addBattleLog==='function') addBattleLog('passive', '<b>指鹿为马</b> 强制对方下回合走指定步（每回合30%概率）');
      }
      break;
    case 'p_bking_insight':
      /* TURN_START：每回合开始时，B王攻击+5%（永久，递增） */
      if(event==='turn_start'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        if(state.currentPlayer !== mc) break;
        passiveState.insightStacks = (passiveState.insightStacks||0) + 1;
        const stacks = passiveState.insightStacks;
        /* 给己方全体加永久 attackBoost，按基础攻击 5% 累加 */
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc){
            const bonus = Math.floor((p.atk + (p.charAtk||0)/10) * 0.05 * stacks);
            /* 移除旧的 _insight buff，重新加上累加值 */
            if(p.buffs){
              p.buffs = p.buffs.filter(b => b.type !== 'attackBoost' || b._insight !== true);
            }
            if(bonus > 0){
              addBuff(p, 'attackBoost', bonus, -1, false, true);
              if(p.buffs && p.buffs.length > 0){
                const last = p.buffs[p.buffs.length-1];
                if(last.type === 'attackBoost') last._insight = true;
              }
            }
          }
        }
        if(stacks === 1){
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>洞察</b> 永久光环启动！B王每回合攻击+5%（递增）');
        }
      }
      break;

    /* ===== v29 新增 B王被动（贪婪/愚蠢运气） ===== */
    case 'p_greedy':
      /* ON_CAPTURE：B王每吃一子，下次攻击+15%（贪婪本性，可叠加2层）
         实现思路：给B王攻击最高的己方棋子叠加 attackBoost，最多2层 */
      if(event==='on_capture'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        passiveState.greedyStacks = Math.min(2, (passiveState.greedyStacks||0) + 1);
        const stacks = passiveState.greedyStacks;
        /* 给B王攻击最高的棋子加 attackBoost */
        let target = null, maxAtk = -1;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && p.type!==T.KING){
            const atk = (p.atk||0) + Math.floor((p.charAtk||0)/10);
            if(atk > maxAtk){ maxAtk = atk; target = p; }
          }
        }
        if(target){
          const bonus = Math.floor(maxAtk * 0.15 * stacks);
          /* 移除旧 _greedy buff，重新叠加 */
          if(target.buffs){
            target.buffs = target.buffs.filter(b => b.type !== 'attackBoost' || b._greedy !== true);
          }
          if(bonus > 0){
            addBuff(target, 'attackBoost', bonus, 2, false, false);
            if(target.buffs && target.buffs.length > 0){
              const last = target.buffs[target.buffs.length-1];
              if(last.type === 'attackBoost') last._greedy = true;
            }
          }
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>贪婪本性</b> B王吃子后攻击+15%（'+stacks+'/2层）');
        }
      }
      break;
    case 'p_stupid_luck':
      /* ON_CAPTURED：B王被吃时25%概率反吃对方（愚蠢运气）
         实现思路：被吃时25%概率，将攻击方棋子也击杀（HP归0，移入阵亡名单）
         v30-fix: 原代码 `typeof attackerPiece === 'undefined'` 永远为 true
         （triggerPassive 作用域内未声明 attackerPiece），导致被动 0% 触发。
         改为从 ctx 读取（passivesOnCaptured 通过 ctx.attackerPiece 传入）。 */
      if(event==='on_captured'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        if(Math.random() > 0.25) break;
        /* attackerPiece 由 passivesOnCaptured 通过 ctx.attackerPiece 传入 */
        const attackerPiece = ctx && ctx.attackerPiece;
        if(!attackerPiece) break;
        /* 反吃：将攻击方棋子HP归0并移入阵亡名单 */
        const oppColor = attackerPiece.player;
        attackerPiece.hp = 0;
        if(oppColor===RED && state.redCaptured){
          state.redCaptured.push(attackerPiece);
        } else if(oppColor===BLACK && state.blackCaptured){
          state.blackCaptured.push(attackerPiece);
        }
        /* 从棋盘移除 */
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          if(state.board[r][c] === attackerPiece){
            state.board[r][c] = null;
            break;
          }
        }
        if(typeof addBattleLog==='function') addBattleLog('passive', '<b>愚蠢运气</b> B王被吃时25%反吃对方（运气好）');
        if(typeof showProcNotice==='function') showProcNotice('愚蠢运气！', 'B王被吃时25%反吃对方', 'counter');
        speakTaunt('嘿嘿，本王运气好！','self');
        /* v32-fix P1: 触发攻击方 ON_CAPTURED 被动链 — 与 p_rebound 行为对齐。
           原实现反吃致死后未调用 passivesOnCaptured，导致攻击方的
           p_plan（护盾）/p_gumaster（回血+叠攻）/p_calm_mind（闪避复活）等
           被吃被动在 被 p_stupid_luck 反吃时全部失效。
           守护：用 _stupidLuckReflecting 防递归。 */
        if(!passiveState._stupidLuckReflecting && typeof passivesOnCaptured==='function'){
          passiveState._stupidLuckReflecting = true;
          try {
            const victimChar = (typeof charForColor==='function') ? charForColor(attackerPiece.player) : null;
            if(victimChar) passivesOnCaptured(victimChar, charId, attackerPiece, null);
          } finally {
            passiveState._stupidLuckReflecting = false;
          }
        }
      }
      break;

    /* ===== v29 新增3角色被动 ===== */
    /* 张树灿 - 内敛气场 */
    case 'p_introverted':
      /* AURA：光环：己方全体防御+15点（永久，标记 _introverted 避免叠加） */
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc){
            /* 检查是否已加 _introverted 永久 buff */
            const has = (p.buffs||[]).some(b => b.type==='defenseBoost' && b._introverted===true);
            if(!has){
              addBuff(p, 'defenseBoost', 15, -1, true, true);
              if(p.buffs && p.buffs.length > 0){
                const last = p.buffs[p.buffs.length-1];
                if(last.type === 'defenseBoost') last._introverted = true;
              }
            }
          }
        }
        if(!passiveState.introvertedAnnounced){
          passiveState.introvertedAnnounced = true;
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>内敛气场</b> 永久光环：己方全体防御+15点');
        }
      }
      break;
    case 'p_deep_thought':
      /* PERIODIC：每3回合为己方帅添加50点护盾（2回合） */
      if(event==='periodic'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        const king = findKing(state.board, mc);
        if(king){
          addBuff(state.board[king.row][king.col], 'shield', 50, 2, false, false);
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>深思熟虑</b> 己方帅获得50点护盾（2回合）');
          if(typeof showProcNotice==='function') showProcNotice('深思熟虑', '己方帅获得50点护盾', 'proc');
        }
      }
      break;

    /* 张毓芝 - 稳健气场 / 平和心态 */
    case 'p_steady_aura':
      /* AURA：光环：己方全体每回合恢复10HP（通过 turn_start 触发） */
      if(event==='turn_start'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        if(state.currentPlayer !== mc) break;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && p.maxHp){
            p.hp = Math.min(p.maxHp, p.hp + 10);
          }
        }
        if(!passiveState.steadyAuraAnnounced){
          passiveState.steadyAuraAnnounced = true;
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>稳健气场</b> 永久光环：己方全体每回合恢复10HP');
        }
      }
      break;
    case 'p_calm_mind':
      /* ON_CAPTURED：己方棋子被吃时20%闪避，棋子保留
         实现思路：在 passivesOnCaptured 中预检，20%概率取消吃子
         （由于吃子已在 calcDamage 前由 tryDodgePassive 处理，
          此处作为后备：被吃时20%概率复活） */
      if(event==='on_captured'){
        if(Math.random() > 0.20) break;
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        /* 从最近被吃的己方棋子中复活（如果存在） */
        const capturedList = mc===RED ? state.redCaptured : state.blackCaptured;
        if(!capturedList || capturedList.length === 0) break;
        /* 找最后一个被吃的己方棋子 */
        let idx = -1;
        for(let i = capturedList.length - 1; i >= 0; i--){
          if(capturedList[i] && capturedList[i].player === mc){
            idx = i;
            break;
          }
        }
        if(idx < 0) break;
        const revived = capturedList.splice(idx, 1)[0];
        /* 恢复30% HP */
        revived.hp = Math.floor((revived.maxHp||100) * 0.3);
        /* 找空位放置（己方区域） */
        let placed = false;
        const startRow = mc===RED ? 7 : 0;
        const endRow = mc===RED ? 9 : 2;
        for(let r=startRow; r<=endRow && !placed; r++){
          for(let c=0; c<COLS && !placed; c++){
            if(!state.board[r][c]){
              state.board[r][c] = revived;
              placed = true;
            }
          }
        }
        if(placed && typeof addBattleLog==='function'){
          addBattleLog('passive', '<b>平和心态</b> 己方棋子20%闪避，复活保留');
        }
        if(placed && typeof showProcNotice==='function'){
          showProcNotice('平和心态！', '己方棋子20%闪避，复活保留', 'proc');
        }
      }
      break;

    /* 刘锋 - 搞子气场 / 不按套路 */
    case 'p_trickster_aura':
      /* AURA：光环：对方全体每回合5%概率走错（强制随机走一步）
         实现思路：每回合5%概率，给对方加 confuseForcedMove（与B王指鹿为马共用机制） */
      if(event==='turn_start'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        const oc = mc===RED ? BLACK : RED;
        /* 仅在对方回合开始时触发 */
        if(state.currentPlayer !== oc) break;
        if(state.predForcedMoves && state.predForcedMoves[oc]) break; /* 已有强制走法 */
        if(Math.random() > 0.05) break;
        /* 随机选对方一颗非王棋子，强制随机走一步 */
        const oppPieces = [];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===oc && p.type!==T.KING){
            oppPieces.push({r,c,p});
          }
        }
        if(oppPieces.length === 0) break;
        /* 随机选一颗有合法走法的棋子 */
        const shuffled = oppPieces.sort(() => Math.random() - 0.5);
        let forcedMove = null;
        for(const item of shuffled){
          const moves = getLegalMoves(state.board, item.r, item.c);
          if(moves.length > 0){
            const mv = moves[Math.floor(Math.random() * moves.length)];
            forcedMove = {
              color: oc,
              from: { r: item.r, c: item.c },
              to: { r: mv.r, c: mv.c }
            };
            break;
          }
        }
        if(forcedMove){
          if(!state.predForcedMoves) state.predForcedMoves={};
          state.predForcedMoves[oc] = forcedMove;
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>搞子气场</b> 对方5%概率走错（被搞了）');
          if(typeof showProcNotice==='function') showProcNotice('搞子气场触发！', '对方棋子被搞了，强制随机走一步', 'proc');
        }
      }
      break;
    case 'p_unconventional':
      /* PERIODIC：每3回合己方攻击最高的棋子获得攻击+30%（2回合） */
      if(event==='periodic'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        let target = null, maxAtk = -1;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && p.type!==T.KING){
            const atk = (p.atk||0) + Math.floor((p.charAtk||0)/10);
            if(atk > maxAtk){ maxAtk = atk; target = p; }
          }
        }
        if(target){
          addBuff(target, 'attackBoost', Math.floor(maxAtk * 0.30), 2, false, false);
          if(typeof addBattleLog==='function') addBattleLog('passive', '<b>不按套路</b> 己方攻击最高棋子获得攻击+30%（2回合）');
          if(typeof showProcNotice==='function') showProcNotice('不按套路', '己方攻击最高棋子+30%攻击', 'proc');
        }
      }
      break;

    /* ===== v34: 通天教主（混元大罗金仙）===== */
    /* 诛仙剑意：每回合开始，给敌方攻击最高的非帅棋子施加"诛仙剑意"（1回合）
       被标记棋子：受伤+30%、无法闪避、防御-30%（剑意压制，必死之局） */
    case 'p_zhuxian_aura':
      if(event==='aura'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        const oc = mc===RED ? BLACK : RED;
        /* 找敌方攻击最高的非帅棋子 */
        let target=null, maxAtk=0, bestR=-1, bestC=-1;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===oc && p.type!==T.KING){
            const atk = (p.atk||0) + Math.floor((p.charAtk||0)/10);
            if(atk>maxAtk){ maxAtk=atk; target=p; bestR=r; bestC=c; }
          }
        }
        if(target){
          /* 施加诛仙剑意（1回合）：受伤+30%、防御-30%、无法闪避 */
          addBuff(target, 'zhuxianIntent', 0.3, 1);
          speakTaunt('诛仙剑意！最强之敌亦为剑下亡魂！','self');
          if(typeof addBattleLog==='function') addBattleLog('passive', `<b>诛仙剑意</b> 触发！敌方攻击最高棋子（${bestR+1}行${bestC+1}列）受伤+30%·防御-30%·禁闪（1回合）`);
          /* 棋盘高亮 */
          if(typeof highlightPieces==='function'){
            highlightPieces([{r:bestR, c:bestC, label:'诛仙剑意', color:'#1a1a2e'}], 4000);
          }
        }
      }
      break;
    /* 截教道统：己方棋子被吃时，己方全体获"道统不灭"攻击+15%（2回合，可叠加3层），
       并召唤1颗"复仇仙兵"到空位（HP=60/atk=30/def=15，2回合后消散） */
    case 'p_jiejiao':
      if(event==='on_captured'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        /* 己方全体道统不灭（攻击+15%，2回合）*/
        /* 用 daoLineage buff 类型，与 attackBoost 区分以便叠加机制识别 */
        addTeamBuff(state.board, mc, 'daoLineage', 15, 2);
        speakTaunt('截教道统！弟子陨落，万仙复仇！','self');
        if(typeof addBattleLog==='function') addBattleLog('passive', '<b>截教道统</b> 己方全体道统不灭（攻击+15%，2回合，可叠加3层）');
        /* 召唤1颗复仇仙兵到空位（突破规则）*/
        const emptyCells=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          if(!state.board[r][c]) emptyCells.push({r,c});
        }
        if(emptyCells.length>0){
          /* 选择最接近战场中心的空位 */
          emptyCells.sort((a,b)=>{
            const aDist=Math.abs(a.r-5)+Math.abs(a.c-4);
            const bDist=Math.abs(b.r-5)+Math.abs(b.c-4);
            return aDist-bDist;
          });
          const cell=emptyCells[0];
          const summonCharId=mc===state.playerColor ? state.character : (state.gameMode==='pvp' ? (mc===RED?state.pvpRedChar:state.pvpBlackChar) : state.character);
          const bonus = summonCharId ? getCharBonus(summonCharId) : null;
          const baseHp=60;
          state.board[cell.r][cell.c]={
            type: T.PAWN, player: mc,
            hp: baseHp, maxHp: baseHp,
            atk: 30, def: 15, ptype: 'special',
            charId: summonCharId,
            heroType: bonus ? bonus.heroType : HERO_TYPE.STRENGTH,
            charAtk: bonus ? bonus.charAtk : 0,
            charDef: bonus ? bonus.charDef : 0,
            charInt: bonus ? bonus.charInt : 0,
            dodgeChance: bonus ? (bonus.dodgeChance||0) : 0,
            counterMul: bonus ? (bonus.counterMul||1.0) : 1.0,
            atkTrueDmgMul: bonus ? (bonus.atkTrueDmgMul||0) : 0,
            _immortalSoldier: true,
            _immortalTurnsLeft: 2  /* 2 回合后消散 */
          };
          if(typeof addBattleLog==='function') addBattleLog('passive', `<b>截教道统</b> 召唤复仇仙兵至 ${cell.r+1}行${cell.c+1}列（突破规则）`);
          if(typeof highlightPieces==='function'){
            highlightPieces([{r:cell.r, c:cell.c, label:'复仇仙兵', color:'#1a1a2e'}], 4000);
          }
        }
      }
      break;

    /* v34: 通天威压 — 每4回合：敌方全体防御-50%+沉默（无法使用技能）1回合 */
    case 'p_tongtian_pressure':
      if(event==='periodic'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        const oc = mc===RED ? BLACK : RED;
        /* 敌方全体防御-50%（1回合）*/
        addTeamBuff(state.board, oc, 'defReduce', 0.5, 1);
        /* 全局沉默（无法使用技能，1回合）— 设置 oppSkillBlockedColor 让 canUseSkill 返回 false */
        state.oppSkillBlockedColor = oc;
        state.silenceTurns = Math.max(state.silenceTurns||0, 1);
        speakTaunt('通天威压！镇压天地！尔等技能，尽皆封印！','self');
        if(typeof addBattleLog==='function') addBattleLog('passive', '<b>通天威压</b> 敌方全体防御-50%+沉默（无法使用技能，1回合）');
        if(typeof highlightPieces==='function'){
          const hl=[];
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            const p=state.board[r][c];
            if(p && p.player===oc) hl.push({r,c,label:'通天威压',color:'#1a1a2e'});
          }
          if(hl.length) highlightPieces(hl, 4000);
        }
      }
      break;

    /* v34: 混元金仙 — 每3回合：己方全体获"金仙之体"（1回合：攻击+50%、防御+50%、免疫负面）*/
    case 'p_hunyuan_golden':
      if(event==='periodic'){
        const mc = myColorForChar(charId);
        if(mc!==RED && mc!==BLACK) break;
        /* 己方全体金仙之体（1回合）— goldenImmortal buff 在 calcDamage 中提供攻防+50%+免疫负面 */
        addTeamBuff(state.board, mc, 'goldenImmortal', 1, 1);
        speakTaunt('混元金仙！万法不侵！金仙之体，镇压万邪！','self');
        if(typeof addBattleLog==='function') addBattleLog('passive', '<b>混元金仙</b> 己方全体获金仙之体（1回合：攻击+50%、防御+50%、免疫所有负面buff）');
        if(typeof highlightPieces==='function'){
          const hl=[];
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            const p=state.board[r][c];
            if(p && p.player===mc) hl.push({r,c,label:'金仙之体',color:'#1a1a2e'});
          }
          if(hl.length) highlightPieces(hl, 4000);
        }
      }
      break;
  }
}

/* ===== 辅助函数 ===== */

/* v16: 给指定角色的指定类型棋子加 buff（光环被动使用）
   pieceTypes: 棋子类型数组（如 [T.ADVISOR, T.ELEPHANT]），null 表示全体
   v22 P2 Bug 1: 新增 isAura 参数，光环 buff 标记 _aura 避免被 tickBuffs 递减清除。 */
function addBuffToPlayerPieces(charId, type, value, duration, pieceTypes, isAura){
  const myColor = myColorForChar(charId);
  if(!myColor) return;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = state.board[r][c];
    if(p && p.player===myColor && (!pieceTypes || pieceTypes.indexOf(p.type)>=0)){
      addBuff(p, type, value, duration, isAura);
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
  /* v22 修复 Bug 6（被动技能）：p_revenge 既是 B王三英被动也是刘佳伟玩家被动，
     原列表包含 p_revenge 会导致刘佳伟的 p_revenge 在 oppPassiveDisabled>0 时被误屏蔽。
     现移除 p_revenge — B王三英的 p_revenge 由 getBkingPassives 直接处理，
     不依赖 isBkingPassive 判断（passiveState.bkingDisabled 单独控制 B王被动屏蔽）。 */
  return ['p_aura','p_shameless','p_kingaura','p_combo'].includes(passiveId);
}

/* v21: 检查目标角色是否免疫沉默/禁锢类技能（p_bold 永久免疫，p_shameless 每局2次）。
   v23 P0-8: 原 p_shameless 用 immunityUsed 布尔标记，每局只能免疫1次，
   与 data.js 描述"每局2次"不符。改用 immunityCount 计数器，每局2次。
   返回 true 表示免疫成功（消耗免疫次数），false 表示不免疫。
   供 game.js 的 blockOppSkill() 在 cast silence/lock 时调用。 */
function tryConsumeSilenceImmunity(charId){
  if(!charId) return false;
  /* 玩家方角色被动（p_bold / p_shameless） */
  const ap=getActivePassives(charId);
  if(ap.some(p=>p.id==='p_bold')){
    return true; /* p_bold：永久免疫，每次都生效 */
  }
  /* v23 P0-8: p_shameless 改为计数器（每局2次），沉默/禁锢共享次数 */
  passiveState.immunityCount = passiveState.immunityCount || {};
  if(ap.some(p=>p.id==='p_shameless')){
    const cnt = passiveState.immunityCount[charId+'_shameless'] || 0;
    if(cnt < 2){
      passiveState.immunityCount[charId+'_shameless'] = cnt + 1;
      return true;
    }
    return false;
  }
  /* B王被动中的 p_shameless（B王作为被沉默方时） */
  if(charId==='bking'){
    const bp=getBkingPassives();
    if(bp.some(p=>p.id==='p_shameless')){
      const cnt = passiveState.immunityCount['bking_shameless'] || 0;
      if(cnt < 2){
        passiveState.immunityCount['bking_shameless'] = cnt + 1;
        return true;
      }
    }
  }
  return false;
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
          /* v27: 注入 charId/heroType/dodgeChance/counterMul/atkTrueDmgMul */
          charId: charId || null, heroType: bonus.heroType,
          charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt,
          dodgeChance: bonus.dodgeChance, counterMul: bonus.counterMul, atkTrueDmgMul: bonus.atkTrueDmgMul,
          /* v31-fix P2: 标记 _reichApplied=true，避免 p_reich 光环重复加 +30 maxHp */
          _reichApplied: true
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
          /* v27: 注入 charId/heroType/dodgeChance/counterMul/atkTrueDmgMul */
          charId: charId || null, heroType: bonus.heroType,
          charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt,
          dodgeChance: bonus.dodgeChance, counterMul: bonus.counterMul, atkTrueDmgMul: bonus.atkTrueDmgMul,
          /* v31-fix P2: 标记 _reichApplied=true，避免 p_reich 光环重复加 +30 maxHp */
          _reichApplied: true
        };
        return;
      }
    }
  }
}

/* 揭示对方最强子 — v20: 改写 threatMarks（有渲染），原 revealedPiece 只写不读 */
function revealStrongestPiece(oppColor){
  let best=null;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(p&&p.player===oppColor&&p.type!==T.KING){
      if(!best||PIECE_VALUE[p.type]>PIECE_VALUE[best.p.type]) best={r,c,p};
    }
  }
  if(best) state.threatMarks=[{r:best.r,c:best.c}];
}

/* 清除对方增益
   v22 修复 Bug 7（被动技能）：原清除的是己方 debuff（bkingAtkDebuff/playerCannotCapture
   都是加在玩家身上的不利状态），与"清除对方增益"语义完全相反。
   现改为遍历对方棋子，清空其 buffs 数组（增益类 buff 全部移除）。
   charId: 触发方角色 ID，用于确定"对方"颜色（PVP 下正确）。 */
function clearOpponentBuffs(charId){
  const myColor = charId ? myColorForChar(charId) : state.playerColor;
  const oppColor = myColor===RED ? BLACK : RED;
  let cleared = 0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(p && p.player===oppColor && p.buffs && p.buffs.length>0){
      /* 仅清除增益类 buff（attackBoost/defenseBoost/ironwall/shield/immune/pierce/bkiller/executeMark/vulnerability），
         保留 debuff（weakness/defReduce/silence/lock/reflect）让对方仍受己方削弱影响 */
      const debuffTypes = ['weakness','defReduce','silence','lock','reflect','vulnerability'];
      p.buffs = p.buffs.filter(b => debuffTypes.indexOf(b.type)>=0);
      if(p.buffs.length===0) delete p.buffs;
      cleared++;
    }
  }
  speakTaunt('Debug！清除对方'+cleared+'个增益！');
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
    /* v10 弱角色增强：反吃后对方下回合全体攻击-15% */
    addTeamBuff(state.board, oc, 'weakness', 0.15, 1);
    speakTaunt('退步反击！反吃对方一子，攻势受挫！');
    renderAll();
    /* v22 P2 Bug 8: 触发对方 ON_CAPTURED 被动链（如 p_rebound/p_gumaster/p_refactor 等）。
       用 passiveState._revengeInProgress 守护，避免对方被动再次触发 revengeCapture 形成无限递归。 */
    if(!passiveState._revengeInProgress && typeof passivesOnCaptured==='function'){
      passiveState._revengeInProgress = true;
      try {
        const victimChar = charForColor(best.p.player);
        if(victimChar){
          passivesOnCaptured(victimChar, charId, best.p, null);
        }
      } finally {
        passiveState._revengeInProgress = false;
      }
    }
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
  /* v31-fix P1: p_pressure/p_kingaura 已在 passivesApplyAuras 中触发 aura 事件，
     修改 state.bkingCdIncrease/bkingSkillChanceReduce。
     此处原本冗余加一次，导致仙帝威压实际效果翻倍（玩家回合 +2 而非 +1）。
     现删除冗余累加，仅保留函数作为入口（不进行任何操作），
     避免破坏 passivesOnTurnStart 中的调用链。 */
  return;
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
   engine.js 的 calcDamage 保持纯逻辑，所有 state 相关修饰集中在此。
   v22 修复 Bug 2/3（被动技能）：原 aIsPlayer/aIsBking 仅判断 playerColor/aiColor，
   PVP 下黑方触发的 attackBoost 永不消耗，红方反而会消耗黑方的 boost；
   p_rebound/p_joke 的 bkingAtkDebuff 在 PVP 下也永不生效。
   现改为按"攻击方是否为 attackBoost 触发方"判断，且引入 attackBoostOwner 记录触发方颜色。 */
function applyPassiveCombatMods(attacker, defender, dmg){
  if(!attacker||!defender||!dmg) return dmg;
  const aChar=charForColor(attacker.player);
  const dChar=charForColor(defender.player);
  /* v22: attackBoost 触发方颜色（p_leap/p_chainatk 设置时同步记录） */
  const boostOwner = state.attackBoostOwner || state.playerColor;
  const isBoostOwner = attacker.player === boostOwner;
  let mul=1;

  /* attackBoost：触发方攻击加成（p_leap 设为2层=+40%，p_chain 每层+20%），一次性消耗 */
  if(isBoostOwner && state.attackBoost>0){
    mul *= (1 + 0.2*state.attackBoost);
    state.attackBoost=0;
    state.attackBoostOwner=null;
  }
  /* v10 弱角色增强：罗伦杰·连击 p_chainatk — 每层 +30%，最多 2 层（+60%），一次性消耗。
     使用独立 chainatkStacks 计数器，与 p_leap 的 state.attackBoost 隔离。 */
  if(isBoostOwner && state.chainatkStacks>0){
    mul *= (1 + 0.3*state.chainatkStacks);
    state.chainatkStacks=0;
    state.attackBoostOwner=null;
  }
  /* v22 修复 Bug 2（被动技能）：atkDebuff 改为按颜色分桶存储。
     p_joke/p_rebound 在 state.atkDebuffByColor[color] 累加层数，
     每次该颜色进攻消耗1层（攻击-20%）。兼容回退：若旧字段
     state.bkingAtkDebuff 仍存在，则按旧逻辑消耗并清零。 */
  if(state.atkDebuffByColor && state.atkDebuffByColor[attacker.player]>0){
    mul *= 0.8;
    state.atkDebuffByColor[attacker.player] = Math.max(0, state.atkDebuffByColor[attacker.player]-1);
  }
  /* 兼容旧字段：清理残留的 state.bkingAtkDebuff / bkingAtkDebuffTarget
     （仅当攻击方匹配旧 target 时消耗，避免误伤） */
  if(state.bkingAtkDebuff>0){
    const oldTarget = state.bkingAtkDebuffTarget || state.aiColor;
    if(attacker.player === oldTarget){
      mul *= 0.8;
      state.bkingAtkDebuff=Math.max(0, state.bkingAtkDebuff-1);
      if(state.bkingAtkDebuff<=0) state.bkingAtkDebuffTarget=null;
    }
  }

  /* v21: AURA 被动（p_aura/p_teach/p_fullmark/p_stable/p_brother/p_nemesis）
     战斗修饰统一由 buff 系统在 calcDamage 内处理，此处不再重复乘系数，
     否则光环效果会双重生效（buff 一份 + 此处一份）。 */
  void aChar; void dChar;

  dmg.defenderDmg = Math.max(1, Math.floor(dmg.defenderDmg * mul));
  return dmg;
}

/* 根据角色ID获取其颜色 */
function myColorForChar(charId){
  if(state.gameMode==='pvp'){
    /* v31-fix P2: 兜底返回 null 而非 state.playerColor，避免未知 charId 误把 buff 加到红方 */
    return state.pvpRedChar===charId?RED:(state.pvpBlackChar===charId?BLACK:null);
  }
  /* v5.0 多阵营/4v4：按 multiPlayers 找该角色对应的颜色 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.char===charId);
    if(mp) return mp.color;
    /* 回退：玩家角色 = playerColor */
    if(charId===state.character) return state.playerColor;
    return null;  /* v31-fix P2: 未知 charId 返回 null */
  }
  /* PVE：玩家角色=playerColor */
  if(charId===state.character) return state.playerColor;
  /* B王/AI = aiColor */
  if(charId==='bking') return state.aiColor;
  return null;  /* v31-fix P2: 未知 charId 返回 null，让 addBuffToPlayerPieces 提前退出 */
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
