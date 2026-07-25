/* ============================================
   engine.js — 博弈之王 · 棋盘引擎 + AI 搜索
   纯逻辑，无 UI / state 依赖，便于独立测试与调优
   依赖：data.js（常量 COLS/ROWS/RED/BLACK/T/PALACE/PIECE_VALUE）
   ============================================ */
'use strict';

/* ===== AI 超时保护 =====
   高难度（hard depth=6 / 三英战B王 +1=7）minimax 搜索空间过大，
   主线程长时间阻塞导致"思考卡死"。引入 3 秒超时 + 贪心降级。
   data.js 的 DIFFICULTIES.depth 无法修改，故在引擎层强制 cap。 */
const AI_TIMEOUT = 3000; // 3 秒超时
const AI_MAX_DEPTH = { easy: 2, medium: 3, hard: 4 }; // 原 hard:6→4
let aiStartTime = 0;

/* v27-hero-rebalance: AI 模拟标志
   calcDamage 中的敏捷系闪避（10% 随机）仅在真实战斗（doMove）中触发，
   AI 模拟（minimax/getBestMove/makeMv）时禁用，保证搜索结果稳定。 */
let isAICombatSimulation = false;

/* ===== 工具 ===== */
function inBoard(r,c){ return r>=0&&r<ROWS&&c>=0&&c<COLS; }
function inPalace(r,c,p){ const x=PALACE[p]; if(!x) return false; return r>=x.r0&&r<=x.r1&&c>=x.c0&&c<=x.c1; }
/* 颜色对应的"半区方向"：red/blue 在底部（向上推进），black/green 在顶部（向下推进） */
function isBottomSide(p){ return p===RED || p===BLUE; }
function isAcrossRiver(r,p){ return isBottomSide(p) ? r<=4 : r>=5; }
function cloneBoard(b){
  /* v16: 深克隆 buffs 数组，避免 doMove 修改 buff（消耗 shield/executeMark）
     时通过共享引用污染 boardSnapshots（仙帝回溯快照失效） */
  return b.map(r=>r.map(c=>{
    if(!c) return null;
    const cp = {...c};
    if(c.buffs) cp.buffs = c.buffs.map(b=>({...b}));
    return cp;
  }));
}

/* 角色属性加成：从 charId 提取 charAtk/charDef/charInt
   v10-skill-redesign: 根据 heroType（力量/敏捷/智力）应用 atkMul/defMul，
   并返回 hpMul/skillDmgMul/cdReduce 供 createInitialBoard、canUseSkill、
   applyIntToSkillDamage 使用。
   若 charId 为空或找不到对应角色，返回全 0（不影响原有逻辑） */
function getCharBonus(charId){
  const ch = charId && typeof CHARACTERS!=='undefined' && CHARACTERS[charId] ? CHARACTERS[charId] : null;
  if(!ch){
    return { charAtk:0, charDef:0, charInt:0, heroType:null, hpMul:1.0, skillDmgMul:1.0, cdReduce:0, dodgeChance:0, counterMul:1.0, atkTrueDmgMul:0 };
  }
  const baseAtk = ch.stats?.atk || 0;
  const baseDef = ch.stats?.def || 0;
  const baseInt = ch.stats?.int || 0;
  const heroType = ch.heroType || HERO_TYPE.STRENGTH;
  const bonus = HERO_TYPE_BONUS[heroType] || HERO_TYPE_BONUS.strength;
  return {
    charAtk: Math.floor(baseAtk * (bonus.atkMul || 1.0)),
    charDef: Math.floor(baseDef * (bonus.defMul || 1.0)),
    charInt: baseInt,
    heroType: heroType,
    hpMul: bonus.hpMul || 1.0,
    skillDmgMul: bonus.skillDmgMul || 1.0,
    cdReduce: bonus.cdReduce || 0,
    /* v27: 新增字段 */
    dodgeChance: bonus.dodgeChance || 0,        /* 敏捷系闪避概率 */
    counterMul: bonus.counterMul || 1.0,        /* 力量系反击伤害乘数 */
    atkTrueDmgMul: bonus.atkTrueDmgMul || 0,    /* 智力系普攻真实伤害系数 */
    extraMoveRange: bonus.extraMoveRange || 0
  };
}

/* ===== v10: 谋属性 (int) 系统工具函数 =====
   谋属性影响：buff 持续回合 / CD / 技能伤害 / 真实伤害 / 光环强度
   阈值：int≥100 最强，≥80 次之，≥50 一般，否则无加成 */
function getIntBonus(charId){
  const ch = charId && typeof CHARACTERS!=='undefined' && CHARACTERS[charId] ? CHARACTERS[charId] : null;
  return ch ? (ch.stats?.int || 0) : 0;
}
/* 谋属性影响 buff 持续回合数：int≥100 +3, ≥80 +2, ≥50 +1, 否则 +0 */
function getIntBuffDurationBonus(charId, baseDuration){
  const int = getIntBonus(charId);
  if(int >= 100) return baseDuration + 3;
  if(int >= 80) return baseDuration + 2;
  if(int >= 50) return baseDuration + 1;
  return baseDuration;
}
/* 谋属性影响 CD 减少：int≥100 CD-2, ≥80 CD-1, 否则 CD-0 */
function getIntCdReduction(charId){
  const int = getIntBonus(charId);
  if(int >= 100) return 2;
  if(int >= 80) return 1;
  return 0;
}
/* 谋属性影响技能伤害：基础伤害 × (1 + int/100)
   v10-skill-redesign: 叠加 heroType（智力系 +50%）的 skillDmgMul */
function applyIntToSkillDamage(charId, baseDamage){
  const int = getIntBonus(charId);
  const charBonus = getCharBonus(charId);
  const skillDmgMul = charBonus.skillDmgMul || 1.0;
  return Math.floor(baseDamage * (1 + int / 100) * skillDmgMul);
}
/* 谋属性影响真实伤害：附带 int × 0.5 真实伤害 */
function getIntTrueDamage(charId){
  const int = getIntBonus(charId);
  return Math.floor(int * 0.5);
}
/* 谋属性影响光环强度：×(1 + int/200) */
function applyIntToAuraValue(charId, baseValue){
  const int = getIntBonus(charId);
  return Math.floor(baseValue * (1 + int / 200));
}

/* v12/v13: 计算棋子的有效属性（基础 + 角色加成 + buff 影响）
   用于 HUD 状态栏与棋子详情弹窗显示，与 calcDamage 中的计算保持一致。
   v13: 新增 executeMark/reflect/immune buff 类型的显示支持。
   返回：{
     baseAtk, baseDef,           // 棋子基础攻防
     charAtkBonus, charDefBonus, // 角色属性加成（/10）
     effAtk, effDef,             // 最终攻防（含 buff 影响）
     atkMul, defMul,             // buff 乘数（1 = 无影响）
     atkAdd, defAdd,             // buff 加法值（0 = 无影响）
     buffs: [{type, name, value, duration, desc}]  // buff 详情列表
   } */
