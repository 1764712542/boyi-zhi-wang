/* ============================================
   engine.js — 博弈之王 · 棋盘引擎 + AI 搜索
   纯逻辑，无 UI / state 依赖，便于独立测试与调优
   依赖：data.js（常量 COLS/ROWS/RED/BLACK/T/PALACE/PIECE_VALUE）
   ============================================ */
'use strict';

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
   若 charId 为空或找不到对应角色，返回全 0（不影响原有逻辑） */
function getCharBonus(charId){
  const ch = charId && typeof CHARACTERS!=='undefined' && CHARACTERS[charId] ? CHARACTERS[charId] : null;
  return {
    charAtk: ch ? (ch.stats?.atk || 0) : 0,
    charDef: ch ? (ch.stats?.def || 0) : 0,
    charInt: ch ? (ch.stats?.int || 0) : 0
  };
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
        default:
          detail.name = b.type || '未知';
          detail.desc = '';
      }
      buffDetails.push(detail);
    }
  }
  const effAtk = Math.max(0, Math.floor((baseAtk + charAtkBonus) * atkMul + atkAdd));
  const effDef = Math.max(0, Math.floor((baseDef + charDefBonus) * defMul + defAdd));
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
     + 角色属性加成 charAtk/charDef/charInt */
  const mk = (type,player,charId) => {
    const s = PIECE_STATS[type];
    const bonus = getCharBonus(charId);
    return { type, player, hp:s.hp, maxHp:s.hp, atk:s.atk, def:s.def, ptype:s.type,
             charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt };
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
  const mk = (type,p) => {
    const s = PIECE_STATS[type];
    const bonus = getCharBonus(charId);
    return { type, player:p, hp:s.hp, maxHp:s.hp, atk:s.atk, def:s.def, ptype:s.type,
             charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt };
  };
  for(let c=0;c<9;c++) b[kingRow][c]=mk(layout[c],player);
  b[cannonRow][1]=mk(T.CANNON,player); b[cannonRow][7]=mk(T.CANNON,player);
  for(const c of [0,2,4,6,8]) b[pawnRow][c]=mk(T.PAWN,player);
}
/* 精简阵容：1 王 + 2 仕 + 1 车 + 1 马 + 1 炮 + 2 兵
   kingCol 必须在该阵营九宫格列范围内（blue:0-2 / green:6-8）
   charId 可选：该侧棋子继承的角色 ID */