function getPieceEffectiveStats(piece){
  if(!piece) return null;
  const baseAtk = piece.atk || 0;
  const baseDef = piece.def || 0;
  const charAtkBonus = Math.floor((piece.charAtk || 0) / 10);
  const charDefBonus = Math.floor((piece.charDef || 0) / 10);
  /* buff 影响：默认乘 1，加 0 */
  let atkMul = 1, defMul = 1, atkAdd = 0, defAdd = 0;
  const buffDetails = [];
  if(piece.buffs && piece.buffs.length){
    for(const b of piece.buffs){
      const detail = { type:b.type, duration:b.duration, value:b.value||0 };
      switch(b.type){
        case 'weakness':
          atkMul *= (1 - (b.value || 0.3));
          detail.name = '虚弱';
          detail.desc = `攻击-${Math.round((b.value||0.3)*100)}%`;
          break;
        case 'ironwall':
          defMul *= 2;  /* 铁壁：防御翻倍 */
          detail.name = '铁壁';
          detail.desc = '防御×2';
          break;
        case 'shield':
          detail.name = '护盾';
          detail.desc = `吸收${b.value||80}伤害`;
          break;
        case 'silence':
          detail.name = '沉默';
          detail.desc = '无法使用技能';
          break;
        case 'lock':
          detail.name = '禁锢';
          detail.desc = '无法移动';
          break;
        case 'attackBoost':
          atkAdd += (b.value || 20);
          detail.name = '攻击强化';
          detail.desc = `攻击+${b.value||20}`;
          break;
        case 'defenseBoost':
          defAdd += (b.value || 20);
          detail.name = '防御强化';
          detail.desc = `防御+${b.value||20}`;
          break;
        case 'defReduce': /* v17: 防御削弱（乘算，如 -30% 防御） */
          defMul *= (1 - (b.value || 0.3));
          detail.name = '破甲';
          detail.desc = `防御-${Math.round((b.value||0.3)*100)}%`;
          break;
        case 'executeMark':
          detail.name = '必中标记';
          detail.desc = `伤害+${Math.round((b.value||0.5)*100)}%`;
          break;
        case 'reflect':
          detail.name = '反伤';
          detail.desc = `反弹${Math.round((b.value||0.3)*100)}%伤害`;
          break;
        case 'immune':
          detail.name = '无敌';
          detail.desc = '免疫所有伤害';
          break;
        /* v30-fix: 补全 buff 显示 */
        case 'vulnerability':
          detail.name = '易伤';
          detail.desc = `受到伤害+${Math.round((b.value||0.5)*100)}%`;
          break;
        case 'trueDmgBoost':
          detail.name = '真伤强化';
          detail.desc = `攻击附带${b.value||20}真实伤害`;
          break;
        case 'preyMark':
          detail.name = '猎物标记';
          detail.desc = '被吃时敌方回血';
          break;
        /* v34: 通天教主机制 buff 显示 */
        case 'zhuxianMark':
          detail.name = '诛仙·剑下亡魂';
          detail.desc = `易伤+${Math.round((b.value||0.5)*100)}%·禁疗·禁闪·血<50%必斩`;
          break;
        case 'zhuxianIntent':
          defMul *= (1 - (b.value || 0.3));  /* 防御削减 */
          detail.name = '诛仙剑意';
          detail.desc = `易伤+${Math.round((b.value||0.3)*100)}%·防御-${Math.round((b.value||0.3)*100)}%·禁闪`;
          break;
        case 'goldenImmortal':
          atkMul *= 1.5; defMul *= 1.5;  /* 攻防+50% */
          detail.name = '金仙之体';
          detail.desc = '攻+50%·防+50%·免疫负面';
          break;
        case 'daoLineage':
          atkAdd += (b.value || 15);
          detail.name = '道统不灭';
          detail.desc = `攻击+${b.value||15}（可叠加）`;
          break;
        case 'wanxianBlessing':
          atkMul *= 1.25;
          detail.name = '万仙加持';
          detail.desc = '攻击+25%·每回合回10%血';
          break;
        default:
          detail.name = b.type || '未知';
          detail.desc = '';
      }
      buffDetails.push(detail);
    }
  }
  const effAtk = Math.max(0, Math.floor((baseAtk + charAtkBonus) * atkMul + atkAdd));
  const effDef = Math.max(0, Math.floor((baseDef + charDefBonus) * defMul + defAdd));
  /* v31-fix P0: HUD 也叠加天气修饰，让玩家看到的数值与实际战斗一致 */
  if(typeof getWeatherEffectForPiece==='function'){
    const w = getWeatherEffectForPiece(piece);
    if(w){
      /* 攻击力：晴 +5%，风 进攻型 +10% */
      const wAtkMul = (w.atkMul||1) * (piece.ptype==='striker' ? (w.strikerAtkMul||1) : 1);
      /* 防御力：雾 防守型 +30% */
      const wDefMul = (w.defMul||1) * (piece.ptype==='defender' ? (w.defenderDefMul||1) : 1);
      return {
        baseAtk, baseDef, charAtkBonus, charDefBonus,
        effAtk: Math.max(0, Math.floor(effAtk * wAtkMul)),
        effDef: Math.max(0, Math.floor(effDef * wDefMul)),
        atkMul, defMul, atkAdd, defAdd, buffs: buffDetails
      };
    }
  }
  return {
    baseAtk, baseDef,
    charAtkBonus, charDefBonus,
    effAtk, effDef,
    atkMul, defMul, atkAdd, defAdd,
    buffs: buffDetails
  };
}

/* ===== 棋盘初始化 =====
   redCharId/blackCharId 可选：红/黑方棋子继承的角色 ID，用于注入角色属性加成 */
function createInitialBoard(redCharId, blackCharId){
  const b = Array.from({length:ROWS},()=>Array(COLS).fill(null));
  const layout = [
    T.ROOK,T.HORSE,T.ELEPHANT,T.ADVISOR,T.KING,T.ADVISOR,T.ELEPHANT,T.HORSE,T.ROOK
  ];
  /* 构造棋子：注入 PIECE_STATS 的 hp/maxHp/atk/def/ptype（兵种类型）
     + 角色属性加成 charAtk/charDef/charInt
     v10-skill-redesign: 力量系 hpMul=1.3，棋子最大生命值按 heroType 加成放大
     v27-hero-rebalance: 注入 charId 和 heroType 字段，供 calcDamage 识别角色类型
       （力量系反击+20%、敏捷系闪避+10%、智力系普攻附带int×0.3真伤） */
  const mk = (type,player,charId) => {
    const s = PIECE_STATS[type];
    const bonus = getCharBonus(charId);
    const hp = Math.floor(s.hp * (bonus.hpMul || 1.0));
    return { type, player, hp:hp, maxHp:hp, atk:s.atk, def:s.def, ptype:s.type,
             charId: charId || null, heroType: bonus.heroType,
             charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt,
             dodgeChance: bonus.dodgeChance, counterMul: bonus.counterMul, atkTrueDmgMul: bonus.atkTrueDmgMul };
  };
  for(let c=0;c<9;c++) b[0][c]=mk(layout[c],BLACK,blackCharId);
  b[2][1]=mk(T.CANNON,BLACK,blackCharId); b[2][7]=mk(T.CANNON,BLACK,blackCharId);
  for(const c of [0,2,4,6,8]) b[3][c]=mk(T.PAWN,BLACK,blackCharId);
  for(let c=0;c<9;c++) b[9][c]=mk(layout[c],RED,redCharId);
  b[7][1]=mk(T.CANNON,RED,redCharId); b[7][7]=mk(T.CANNON,RED,redCharId);
  for(const c of [0,2,4,6,8]) b[6][c]=mk(T.PAWN,RED,redCharId);
  return b;
}
function applyHandicap(board,h){
  if(h==='one-horse') board[9][1]=null;
  else if(h==='two-horses'){ board[9][1]=null; board[9][7]=null; }
  else if(h==='one-rook') board[9][0]=null;
}

/* ===== 多阵营棋盘初始化 =====
   factions: 颜色数组，例如 [RED,BLACK] / [RED,BLACK,BLUE] / [RED,BLACK,BLUE,GREEN]
   - 2 阵营：标准布局（red 底、black 顶）
   - 3 阵营：red 底、black 顶，blue 在棋盘左侧中部（cols 0-2）放置精简阵容
   - 4 阵营：red 底、black 顶，blue 左侧中部、green 右侧中部（cols 6-8）
   blue/green 拥有独立的 3x3 九宫格（左侧 cols 0-2 / 右侧 cols 6-8），
   避免与 red/black 九宫格冲突，也避免 blue/green 王对脸。
   为保持棋盘平衡，3-4 阵营使用精简阵容（王+仕+车+马+炮+兵）。 */
function createMultiFactionBoard(factions, charMap){
  if(!factions||factions.length<3) return createInitialBoard();
  const b = Array.from({length:ROWS},()=>Array(COLS).fill(null));
  const cm = charMap || {};
  /* 阵营数量：放置主阵营（red 底、black 顶） */
  if(factions.indexOf(RED)>=0) placeStandardSide(b, RED, 9, 7, 6, cm[RED]);
  if(factions.indexOf(BLACK)>=0) placeStandardSide(b, BLACK, 0, 2, 3, cm[BLACK]);
  /* 额外阵营放置在棋盘左右两侧中部，精简阵容 */
  if(factions.indexOf(BLUE)>=0) placeMiniSquad(b, BLUE, 5, 1, cm[BLUE]);  /* 王在 (5,1) */
  if(factions.indexOf(GREEN)>=0) placeMiniSquad(b, GREEN, 4, 7, cm[GREEN]); /* 王在 (4,7) */
  return b;
}
/* 标准一侧布阵（与 createInitialBoard 一致）
   charId 可选：该侧棋子继承的角色 ID */
function placeStandardSide(b, player, kingRow, cannonRow, pawnRow, charId){
  const layout = [T.ROOK,T.HORSE,T.ELEPHANT,T.ADVISOR,T.KING,T.ADVISOR,T.ELEPHANT,T.HORSE,T.ROOK];
  /* v27: 注入 charId/heroType/dodgeChance/counterMul/atkTrueDmgMul */
  const mk = (type,p) => {
    const s = PIECE_STATS[type];
    const bonus = getCharBonus(charId);
    const hp = Math.floor(s.hp * (bonus.hpMul || 1.0));
    return { type, player:p, hp:hp, maxHp:hp, atk:s.atk, def:s.def, ptype:s.type,
             charId: charId || null, heroType: bonus.heroType,
             charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt,
             dodgeChance: bonus.dodgeChance, counterMul: bonus.counterMul, atkTrueDmgMul: bonus.atkTrueDmgMul };
  };
  for(let c=0;c<9;c++) b[kingRow][c]=mk(layout[c],player);
  b[cannonRow][1]=mk(T.CANNON,player); b[cannonRow][7]=mk(T.CANNON,player);
  for(const c of [0,2,4,6,8]) b[pawnRow][c]=mk(T.PAWN,player);
}
/* 精简阵容：1 王 + 2 仕 + 1 车 + 1 马 + 1 炮 + 2 兵
   kingCol 必须在该阵营九宫格列范围内（blue:0-2 / green:6-8）
   charId 可选：该侧棋子继承的角色 ID */
function placeMiniSquad(b, player, row, kingCol, charId){
  /* v27: 注入 charId/heroType/dodgeChance/counterMul/atkTrueDmgMul */
  const mk = (type,p) => {
    const s = PIECE_STATS[type];
    const bonus = getCharBonus(charId);
    const hp = Math.floor(s.hp * (bonus.hpMul || 1.0));
    return { type, player:p, hp:hp, maxHp:hp, atk:s.atk, def:s.def, ptype:s.type,
             charId: charId || null, heroType: bonus.heroType,
             charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt,
             dodgeChance: bonus.dodgeChance, counterMul: bonus.counterMul, atkTrueDmgMul: bonus.atkTrueDmgMul };
  };
  b[row][kingCol]=mk(T.KING,player);
  /* 仕在王两侧（同列范围） */
  if(kingCol>0) b[row][kingCol-1]=mk(T.ADVISOR,player);
  if(kingCol<COLS-1) b[row][kingCol+1]=mk(T.ADVISOR,player);
  /* 马、炮、车、兵环绕 */
  const side = kingCol<3 ? -1 : 1; /* blue 在左侧外延，green 在右侧外延 */
  const ext = kingCol + side*3;
  if(ext>=0 && ext<COLS) b[row][ext]=mk(T.ROOK,player);
  const horse = kingCol + side*2;
  if(horse>=0 && horse<COLS) b[row-1 ? row-1 : row][horse]=mk(T.HORSE,player);
  /* 在王的前后放置炮和兵 */
  if(row+1<ROWS) b[row+1][kingCol]=mk(T.CANNON,player);
  if(row-1>=0) b[row-1][kingCol]=mk(T.PAWN,player);
  if(row-1>=0 && kingCol+side>=0 && kingCol+side<COLS) b[row-1][kingCol+side]=mk(T.PAWN,player);
}

/* ===== 走法生成 ===== */
function getPieceMoves(board,r,c){
  const p=board[r][c]; if(!p) return [];
  /* v35-fix P0-Bug1: lock buff 禁锢生效 — 有 lock buff 的棋子无法移动
     但 goldenImmortal（金仙之体）免疫 lock */
  if(p.buffs && p.buffs.some(b=>b.type==='lock')){
    const hasGolden = p.buffs.some(b=>b.type==='goldenImmortal');
    if(!hasGolden) return [];
  }
  switch(p.type){
    case T.KING: return getKingMoves(board,r,c,p.player);
    case T.ADVISOR: return getAdvisorMoves(board,r,c,p.player);
    case T.ELEPHANT: return getElephantMoves(board,r,c,p.player);
    case T.HORSE: return getHorseMoves(board,r,c,p.player);
    case T.ROOK: return getRookMoves(board,r,c,p.player);
    case T.CANNON: return getCannonMoves(board,r,c,p.player);
    case T.PAWN: return getPawnMoves(board,r,c,p.player);
  }
  return [];
}
function getKingMoves(b,r,c,p){
  const m=[];
  for(const[dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    const nr=r+dr,nc=c+dc;
    if(!inBoard(nr,nc)||!inPalace(nr,nc,p)) continue;
    const t=b[nr][nc]; if(!t||t.player!==p) m.push({row:nr,col:nc});
  }
  return m;
}
function getAdvisorMoves(b,r,c,p){
  const m=[];
  for(const[dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
    const nr=r+dr,nc=c+dc;
    if(!inBoard(nr,nc)||!inPalace(nr,nc,p)) continue;
    const t=b[nr][nc]; if(!t||t.player!==p) m.push({row:nr,col:nc});
  }
  return m;
}
function getElephantMoves(b,r,c,p){
  const m=[];
  for(const[dr,dc] of [[-2,-2],[-2,2],[2,-2],[2,2]]){
    const nr=r+dr,nc=c+dc;
    if(!inBoard(nr,nc)) continue;
    if(isBottomSide(p)&&nr<5) continue; if(!isBottomSide(p)&&nr>4) continue;
    if(b[r+dr/2][c+dc/2]) continue;
    const t=b[nr][nc]; if(!t||t.player!==p) m.push({row:nr,col:nc});
  }
  return m;
}
function getHorseMoves(b,r,c,p){
  const m=[];
  const dirs=[[-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],[-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1]];
  for(const[dr,dc,br,bc] of dirs){
    const nr=r+dr,nc=c+dc;
    if(!inBoard(nr,nc)||b[r+br][c+bc]) continue;
    const t=b[nr][nc]; if(!t||t.player!==p) m.push({row:nr,col:nc});
  }
  return m;
}
function getRookMoves(b,r,c,p){
  const m=[];
  for(const[dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    let nr=r+dr,nc=c+dc;
    while(inBoard(nr,nc)){
      const t=b[nr][nc];
      if(!t) m.push({row:nr,col:nc});
      else{ if(t.player!==p) m.push({row:nr,col:nc}); break; }
      nr+=dr; nc+=dc;
    }
  }
  return m;
}
function getCannonMoves(b,r,c,p){
  const m=[];
  for(const[dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    let nr=r+dr,nc=c+dc,jumped=false;
    while(inBoard(nr,nc)){
      const t=b[nr][nc];
      if(!jumped){ if(!t) m.push({row:nr,col:nc}); else jumped=true; }
      else{ if(t){ if(t.player!==p) m.push({row:nr,col:nc}); break; } }
      nr+=dr; nc+=dc;
    }
  }
  return m;
}
function getPawnMoves(b,r,c,p){
  const m=[];
  const fwd=isBottomSide(p)?-1:1;
  const fr=r+fwd;
  if(inBoard(fr,c)){ const t=b[fr][c]; if(!t||t.player!==p) m.push({row:fr,col:c}); }
  if(isAcrossRiver(r,p)){
    for(const dc of [-1,1]){
      const nc=c+dc;
      if(inBoard(r,nc)){ const t=b[r][nc]; if(!t||t.player!==p) m.push({row:r,col:nc}); }
    }
  }
  return m;
}
function findKing(b,p){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x=b[r][c]; if(x&&x.type===T.KING&&x.player===p) return {row:r,col:c};
  }
  return null;
}
function kingsFacing(b){
  /* 多阵营模式：检查任意两王同列且中间无棋子 */
  const kings=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x=b[r][c]; if(x&&x.type===T.KING) kings.push({row:r,col:c,player:x.player});
  }
  for(let i=0;i<kings.length;i++){
    for(let j=i+1;j<kings.length;j++){
      const a=kings[i], bb=kings[j];
      if(a.col!==bb.col) continue;
      const lo=Math.min(a.row,bb.row), hi=Math.max(a.row,bb.row);
      let blocked=false;
      for(let r=lo+1;r<=hi-1;r++) if(b[r][a.col]){ blocked=true; break; }
      if(!blocked) return true;
    }
  }
  return false;
}
function isInCheck(b,p){
  const k=findKing(b,p); if(!k) return true;
  /* 多阵营：任意非己方棋子能吃将即为将军 */
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x=b[r][c];
    if(x&&x.player!==p){
      const ms=getPieceMoves(b,r,c);
      if(ms.some(m=>m.row===k.row&&m.col===k.col)) return true;
    }
  }
  return false;
}
function getLegalMoves(b,r,c){
  const p=b[r][c]; if(!p) return [];
  return getPieceMoves(b,r,c).filter(m=>{
    const t=cloneBoard(b);
    t[m.row][m.col]=t[r][c]; t[r][c]=null;
    return !kingsFacing(t)&&!isInCheck(t,p.player);
  });
}
function hasLegalMoves(b,p){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x=b[r][c];
    if(x&&x.player===p&&getLegalMoves(b,r,c).length>0) return true;
  }
  return false;
}