function placeMiniSquad(b, player, row, kingCol, charId){
  const mk = (type,p) => {
    const s = PIECE_STATS[type];
    const bonus = getCharBonus(charId);
    return { type, player:p, hp:s.hp, maxHp:s.hp, atk:s.atk, def:s.def, ptype:s.type,
             charAtk:bonus.charAtk, charDef:bonus.charDef, charInt:bonus.charInt };
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
   addBuff(piece, type, value, duration)：给棋子加 buff（去重合并同类）
   v16: 续期 buff 不重置 _fresh（避免 tickBuffs 跳过本回合递减导致多活 1 回合） */
function addBuff(piece, type, value, duration){
  if(!piece) return;
  if(!piece.buffs) piece.buffs = [];
  /* 同类型 buff：取较高 value，刷新 duration（保留 _fresh 原值） */
  const existing = piece.buffs.find(b => b.type === type);
  if(existing){
    existing.value = Math.max(existing.value||0, value||0);
    existing.duration = Math.max(existing.duration||0, duration||1);
    /* _fresh 不重置：若已递减过则保持 false，避免续期 buff 多活 1 回合 */
  } else {
    piece.buffs.push({ type, value, duration, _fresh:true });
  }
}
/* 给一方全体棋子加 buff */
function addTeamBuff(board, player, type, value, duration){
  if(!board) return;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = board[r][c];
    if(p && p.player === player) addBuff(p, type, value, duration);
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

/* ===== 兵种相克伤害计算 =====
   v13: 统一读取 buff 系统（weakness/attackBoost/executeMark/ironwall/defenseBoost/shield/immune）
   规则：
   1. 炮(远程)打非远程：炮不掉血（远程优势）
   2. 相同兵种对轰：双方掉血（默认）
   2.5 车马(striker)破甲：无视防守方30%防御
   3. 兵(特殊)受非帅攻击：兵受50%伤害（兵的护甲削弱）
   4. 兵打兵：双方掉血（正常计算，默认处理）
   5. 非炮打相/士(防守)：相/士掉血，攻击方获虚弱buff（下回合攻击-30%）
   6. 任何单位打帅/将(核心)：帅掉血，兵打帅+50%伤害
   7. 普通移动（无吃子）：不掉血（doMove 中判断）
   返回 { defenderDmg, attackerDmg, attackerBuff, defenderImmune, reflectDmg } */
function calcDamage(attacker, defender){
  if(!attacker || !defender) return { defenderDmg:0, attackerDmg:0, attackerBuff:null, defenderImmune:false, reflectDmg:0 };

  const aType = attacker.ptype; // 攻击方兵种类型
  const dType = defender.ptype; // 防守方兵种类型

  /* 基础攻防 + 角色属性加成 */
  const aAtk = attacker.atk + (attacker.charAtk || 0) / 10;
  const aDef = attacker.def + (attacker.charDef || 0) / 10;
  const dAtk = defender.atk + (defender.charAtk || 0) / 10;
  const dDef = defender.def + (defender.charDef || 0) / 10;

  /* v13: 攻击方 buff 影响
     - weakness: 攻击力乘 (1-value)
     - attackBoost: 攻击力 +value
     - executeMark: 伤害乘 (1+value)（必中+50%伤害） */
  let atkMul = 1, atkAdd = 0, dmgMul = 1;
  let executeMarkBuff = null;
  let hasPierce = false;
  if(attacker.buffs){
    for(const b of attacker.buffs){
      if(b.type === 'weakness') atkMul *= (1 - (b.value || 0.3));
      else if(b.type === 'attackBoost') atkAdd += (b.value || 20);
      else if(b.type === 'executeMark'){
        dmgMul *= (1 + (b.value || 0.5));
        executeMarkBuff = b; /* 记录：攻击后消耗 */
      }
      else if(b.type === 'pierce') hasPierce = true; /* v16: 破防 */
      else if(b.type === 'bkiller' && defender.player === BLACK) dmgMul *= (1 + (b.value || 0.5)); /* v16: 仅对B王（黑方）棋子加成 */
    }
  }
  const effAtk = (aAtk + atkAdd) * atkMul;

  /* v13: 防守方 buff 影响
     - ironwall: 防御 ×2
     - defenseBoost: 防御 +value
     - shield: 吸收 value 伤害
     - immune: 免疫所有伤害 */
  let defMul = 1, defAdd = 0, shieldAbsorb = 0;
  let defenderImmune = false;
  if(defender.buffs){
    for(const b of defender.buffs){
      if(b.type === 'ironwall' && !hasPierce) defMul *= 2;        /* v16: pierce 破防 */
      else if(b.type === 'defenseBoost' && !hasPierce) defAdd += (b.value || 20); /* v16: pierce 破防 */
      else if(b.type === 'defReduce') defMul *= (1 - (b.value || 0.3)); /* v17: 防御削弱 */
      else if(b.type === 'shield') shieldAbsorb += (b.value || 80);
      else if(b.type === 'immune') defenderImmune = true;
    }
  }
  const effDef = (dDef + defAdd) * defMul;

  /* 免疫：所有伤害为 0，executeMark 不消耗（攻击未命中） */
  if(defenderImmune){
    return { defenderDmg:0, attackerDmg:0, attackerBuff:null, defenderImmune:true, reflectDmg:0, executeMarkBuff:null };
  }

  /* 默认伤害：双方互扣 */
  let defenderDmg = Math.max(1, Math.floor((effAtk - effDef) * dmgMul));
  let attackerDmg = Math.max(1, dAtk - aDef);
  let attackerBuff = null;

  /* 规则1: 炮(远程)打非远程：炮不掉血 */
  if(aType === 'remote' && dType !== 'remote'){
    attackerDmg = 0;
  }

  /* 规则2.5: 车马(striker)破甲：无视防守方30%防御 */
  if(aType === 'striker'){
    const ignoreDef = Math.floor(effDef * 0.3);
    defenderDmg = Math.max(1, Math.floor((effAtk - (effDef - ignoreDef)) * dmgMul));
  }

  /* 规则3: 兵(特殊)受非帅且非兵攻击：兵受50%伤害 */
  if(dType === 'special' && aType !== 'core' && aType !== 'special'){
    defenderDmg = Math.floor(defenderDmg * 0.5);
  }

  /* 规则4: 兵打兵：双方掉血（默认处理） */

  /* 规则5: 非炮打相/士(防守)：攻击方获虚弱buff（下回合攻击-30%） */
  if(dType === 'defender' && aType !== 'remote'){
    attackerBuff = { type:'weakness', duration:1, value:0.3 };
  }

  /* 规则6: 任何单位打帅/将(核心)：兵打帅+50%伤害 */
  if(dType === 'core'){
    if(aType === 'special'){
      defenderDmg = Math.floor(defenderDmg * 1.5);
    }
  }

  /* v13: 护盾吸收 */
  if(shieldAbsorb > 0 && defenderDmg > 0){
    const absorbed = Math.min(shieldAbsorb, defenderDmg);
    defenderDmg -= absorbed;
    /* 消耗等量护盾：找到 shield buff 减少 value */
    if(defender.buffs){
      let remaining = absorbed;
      for(const b of defender.buffs){
        if(b.type === 'shield' && remaining > 0){
          const used = Math.min(b.value || 0, remaining);
          b.value = (b.value || 0) - used;
          remaining -= used;
        }
      }
      /* 移除耗尽的护盾 */
      defender.buffs = defender.buffs.filter(b => !(b.type === 'shield' && (b.value || 0) <= 0));
      if(defender.buffs.length === 0) delete defender.buffs;
    }
  }

  /* v13: 反伤 buff（reflect） */
  let reflectDmg = 0;
  if(defender.buffs){
    const reflectBuffs = defender.buffs.filter(b => b.type === 'reflect');
    for(const rb of reflectBuffs){
      reflectDmg += Math.floor(defenderDmg * (rb.value || 0.3));
    }
  }

  return { defenderDmg, attackerDmg, attackerBuff, defenderImmune:false, reflectDmg, executeMarkBuff };
}

function makeMv(b,m){
  const attacker=b[m.fr][m.fc];
  const defender=b[m.tr][m.tc];
  if(defender){
    /* v16: 调用 calcDamage 统一战斗计算，AI 评估与真实战斗一致
       包含角色属性加成、buff 系统、兵种相克
       注意：makeMv 仅模拟伤害，不消耗 executeMark（由 doMove 处理） */
    const dmg=calcDamage(attacker, defender);
    m._atkHp=attacker.hp;
    m._defHp=defender.hp;
    m._attacker=attacker;
    if(!dmg.defenderImmune){
      attacker.hp-=dmg.attackerDmg;
      defender.hp-=dmg.defenderDmg;
      if(dmg.reflectDmg>0) attacker.hp-=dmg.reflectDmg;
    }
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
  const moves=getLegalAIMoves(b,p);
  if(moves.length===0) return null;
  // 随机走棋
  if(Math.random()<randomChance) {
    const m=moves[Math.floor(Math.random()*moves.length)];
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
  for(const m of moves){
    const cap=b[m.tr][m.tc]; makeMv(b,m);
    const val=minimax(b,depth-1,alpha,beta,!isMax);
    undoMv(b,m,cap);
    if(isMax){ if(val>bestVal){bestVal=val;best=m;} alpha=Math.max(alpha,val); }
    else{ if(val<bestVal){bestVal=val;best=m;} beta=Math.min(beta,val); }
  }
  // 同分随机
  const good=moves.filter(m=>{
    const cap=b[m.tr][m.tc]; makeMv(b,m);
    const v=minimax(b,depth-1,-Infinity,Infinity,!isMax);
    undoMv(b,m,cap);
    return Math.abs(v-bestVal)<15;
  });
  if(good.length>1) best=good[Math.floor(Math.random()*good.length)];
  return {from:{r:best.fr,c:best.fc},to:{r:best.tr,c:best.tc}};
}
/* 从预过滤的走法中选择最佳走法（用于因果律锁等） */
function getBestMoveFromMoves(b,p,moves,depth,randomChance=0){
  if(moves.length===0) return null;
  if(Math.random()<randomChance) {
    const m=moves[Math.floor(Math.random()*moves.length)];
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
  for(const m of moves){
    const cap=b[m.tr][m.tc]; makeMv(b,m);
    const val=minimax(b,depth-1,alpha,beta,!isMax);
    undoMv(b,m,cap);
    if(isMax){ if(val>bestVal){bestVal=val;best=m;} alpha=Math.max(alpha,val); }
    else{ if(val<bestVal){bestVal=val;best=m;} beta=Math.min(beta,val); }
  }
  const good=moves.filter(m=>{
    const cap=b[m.tr][m.tc]; makeMv(b,m);
    const v=minimax(b,depth-1,-Infinity,Infinity,!isMax);
    undoMv(b,m,cap);
    return Math.abs(v-bestVal)<15;
  });
  if(good.length>1) best=good[Math.floor(Math.random()*good.length)];
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
      /* value 取较强，duration 取较长，_fresh 取 false（已递减过） */
      const stronger = (buf.value||0) > (prev.value||0) ? buf : prev;
      map.set(key, {
        ...stronger,
        duration: Math.max(prev.duration||0, buf.duration||0),
        _fresh: false
      });
    }
  });
  return Array.from(map.values());
}