/* ===== AI Minimax ===== */
function evaluateBoard(b){
  let s=0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=b[r][c]; if(!p) continue;
    let v=PIECE_VALUE[p.type];
    /* v35-fix P2-Bug6: 临时召唤棋子（诛仙剑/仙兵）价值降至30%，避免AI过度保护/攻击 */
    if(p._zhuxianSword || p._immortalSoldier) v=Math.floor(v*0.3);
    if(p.type===T.PAWN&&isAcrossRiver(r,p.player)) v+=30;
    if([T.ROOK,T.HORSE,T.CANNON].includes(p.type)) v+=(4-Math.abs(c-4))*3;
    if(p.type===T.HORSE&&(c===0||c===8)) v-=20;
    /* v5.0 战斗系统：按 HP 比例折算价值（最低保留 30%） */
    const hpRatio=(p.maxHp&&p.maxHp>0)?(p.hp/p.maxHp):1;
    v=v*(0.3+0.7*hpRatio);
    /* v16: buff 价值评估 — 有利 buff 增加价值，不利 buff 降低价值 */
    if(p.buffs){
      for(const buff of p.buffs){
        const bv = buff.value || 0;
        if(buff.type==='attackBoost'||buff.type==='ironwall'||buff.type==='executeMark'||
           buff.type==='defenseBoost'||buff.type==='immune'||buff.type==='shield'){
          v += Math.min(40, bv*0.5+10); /* 有利 buff 上限 +40 */
        } else if(buff.type==='weakness'){
          v -= 15; /* 虚弱降低价值 */
        } else if(buff.type==='defReduce'){ /* v17: 破甲降低价值 */
          v -= 12;
        }
      }
    }
    s+=(p.player===RED)?v:-v;
  }
  return s;
}
function getAllMoves(b,p){
  const all=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x=b[r][c];
    if(x&&x.player===p) for(const m of getPieceMoves(b,r,c)) all.push({fr:r,fc:c,tr:m.row,tc:m.col});
  }
  return all;
}
/* ===== v13: 统一 buff 应用辅助函数 =====
   所有技能数值加成通过 buff 挂到棋子上，calcDamage 统一读取。
   addBuff(piece, type, value, duration, isAura, permanent)：给棋子加 buff（去重合并同类）
   v16: 续期 buff 不重置 _fresh（避免 tickBuffs 跳过本回合递减导致多活 1 回合）
   v22 修复 P2 Bug 1：AURA 光环 buff 每回合刷新 duration 导致永不过期。
   现约定 isAura=true 的 buff 标记 _aura:true，tickBuffs 跳过此类 buff 的递减，
   由光环每回合重新施加时由 addBuff 合并（取 max）刷新。
   v10: 新增 permanent 参数 — permanent=true 时 duration=-1 且不打 _fresh 标记，
        tickBuffs 中 _permanent=true 的 buff 不递减也不清除。 */
function addBuff(piece, type, value, duration, isAura = false, permanent = false){
  if(!piece || !type) return;
  if(!piece.buffs) piece.buffs = [];
  /* 同类型 buff：取较高 value，刷新 duration（保留 _fresh 原值） */
  const existing = piece.buffs.find(b => b.type === type);
  if(existing){
    existing.value = Math.max(existing.value || 0, value || 0);
    if(permanent){
      existing.duration = -1;
      existing._permanent = true;
    } else if(existing.duration > 0){
      existing.duration = Math.max(existing.duration, duration);
    }
    /* v10 修复：续期时不重置 _fresh，避免 buff 多活 1 回合（_fresh 仅在新建时设置） */
    /* v33-fix P0: 删除 if(isAura) existing._aura = true;
       原代码会把一次性 buff（_aura=false）强制提权为 _aura=true，
       导致 AURA 被动（如 applyKingCommandAura 的 attackBoost）续期时
       污染 p_strategy/p_fullmark 等一次性 buff 永驻。
       修复：保持 existing._aura 原值不修改。原 buff 自然过期后，
       AURA 被动下回合会新建 _aura=true 的 buff，逻辑闭环。 */
    return;
  }
  piece.buffs.push({
    type,
    value,
    duration: permanent ? -1 : (duration || 1),
    _fresh: !permanent,
    _aura: isAura,
    _permanent: permanent
  });
  /* v22: 战报 — 新 buff 添加（仅记录有具体效果的 buff，跳过数值为 0 或负数标记） */
  if(typeof addBattleLog==='function' && piece.type && value){
    const pChar = (typeof PIECE_CHAR!=='undefined') ? PIECE_CHAR[piece.player===RED?'red':'black'][piece.type] : '?';
    const durStr = permanent ? '永久' : `${duration || 1}回合`;
    addBattleLog('buff', `<b>${pChar}</b> 获得 <b>${type}</b> 状态（${durStr}）`);
  }
}
/* 给一方全体棋子加 buff */
function addTeamBuff(board, player, type, value, duration, isAura, permanent){
  if(!board) return;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = board[r][c];
    if(p && p.player === player) addBuff(p, type, value, duration, isAura, permanent);
  }
}
/* 消耗一次性 buff（如 executeMark：攻击命中后移除） */
function consumeBuff(piece, type){
  if(!piece || !piece.buffs) return null;
  const idx = piece.buffs.findIndex(b => b.type === type);
  if(idx < 0) return null;
  const b = piece.buffs[idx];
  piece.buffs.splice(idx, 1);
  if(piece.buffs.length === 0) delete piece.buffs;
  return b;
}

/* ===== 兵种相克伤害计算（v10 重写） =====
   v13: 统一读取 buff 系统（weakness/attackBoost/executeMark/ironwall/defenseBoost/shield/immune）
   v10 新规则：
   1. 反击规则：只有 core/defender/special 反击；striker/remote 不反击
                马(h)跳跃攻击 / 相(e)斜走攻击 不触发反击
                兵(p)反击伤害 = 兵攻击力 × 0.3（其他反击者正常伤害）
   2. 车一击必杀+自损：车(r)攻击时 defenderDmg = defender.maxHp（无视防御）
                       attacker 自损 = maxHp × 0.2，immune 时全部为 0，shield 仍吸收
   3. 马真实伤害：马(h)攻击附带 15 真实伤害，不被 shield/immune 免疫
   4. 帅特色：帅受非兵攻击减伤 30%（defenderDmg × 0.7），保留兵打帅 +50%
   5. 炮加成：炮(remote)攻击 dmgMul × 1.2
   6. 保留：striker 破甲（无视 30% 防御）/ 兵受非帅攻击 -50% / 非炮打相士获虚弱
   返回 { defenderDmg, attackerDmg, attackerBuff, defenderImmune, reflectDmg,
          executeMarkBuff, shieldConsumed, attackerSelfDmg, trueDmg } */
function calcDamage(attacker, defender){
  if(!attacker || !defender) return { defenderDmg:0, attackerDmg:0, attackerBuff:null, defenderImmune:false, reflectDmg:0, executeMarkBuff:null, shieldConsumed:0, attackerSelfDmg:0, trueDmg:0, heroDodge:false };

  const aType = attacker.ptype; // 攻击方兵种类型
  const dType = defender.ptype; // 防守方兵种类型
  /* 攻击方子类型标记：车/马/相 的特殊攻击规则 */
  const aIsRook = aType === 'striker' && attacker.type === 'r';    // 车
  const aIsHorse = aType === 'striker' && attacker.type === 'h';   // 马
  const aIsElephant = aType === 'defender' && attacker.type === 'e'; // 相

  /* v27-hero-rebalance: 敏捷系被动闪避 +10%
     - 防守方为敏捷系角色（heroType='agility'）时，10% 概率闪避本次攻击
     - 闪避成功：所有伤害为 0（含真实伤害），executeMark 不消耗
     - 与 tryDodgePassive (skills.js) 中的角色专属闪避独立计算
       （角色专属闪避 30% 与 heroType 闪避 10% 互不叠加，先触发者先生效）
     - 注意：本函数是纯计算函数，不能修改 state。随机性由调用方决定是否接受。
       为保证 AI 模拟结果稳定，仅在 isAICombatSimulation=false 时生效。 */
  const defHeroType = defender.heroType;
  const defDodgeChance = defender.dodgeChance || 0;
  let heroDodge = false;
  /* v33-fix P1: 接入天气闪避加成（rain.dodgeAdj 敏捷系闪避+5%）
     将天气查询提前到 heroDodge 判断之前，先读取 dWeather.dodgeAdj */
  const aWeather = (typeof getWeatherEffectForPiece==='function') ? getWeatherEffectForPiece(attacker) : null;
  const dWeather = (typeof getWeatherEffectForPiece==='function') ? getWeatherEffectForPiece(defender) : null;
  /* v34: 诛仙标记/诛仙剑意 — 命中前先检测，存在则完全禁用闪避 */
  const hasZhuxianPre = defender.buffs && defender.buffs.some(b => b.type==='zhuxianMark' || b.type==='zhuxianIntent');
  /* v34: 金仙之体 — 免疫所有负面 buff（含虚弱/沉默/禁锢/破甲/易伤/诛仙标记）*/
  const hasGoldenPre = defender.buffs && defender.buffs.some(b => b.type==='goldenImmortal');
  /* 仅在非 AI 模拟时触发闪避（避免 AI 评估时引入随机性导致搜索不稳定） */
  if(typeof isAICombatSimulation !== 'undefined' && !isAICombatSimulation){
    let effDodgeChance = defDodgeChance;
    /* v33-fix P1: 雨 — 敏捷系闪避 +5%（dodgeAdj 字段已消费） */
    if(dWeather && dWeather.dodgeAdj && defHeroType === HERO_TYPE.AGILITY){
      effDodgeChance += dWeather.dodgeAdj;
    }
    /* v34: 诛仙标记下无法闪避（剑下亡魂，必死之局）*/
    if(!hasZhuxianPre && effDodgeChance > 0 && Math.random() < effDodgeChance){
      heroDodge = true;
    }
    /* v29-piece-diversity: 马·骑兵闪避 — 被炮攻击时 25% 闪避
       v30-rebalance: 闪避率 25% → 30%（配合马 atk/HP 增强，与炮车抗衡）
       原因：炮攻击无视 40% 防御 + dmgMul×1.1 + 打非远程不掉血，
       马（HP 120, def 20）仍可能被炮压制。
       加入 30% 闪避后，马对炮的期望胜率提升至 ~30%，
       体现"骑兵机动性高、远程难以命中"的特色。
       仅在真实战斗中触发，AI 模拟禁用以保证搜索稳定。 */
    if(!heroDodge && aType === 'remote' && defender.type === T.HORSE && !hasZhuxianPre){
      if(Math.random() < 0.30){
        heroDodge = true;
      }
    }
  }
  if(heroDodge){
    return { defenderDmg:0, attackerDmg:0, attackerBuff:null, defenderImmune:true, reflectDmg:0, executeMarkBuff:null, shieldConsumed:0, attackerSelfDmg:0, trueDmg:0, heroDodge:true };
  }

  /* 基础攻防 + 角色属性加成 */
  const aAtk = attacker.atk + (attacker.charAtk || 0) / 10;
  const aDef = attacker.def + (attacker.charDef || 0) / 10;
  const dAtk = defender.atk + (defender.charAtk || 0) / 10;
  const dDef = defender.def + (defender.charDef || 0) / 10;

  /* v31-fix P0: 天气效果查询已提前到 heroDodge 之前（见上方） */
  /* 天气命中率（雾-10%）：仅在真实战斗中掷骰，AI 模拟禁用以保证搜索稳定 */
  if(aWeather && aWeather.hitChance!==undefined && aWeather.hitChance<1){
    if(typeof isAICombatSimulation==='undefined' || !isAICombatSimulation){
      if(Math.random() > aWeather.hitChance){
        return { defenderDmg:0, attackerDmg:0, attackerBuff:null, defenderImmune:true,
                 reflectDmg:0, executeMarkBuff:null, shieldConsumed:0, attackerSelfDmg:0,
                 trueDmg:0, heroDodge:false, weatherMiss:true };
      }
    }
  }

  /* v13: 攻击方 buff 影响
     - weakness: 攻击力乘 (1-value)
     - attackBoost: 攻击力 +value
     - executeMark: 伤害乘 (1+value)（必中+50%伤害） */
  let atkMul = 1, atkAdd = 0, dmgMul = 1;
  let executeMarkBuff = null;
  let hasPierce = false;
  let trueDmg = 0; /* v30: 提前声明以支持 trueDmgBoost buff（暴怒技能真实伤害加成） */
  if(attacker.buffs){
    for(const b of attacker.buffs){
      if(b.type === 'weakness') atkMul *= (1 - (b.value || 0.3));
      else if(b.type === 'attackBoost') atkAdd += (b.value || 20);
      else if(b.type === 'overchargeAtk') atkAdd += (b.value || 0); /* v39: 布罗利溢出的气，独立 buff 类型避免污染 */
      else if(b.type === 'executeMark'){
        dmgMul *= (1 + (b.value || 0.5));
        executeMarkBuff = b; /* 记录：攻击后消耗 */
      }
      else if(b.type === 'pierce') hasPierce = true; /* v16: 破甲：禁用守方 ironwall/defenseBoost buff（基础防御仍生效） */
      /* v22 修复 Bug 10：原 bkiller 仅对 defender.player===BLACK 生效，
         PVP 下对手可能是红方。改为对攻击方的对手生效（防御方不等于攻击方所属玩家）。 */
      else if(b.type === 'bkiller' && defender.player !== attacker.player) dmgMul *= (1 + (b.value || 0.5));
      /* v34: 通天教主 — 金仙之体 攻击+50%（乘算，独立于 attackBoost 加法）*/
      else if(b.type === 'goldenImmortal') atkMul *= 1.5;
      /* v34: 通天教主 — 万仙加持 攻击+25%（乘算）*/
      else if(b.type === 'wanxianBlessing') atkMul *= 1.25;
      /* v34: 通天教主 — 道统不灭 攻击+value（加法，可叠加）*/
      else if(b.type === 'daoLineage') atkAdd += (b.value || 15);
      /* v30: trueDmgBoost — 暴怒技能真实伤害加成，独立计算不受 immune/shield 影响 */
      else if(b.type === 'trueDmgBoost') trueDmg += (b.value || 20);
    }
  }
  /* v10: 炮(remote)伤害加成 ×1.2
     v30-rebalance: ×1.2 → ×1.1（降低炮的远程压制力，给马生存空间） */
  if(aType === 'remote') dmgMul *= 1.1;
  /* v28-piece-diversity: 兵·普攻强化 — 兵攻击时 atk +15%（普攻强化，简化版过河机制） */
  if(attacker.type === T.PAWN) atkMul *= 1.15;
  /* v28-piece-diversity: 车·破釜沉舟 — 车 hp<30% 时 atk +50%（残血爆发，参考 DOTA 玻璃大炮机制）
     v30-rebalance: 残血爆发 +50% → +30%（降低车的爆发，避免过强）
     注：车一击必杀走 aIsRook 分支不读 effAtk，本加成作用于车的常规反击/特殊场景 */
  if(attacker.type === T.ROOK && (attacker.maxHp || 0) > 0 && (attacker.hp || 0) < (attacker.maxHp || 0) * 0.3){
    atkMul *= 1.3;
  }
  /* v31-fix P0: 天气攻击力修饰
     - 晴：所有棋子 atkMul ×1.05
     - 雨：远程(rangedMul=0.8)→dmgMul×0.8
     - 风：进攻型(strikerAtkMul=1.1)→atkMul×1.1 */
  if(aWeather){
    atkMul *= (aWeather.atkMul || 1);
    if(aType === 'striker') atkMul *= (aWeather.strikerAtkMul || 1);
    if(aType === 'remote') dmgMul *= (aWeather.rangedMul || 1);
  }
  const effAtk = (aAtk + atkAdd) * atkMul;

  /* v13: 防守方 buff 影响
     - ironwall: 防御 ×2
     - defenseBoost: 防御 +value
     - shield: 吸收 value 伤害
     - immune: 免疫所有伤害
     - defReduce: 防御按比例降低（破甲）
     - vulnerability: 易伤标记，被攻击时受到的伤害 ×(1+value)（玩家标记敌方棋子用）
     - v34: zhuxianMark 诛仙剑下亡魂 — 易伤+value、防御-value、无法闪避（无视 dodgeChance）
     - v34: zhuxianIntent 诛仙剑意 — 易伤+value、防御-value、无法闪避
     - v34: goldenImmortal 金仙之体 — 免疫所有负面 buff（vulnerability/defReduce/silence/lock 等失效）+防御+50% */
  let defMul = 1, defAdd = 0, shieldAbsorb = 0;
  let defenderImmune = false;
  let vulnMul = 1; /* v20: 易伤 buff — 防守方受到的伤害放大 */
  let hasZhuxianMark = false; /* v34: 诛仙标记 — 无视闪避 */
  let hasGoldenImmortal = false; /* v34: 金仙之体 — 免疫负面 */
  if(defender.buffs){
    /* 先扫描金仙之体（决定后续是否处理负面 buff）*/
    for(const b of defender.buffs){
      if(b.type === 'goldenImmortal') hasGoldenImmortal = true;
    }
    for(const b of defender.buffs){
      if(b.type === 'ironwall' && !hasPierce) defMul *= 2;        /* v16: pierce 破防 */
      else if(b.type === 'defenseBoost' && !hasPierce) defAdd += (b.value || 20); /* v16: pierce 破防 */
      else if(b.type === 'overchargeDef' && !hasPierce) defAdd += (b.value || 0); /* v39: 布罗利溢出的气防御加成 */
      else if(b.type === 'defReduce' && !hasGoldenImmortal) defMul *= (1 - (b.value || 0.3)); /* v17: 防御削弱，金仙免疫 */
      else if(b.type === 'shield') shieldAbsorb += (b.value || 80);
      else if(b.type === 'immune') defenderImmune = true;
      else if(b.type === 'vulnerability' && !hasGoldenImmortal) vulnMul *= (1 + (b.value || 0.5)); /* v20: 易伤，金仙免疫 */
      /* v34: 通天教主机制 — 诛仙剑下亡魂/诛仙剑意 */
      else if(b.type === 'zhuxianMark' || b.type === 'zhuxianIntent'){
        if(!hasGoldenImmortal){
          vulnMul *= (1 + (b.value || 0.5));  /* 易伤 */
          defMul *= (1 - (b.value || 0.3));    /* 防御削减 */
          hasZhuxianMark = true;
        }
      }
      /* v34: 金仙之体 — 防御 +50% */
      else if(b.type === 'goldenImmortal') defMul *= 1.5;
    }
  }
  /* v31-fix P0: 天气防御力修饰（雾：相/象 defenderDefMul=1.3） */
  if(dWeather){
    defMul *= (dWeather.defMul || 1);
    if(dType === 'defender') defMul *= (dWeather.defenderDefMul || 1);
  }
  const effDef = (dDef + defAdd) * defMul;

  /* v22 修复 Bug 4：反击伤害（attackerDmg）原使用 dAtk - aDef，
     完全忽略双方 buff。现为反击伤害也独立计算 buff
     （防守方作反击者读攻击向 buff，攻击方作被反击者读防御向 buff）。
     v35-fix P1-Bug3: 金仙之体免疫 weakness（反击者作为防守方时也生效） */
  const dHasGolden = defender.buffs && defender.buffs.some(b=>b.type==='goldenImmortal');
  let dAtkMul = 1, dAtkAdd = 0;
  if(defender.buffs){
    for(const b of defender.buffs){
      if(b.type === 'weakness' && !dHasGolden) dAtkMul *= (1 - (b.value || 0.3));
      else if(b.type === 'attackBoost') dAtkAdd += (b.value || 20);
      else if(b.type === 'overchargeAtk') dAtkAdd += (b.value || 0); /* v39: 布罗利溢出的气反击也加成 */
    }
  }
  const effDAtk = (dAtk + dAtkAdd) * dAtkMul;

  let aDefMul = 1, aDefAdd = 0;
  if(attacker.buffs){
    for(const b of attacker.buffs){
      if(b.type === 'ironwall') aDefMul *= 2;
      else if(b.type === 'defenseBoost') aDefAdd += (b.value || 20);
      else if(b.type === 'overchargeDef') aDefAdd += (b.value || 0); /* v39: 布罗利溢出的气 */
      else if(b.type === 'defReduce') aDefMul *= (1 - (b.value || 0.3));
    }
  }
  const effADef = (aDef + aDefAdd) * aDefMul;

  /* v10: 马真实伤害 — 无视 immune 和 shield，独立返回
     v30-rebalance: 真实伤害 15 → 20（增强马的穿透能力，与炮车抗衡）
     v30: trueDmg 已在上方 buff 循环中初始化（支持 trueDmgBoost buff 累加） */
  if(aIsHorse) trueDmg += 20;

  /* 免疫：常规伤害为 0，executeMark 不消耗（攻击未命中）
     但马的真实伤害仍然生效（保留马特色）
     v27: 返回 heroDodge:false 保持字段一致 */
  if(defenderImmune){
    return { defenderDmg:0, attackerDmg:0, attackerBuff:null, defenderImmune:true, reflectDmg:0, executeMarkBuff:null, shieldConsumed:0, attackerSelfDmg:0, trueDmg, heroDodge:false };
  }

  let defenderDmg, attackerDmg, attackerBuff = null;
  let attackerSelfDmg = 0;

  if(aIsRook){
    /* v10: 车一击必杀 — 默认 defenderDmg = defender.maxHp（无视防御、无视所有伤害修饰）
       v23: 士/相免疫一击必杀（伤害改为 maxHp×50%），帅免疫一击必杀（伤害改为 maxHp×40%）
       仅 immune / shield 能挡住；车自损 = maxHp × 0.2
       v30-rebalance: 车自损 20% → 30%（增加一击必杀的使用成本，避免过强） */
    if(defender.type === T.ADVISOR || defender.type === T.ELEPHANT){
      defenderDmg = Math.floor((defender.maxHp || 0) * 0.5);
    } else if(defender.type === T.KING){
      defenderDmg = Math.floor((defender.maxHp || 0) * 0.4);
    } else {
      defenderDmg = defender.maxHp || 0;
    }
    attackerSelfDmg = Math.floor((attacker.maxHp || 0) * 0.3);
  } else {
    /* 默认伤害：双方互扣 */
    defenderDmg = Math.max(1, Math.floor((effAtk - effDef) * dmgMul));
    /* 规则2.5: 车马(striker)破甲：无视防守方30%防御 */
    if(aType === 'striker'){
      const ignoreDef = Math.floor(effDef * 0.3);
      defenderDmg = Math.max(1, Math.floor((effAtk - (effDef - ignoreDef)) * dmgMul));
    }
    /* v28-piece-diversity: 炮·隔山打牛 — 炮攻击无视防守方 50% 防御
       v30-rebalance: 无视防御 50% → 40%（降低炮的穿透力，给马更多生存空间）
       与炮的 dmgMul×1.1 叠加，强化"远程穿透"定位 */
    if(aType === 'remote'){
      const ignoreDef = Math.floor(effDef * 0.4);
      defenderDmg = Math.max(1, Math.floor((effAtk - (effDef - ignoreDef)) * dmgMul));
    }
    /* 规则3: 兵(特殊)受非帅且非兵攻击：兵受35%减伤（v36: 50%→35%，避免等效HP过高）*/
    if(dType === 'special' && aType !== 'core' && aType !== 'special'){
      defenderDmg = Math.floor(defenderDmg * 0.65);
    }
    /* 规则6: 帅特色 — 兵打帅+50%伤害 / 非兵攻击帅减伤30% */
    if(dType === 'core'){
      if(aType === 'special'){
        defenderDmg = Math.floor(defenderDmg * 1.5);
      } else {
        defenderDmg = Math.floor(defenderDmg * 0.7);
      }
    }
    /* v20: 易伤 buff — 防守方被标记后，受到的所有伤害按比例放大（攻击命中后消耗） */
    if(vulnMul > 1){
      defenderDmg = Math.floor(defenderDmg * vulnMul);
    }
  }

  /* 规则5: 非炮打相/士(防守)：攻击方获虚弱buff（下回合攻击-30%）
     对车也生效（车打相/士同样会虚弱） */
  if(dType === 'defender' && aType !== 'remote'){
    attackerBuff = { type:'weakness', duration:1, value:0.3 };
  }

  /* v10: 反击规则 — 只有 core/defender/special 反击
     马(h)跳跃攻击 / 相(e)斜走攻击 不触发防守方反击
     兵(p)反击伤害 = 兵攻击力 × 0.3（其他反击者正常伤害）
     v27-hero-rebalance: 力量系反击伤害 +20%（counterMul=1.2）
     v28-piece-diversity: 士·贴身肉搏 — 士反击伤害 ×1.5（与 counterMul 乘法叠加）
       final = base × counterMul(1.2) × adviserCounterMul(1.5)，体现"贴身护卫"特色
     v36-balabce: 马作为唯一例外，对炮造成 ×0.5 反击伤害（打破"炮打非远程不掉血"绝对压制）*/
  const canCounter = (dType === 'core' || dType === 'defender' || dType === 'special')
    || (dType === 'striker' && defender.type === T.HORSE && aType === 'remote');
  const attackPreventsCounter = aIsHorse || aIsElephant;
  const defCounterMul = defender.counterMul || 1.0;  /* v27: 力量系反击+20% */
  const adviserCounterMul = (defender.type === T.ADVISOR) ? 1.5 : 1.0;  /* v28: 士反击+50% */
  if(!canCounter || attackPreventsCounter){
    attackerDmg = 0;
  } else if(dType === 'special' && defender.type === 'p'){
    /* 兵反击伤害 = 兵攻击力 × 0.3 × counterMul × adviserCounterMul（力量系兵反击更强） */
    attackerDmg = Math.floor(effDAtk * 0.3 * defCounterMul * adviserCounterMul);
  } else if(dType === 'striker' && defender.type === T.HORSE && aType === 'remote'){
    /* v36: 马对炮半反击 — 打破"炮打非远程不掉血"绝对压制，给马生存空间 */
    attackerDmg = Math.max(1, Math.floor((effDAtk - effADef) * 0.5 * defCounterMul * adviserCounterMul));
  } else {
    /* 其他反击者：正常反击伤害（含 buff）× counterMul × adviserCounterMul */
    attackerDmg = Math.max(1, Math.floor((effDAtk - effADef) * defCounterMul * adviserCounterMul));
  }

  /* v10: 帅·临终反击 — 帅被攻击时（无论是否被吃），攻击方受 50 点反伤
     本即使帅被一击必杀，攻击方也会受伤。反伤加在 attackerDmg 上，
     不被 shield 吸收（shield 仅作用于 defenderDmg），类似真实伤害。
     战报仅在非 AI 模拟时写入，避免 AI 评估污染日志。
     v30-fix P0-5: 原实现车打帅时车承受 30% maxHp 自损 + 50 反伤，
     车 maxHp 仅 110，几乎必死，导致 100% 同归于尽，护盾也完全浪费。
     改为：帅·临终反击优先被攻击方 shield 吸收（计入 attackerDmg，
     但 doMove 中扣血前先消耗攻击方 shield）。 */
  if(defender.type === T.KING){
    attackerDmg += 50;
    if(typeof isAICombatSimulation !== 'undefined' && !isAICombatSimulation && typeof addBattleLog === 'function'){
      addBattleLog('state', '<b>帅·临终反击</b> 攻击方受到 50 点反伤（可被护盾吸收）');
    }
  }

  /* v13: 护盾吸收（仅计算吸收量，不修改 defender.buffs）
     参照 executeMark 模式：calcDamage 只读取/计算，buff 消耗由 doMove 处理。
     真实伤害不被 shield 吸收。 */
  let shieldConsumed = 0;
  if(shieldAbsorb > 0 && defenderDmg > 0){
    shieldConsumed = Math.min(shieldAbsorb, defenderDmg);
    defenderDmg -= shieldConsumed;
  }

  /* v13: 反伤 buff（reflect） */
  let reflectDmg = 0;
  if(defender.buffs){
    const reflectBuffs = defender.buffs.filter(b => b.type === 'reflect');
    for(const rb of reflectBuffs){
      reflectDmg += Math.floor(defenderDmg * (rb.value || 0.3));
    }
  }
  /* v28-piece-diversity: 相·反制概率 — 相 30% 概率反弹 20% 伤害（兵种固有特性）
     - 类似 reflect buff，但作为相的被动技能（无需挂 buff）
     - 仅在真实战斗中触发（isAICombatSimulation=false），保证 AI 搜索结果稳定
     - 与 reflect buff 叠加（独立计算后累加到 reflectDmg） */
  if(defender.type === T.ELEPHANT && typeof isAICombatSimulation !== 'undefined' && !isAICombatSimulation){
    if(Math.random() < 0.3){
      reflectDmg += Math.floor(defenderDmg * 0.2);
    }
  }

  /* v10: 谋属性 (int) 真实伤害 — 攻击方 charInt 提供 int×0.5 真实伤害
     （等价于调用 getIntTrueDamage(charId)，但棋子已注入 charInt，直接读取即可）
     马已有 15 真实伤害，避免叠加过强故跳过。
     v27-hero-rebalance: 智力系普攻附带 int×0.3 真实伤害（atkTrueDmgMul=0.3）
       - 智力系角色普攻弱势补偿：基础 int×0.5 + 智力系额外 int×0.3 = int×0.8 真实伤害
       - 仅在普通攻击（非车一击必杀/非马跳跃）时生效，避免与车马特色冲突
       - 车一击必杀走 aIsRook 分支，trueDmg=0；马跳跃 aIsHorse=true 时跳过本段 */
  const attackerInt = attacker.charInt || 0;
  const atkTrueDmgMul = attacker.atkTrueDmgMul || 0;
  if(attackerInt > 0 && !aIsHorse && !aIsRook){
    /* 基础谋属性真伤 int×0.5 + 智力系额外真伤 int×atkTrueDmgMul */
    trueDmg = (trueDmg || 0) + Math.floor(attackerInt * 0.5) + Math.floor(attackerInt * atkTrueDmgMul);
  }

  return { defenderDmg, attackerDmg, attackerBuff, defenderImmune:false, reflectDmg, executeMarkBuff, shieldConsumed, attackerSelfDmg, trueDmg, heroDodge:false };
}

function makeMv(b,m){
  const attacker=b[m.fr][m.fc];
  const defender=b[m.tr][m.tc];
  if(defender){
    /* v16: 调用 calcDamage 统一战斗计算，AI 评估与真实战斗一致
       包含角色属性加成、buff 系统、兵种相克
       注意：makeMv 仅模拟伤害，不消耗 executeMark（由 doMove 处理）
       v10: 新增 trueDmg（马真实伤害，无视 immune/shield）和
            attackerSelfDmg（车一击必杀自损）的处理 */
    const dmg=calcDamage(attacker, defender);
    m._atkHp=attacker.hp;
    m._defHp=defender.hp;
    m._attacker=attacker;
    /* v10: 马真实伤害 — 无视 immune 和 shield，独立结算 */
    if(dmg.trueDmg>0) defender.hp-=dmg.trueDmg;
    if(!dmg.defenderImmune){
      attacker.hp-=dmg.attackerDmg;
      defender.hp-=dmg.defenderDmg;
      if(dmg.reflectDmg>0) attacker.hp-=dmg.reflectDmg;
    }
    /* v10: 车一击必杀自损（immune 时 attackerSelfDmg=0，不会扣血） */
    if(dmg.attackerSelfDmg>0) attacker.hp-=dmg.attackerSelfDmg;
    if(defender.hp<=0){
      /* 防守方阵亡：攻击方占据目标位置 */
      b[m.tr][m.tc]=attacker; b[m.fr][m.fc]=null;
    }else if(attacker.hp<=0){
      /* 攻击方阵亡：防守方留守，攻击方移出棋盘 */
      b[m.fr][m.fc]=null;
    }else{
      /* 双方存活：攻击方退回原位，棋盘位置不变 */
    }
  }else{
    b[m.tr][m.tc]=attacker; b[m.fr][m.fc]=null;
  }
}
function undoMv(b,m,cap){
  if(cap){
    /* 有战斗发生：恢复攻击方至原位、防守方至目标位，并还原 HP */
    b[m.fr][m.fc]=m._attacker;
    m._attacker.hp=m._atkHp;
    b[m.tr][m.tc]=cap;
    cap.hp=m._defHp;
  }else{
    b[m.fr][m.fc]=b[m.tr][m.tc]; b[m.tr][m.tc]=null;
  }
}
function isLegalMv(b,m,p){
  const cap=b[m.tr][m.tc]; makeMv(b,m);
  const bad=isInCheck(b,p)||kingsFacing(b);
  undoMv(b,m,cap); return !bad;
}
function getLegalAIMoves(b,p){
  return getAllMoves(b,p).filter(m=>isLegalMv(b,m,p));
}
function minimax(b,depth,alpha,beta,maxing){
  /* 超时检查：超过 AI_TIMEOUT 立即返回当前评估值，不再继续递归 */
  if(Date.now()-aiStartTime>AI_TIMEOUT) return evaluateBoard(b);
  if(depth===0) return evaluateBoard(b);
  const p=maxing?RED:BLACK;
  const moves=getLegalAIMoves(b,p);
  if(moves.length===0) return maxing?-50000:50000;
  if(maxing){
    let best=-Infinity;
    for(const m of moves){
      const cap=b[m.tr][m.tc]; makeMv(b,m);
      best=Math.max(best,minimax(b,depth-1,alpha,beta,false));
      undoMv(b,m,cap);
      alpha=Math.max(alpha,best); if(beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for(const m of moves){
      const cap=b[m.tr][m.tc]; makeMv(b,m);
      best=Math.min(best,minimax(b,depth-1,alpha,beta,true));
      undoMv(b,m,cap);
      beta=Math.min(beta,best); if(beta<=alpha) break;
    }
    return best;
  }
}
function getBestMove(b,p,depth,randomChance=0){
  /* 超时保护：记录开始时间 + 限制最大搜索深度 */
  aiStartTime=Date.now();
  depth=Math.min(depth,AI_MAX_DEPTH.hard);
  /* v27: AI 模拟期间禁用 calcDamage 中的随机闪避，保证搜索结果稳定 */
  const prevAI=isAICombatSimulation; isAICombatSimulation=true;
  const moves=getLegalAIMoves(b,p);
  if(moves.length===0){ isAICombatSimulation=prevAI; return null; }
  // 随机走棋
  if(Math.random()<randomChance) {
    const m=moves[Math.floor(Math.random()*moves.length)];
    isAICombatSimulation=prevAI;
    return {from:{r:m.fr,c:m.fc},to:{r:m.tr,c:m.tc}};
  }
  moves.sort((a,b2)=>{
    const va=b[a.tr][a.tc]?PIECE_VALUE[b[a.tr][a.tc].type]:0;
    const vb=b[b2.tr][b2.tc]?PIECE_VALUE[b[b2.tr][b2.tc].type]:0;
    return vb-va;
  });
  const isMax=p===RED;
  let best=moves[0],bestVal=isMax?-Infinity:Infinity;
  let alpha=-Infinity,beta=Infinity;
  try {
    for(const m of moves){
      const cap=b[m.tr][m.tc]; makeMv(b,m);
      const val=minimax(b,depth-1,alpha,beta,!isMax);
      undoMv(b,m,cap);
      if(isMax){ if(val>bestVal){bestVal=val;best=m;} alpha=Math.max(alpha,val); }
      else{ if(val<bestVal){bestVal=val;best=m;} beta=Math.min(beta,val); }
      /* 超时提前退出主循环 */
      if(Date.now()-aiStartTime>AI_TIMEOUT) break;
    }
  } catch(e) {
    /* 异常降级贪心 */
    isAICombatSimulation=prevAI;
    return greedyMove(b,p);
  }
  /* 超时降级贪心：保证返回的是完整 1-ply 评估结果 */
  if(Date.now()-aiStartTime>AI_TIMEOUT){ isAICombatSimulation=prevAI; return greedyMove(b,p); }
  // 同分随机（二次评估较耗时，超时则跳过）
  if(Date.now()-aiStartTime<AI_TIMEOUT){
    const good=moves.filter(m=>{
      const cap=b[m.tr][m.tc]; makeMv(b,m);
      const v=minimax(b,depth-1,-Infinity,Infinity,!isMax);
      undoMv(b,m,cap);
      return Math.abs(v-bestVal)<15;
    });
    if(good.length>1) best=good[Math.floor(Math.random()*good.length)];
  }
  isAICombatSimulation=prevAI;
  return {from:{r:best.fr,c:best.fc},to:{r:best.tr,c:best.tc}};
}
/* 贪心降级：遍历所有走法，选评估最高的一步（仅 1-ply）
   v27: 设置 isAICombatSimulation 保证 calcDamage 不触发随机闪避 */
function greedyMove(b,p){
  const prevAI=isAICombatSimulation; isAICombatSimulation=true;
  const moves=getLegalAIMoves(b,p);
  if(moves.length===0){ isAICombatSimulation=prevAI; return null; }
  let best=moves[0],bestVal=p===RED?-Infinity:Infinity;
  for(const m of moves){
    const cap=b[m.tr][m.tc]; makeMv(b,m);
    const score=evaluateBoard(b);
    undoMv(b,m,cap);
    if(p===RED){
      if(score>bestVal){ bestVal=score; best=m; }
    } else {
      if(score<bestVal){ bestVal=score; best=m; }
    }
  }
  isAICombatSimulation=prevAI;
  return {from:{r:best.fr,c:best.fc},to:{r:best.tr,c:best.tc}};
}
/* 从预过滤的走法中选择最佳走法（用于因果律锁等）
   v27: 设置 isAICombatSimulation 保证 calcDamage 不触发随机闪避 */
function getBestMoveFromMoves(b,p,moves,depth,randomChance=0){
  /* 超时保护：记录开始时间 + 限制最大搜索深度 */
  aiStartTime=Date.now();
  depth=Math.min(depth,AI_MAX_DEPTH.hard);
  const prevAI=isAICombatSimulation; isAICombatSimulation=true;
  if(moves.length===0){ isAICombatSimulation=prevAI; return null; }
  if(Math.random()<randomChance) {
    const m=moves[Math.floor(Math.random()*moves.length)];
    isAICombatSimulation=prevAI;
    return {from:{r:m.fr,c:m.fc},to:{r:m.tr,c:m.tc}};
  }
  moves.sort((a,b2)=>{
    const va=b[a.tr][a.tc]?PIECE_VALUE[b[a.tr][a.tc].type]:0;
    const vb=b[b2.tr][b2.tc]?PIECE_VALUE[b[b2.tr][b2.tc].type]:0;
    return vb-va;
  });
  const isMax=p===RED;
  let best=moves[0],bestVal=isMax?-Infinity:Infinity;
  let alpha=-Infinity,beta=Infinity;
  try {
    for(const m of moves){
      const cap=b[m.tr][m.tc]; makeMv(b,m);
      const val=minimax(b,depth-1,alpha,beta,!isMax);
      undoMv(b,m,cap);
      if(isMax){ if(val>bestVal){bestVal=val;best=m;} alpha=Math.max(alpha,val); }
      else{ if(val<bestVal){bestVal=val;best=m;} beta=Math.min(beta,val); }
      /* 超时提前退出主循环 */
      if(Date.now()-aiStartTime>AI_TIMEOUT) break;
    }
  } catch(e) {
    /* 异常降级贪心 */
    isAICombatSimulation=prevAI;
    return greedyMove(b,p);
  }
  /* 超时降级贪心 */
  if(Date.now()-aiStartTime>AI_TIMEOUT){ isAICombatSimulation=prevAI; return greedyMove(b,p); }
  // 同分随机（二次评估较耗时，超时则跳过）
  if(Date.now()-aiStartTime<AI_TIMEOUT){
    const good=moves.filter(m=>{
      const cap=b[m.tr][m.tc]; makeMv(b,m);
      const v=minimax(b,depth-1,-Infinity,Infinity,!isMax);
      undoMv(b,m,cap);
      return Math.abs(v-bestVal)<15;
    });
    if(good.length>1) best=good[Math.floor(Math.random()*good.length)];
  }
  isAICombatSimulation=prevAI;
  return {from:{r:best.fr,c:best.fc},to:{r:best.tr,c:best.tc}};
}

/* ============================================
   v9: 棋子合并工具（技能触发时调用）
   - HP 叠加（上限 maxHp）
   - atk/def 取较高值
   - 保留目标棋子类型与归属
   - buffs 合并去重
   ============================================ */
function mergePieces(target, source){
  if(!target || !source) return target;
  const mergedHp = Math.min((target.hp||0) + (source.hp||0), target.maxHp || (target.hp||0) + (source.hp||0));
  const merged = {
    ...target,
    hp: mergedHp,
    maxHp: Math.max(target.maxHp||0, source.maxHp||0, mergedHp),
    atk: Math.max(target.atk||0, source.atk||0),
    def: Math.max(target.def||0, source.def||0),
    charAtk: Math.max(target.charAtk||0, source.charAtk||0),
    charDef: Math.max(target.charDef||0, source.charDef||0),
    buffs: mergeBuffs(target.buffs, source.buffs)
  };
  return merged;
}

/* 合并双方 buff 列表（按 type 去重，保留较强效果）
   v16: duration 取较大值（之前只比较 value，可能丢失持续时间更长的 buff） */
function mergeBuffs(listA, listB){
  const a = Array.isArray(listA) ? listA : [];
  const b = Array.isArray(listB) ? listB : [];
  const map = new Map();
  [...a, ...b].forEach(buf => {
    if(!buf) return;
    const key = buf.type || buf.id || JSON.stringify(buf);
    const prev = map.get(key);
    if(!prev){
      map.set(key, {...buf});
    } else {
      /* value 取较强，duration 取较长
         v22 修复 Bug 16：原强制 _fresh=false，若合并的 buff 中有本回合新增的（_fresh=true），
         会在下次 tickBuffs 中被立即递减导致提前一回合过期。现保留 OR 逻辑（任一为 true 则 true）。 */
      const stronger = (buf.value||0) > (prev.value||0) ? buf : prev;
      map.set(key, {
        ...stronger,
        duration: Math.max(prev.duration||0, buf.duration||0),
        _fresh: prev._fresh || buf._fresh || false
      });
    }
  });
  return Array.from(map.values());
}
