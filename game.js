/* ============================================
   博弈之王 · 避其锋芒  v3  (模块化版)
   依赖：js/data.js  js/engine.js  js/portrait.js  js/audio.js
   本文件保留：全局状态 / 游戏流程 / 技能 / 渲染 / 网络 / 复盘 / 事件
   ============================================ */
'use strict';

/* ===== 通用工具 ===== */
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

/* ===== 角色被技能针对时的反应（通用） ===== */
function getOppReact(){
  if(state.gameMode==='pve'){
    return pick(B_TAUNTS.react);
  } else {
    const oppId=state.currentPlayer===RED?state.pvpBlackChar:state.pvpRedChar;
    const oppChar=CHARACTERS[oppId];
    return pick(oppChar.speech||oppChar.skillLines);
  }
}

/* ===== 全局状态 ===== */
let state = {
  board:null, currentPlayer:RED, selected:null, validMoves:[],
  inspect:null, /* v14: 只读查看模式（点击对方棋子时用于查看属性与 debuff） */
  history:[], gameOver:false, playerColor:RED, aiColor:BLACK,
  character:'houzhibo', handicap:'none', difficulty:'easy',
  lastMove:null, animating:false, aiThinking:false, moveCount:0,
  redCaptured:[], blackCaptured:[],
  /* v22: 战斗日志（最近的事件在前） */
  battleLog:[],
  roundsSincePlayerSkill:3, roundsSinceAISkill:3,
  skillActive:null, revealedMoves:null, suggestedMoves:null, aiPredictedMove:null,
  threatMarks:null, extraMove:0, weakenedAITurns:0, swapMode:false,
  boardSnapshots:[], celestialShield:false, celestialPrediction:null,
  playerCannotCapture:false, aiExtraMoves:0,
  dodgeTarget:null, disguiseMode:false, aweActive:false, awePieces:[],
  counterEyeTurns:0, aiSkillBlocked:false,
  playerConfusedMove:null, /* B王·指鹿为马：玩家下回合强制走这步 */
  predForcedMoves:{}, /* v22: PVP 预测类被动强制走法（按颜色区分） */
  forcedMovePending:false, /* v22: 强制走法 800ms 延迟期间的交互锁 */
  forcedMoveTimer:null, /* v22: 强制走法 setTimeout 的 timer ID，用于跨局清理 */
  /* v4.0 新增被动/技能状态 */
  dodgeNext:false, /* 闪避下次吃子 */
  hiddenPiece:null, /* 袁清山·潜龙勿用 */
  oppCannotCapture:false, /* 刘佳伟·以退为进 */
  oppSilenceTurns:0, /* 大爱仙尊·全屏沉默 */
  routePreview:null, /* 路线预览（被动） */
  hintMove:null, /* 提示走法（被动） */
  revealedPiece:null, /* 揭示的对方强子 */
  attackBoost:0, /* 攻击加成层数 */
  bkingAtkDebuff:0, /* B王攻击削弱层数 */
  bkingCdIncrease:0, /* B王CD增加（仙帝威压） */
  bkingSkillChanceReduce:0, /* B王技能概率降低 */
  skillCdReduce:0, /* 技能CD减少（掀桌之神） */
  reflectFirstTurn:0, /* 大爱仙尊·扮猪吃虎：首回合反伤比例（0.5=50%），一次性 */
  playerExtraMove:false, /* 玩家额外回合（被动触发） */
  /* v16: 补充一次性技能标记初始化（之前只写不读，且未在 state 中声明） */
  oppMissNext:false, /* 鸡哥·虚晃一枪：对方下回合攻击打偏 */
  aoeLockdownTurns:0, /* 全场禁锢回合数 */
  oppSlowTurns:0, /* 对方减速回合数 */
  oppPassiveDisabled:0, /* 对方被动失效回合数 */
  barrageActive:false, /* 三金·兄弟连斩：吃子后可再走 */
  /* v17: PVP 通用技能封锁标记（替代 aiSkillBlocked 仅针对B王的限制）
     释放方设置 oppSkillBlockedColor = 对方颜色，对方回合开始时 canUseSkill 返回 false */
  oppSkillBlockedColor:null, /* 被封锁技能的颜色（PVP 用） */
  oppAtkDebuff:0, /* 对方攻击削弱比例（PVP/PVE 通用） */
  oppDefDebuff:0, /* 对方防御削弱比例（PVP/PVE 通用） */
  /* 新技能状态字段 */
  ironwallTarget:null, ironwallTurns:0, /* 三金·铜墙铁壁 */
  ironwallPiece:null, ironwallRevivePending:false, /* v23 P0-4: 狂战之怒复活标记 */
  teleportMode:false, /* 周子翰·江山易主 */
  lockedPiece:null, lockTurns:0, /* 解宇轩·因果律锁 */
  catchActive:false, /* 陆星辰·异常捕获 */
  controlActive:false, /* 唐昊博涵·标准答案 */
  silenceTurns:0, /* 刘雪沛·破妄之眼（沉默） */
  /* 技能激活者颜色（PVP下追踪谁释放了技能） */
  skillOwnerColor:null,
  gameMode:'pve', pvpPlayer2Char:'bking',
  pvpRedChar:'houzhibo', pvpBlackChar:'bking',
  /* v10: PVP 双方选中的主动/被动技能（修复选将面板未生效） */
  pvpRedActiveSkill:null, pvpBlackActiveSkill:null,
  pvpRedPassive:null, pvpBlackPassive:null,
  /* v11: PVE/三英模式玩家选中的主动/被动技能（显式初始化，避免 undefined） */
  playerActiveSkill:null, playerPassiveSkill:null,
  /* v11: 三英模式每位武将独立存储选中技能 */
  threeHeroSkills:[],
  roundsSinceP2Skill:3,
  /* 技能冷却锁：技能生效回合不解冷却 */
  playerSkillLock:false, p2SkillLock:false, aiSkillLock:false,
  /* AI 路线锁定计划：技能显示路线后 AI 必须按路线走 */
  aiRoutePlan:[], aiRouteTurns:0, routeDisplay:null,
  /* 三英战B王模式：三将轮换 + B王超模 */
  threeHeroes:[], threeHeroIndex:0, threeHeroCDs:[3,3,3],
  threeBKingTurns:0, threeBKingDoubleNext:false,
  /* v5.0 多阵营 / 4v4 多人模式
     activePlayers: 当前参与回合轮换的颜色列表（2-4 阵营）
     playerIndex:   当前轮到 activePlayers 的索引
     multiPlayers:  4v4 模式下玩家列表 [{char, color, name}]
     multiPlayerIndex: 4v4 模式当前轮到的玩家索引
     eliminatedPlayers: 已被淘汰的颜色集合（王被吃） */
  activePlayers:[RED, BLACK], playerIndex:0,
  multiPlayers:[], multiPlayerIndex:0,
  eliminatedPlayers:[],
  /* v22 修复 Bug 8：献祭棋子跟踪列表（sacrifice 不进 captured，防止被 revive/unity 复活） */
  sacrificedList:[],
  /* v22 修复 Bug 3：blink 瞬移后挂 immune buff 的标记 */
  blinkActive:false,
  /* v22 修复 Bug 6：counter 后发制人 — 每回合叠加 weakness 的计数器 */
  counterActiveTurns:0, counterStacks:0,
  /* v10 弱角色增强：罗伦杰 p_chainatk 独立计数器（每层+30%，最多2层） */
  chainatkStacks:0,
  /* v30: B王形态切换系统 — 故事模式下每 N 回合切换形态 */
  bkingCurrentForm:null,
  /* v30: 色欲控制棋子列表 — lust 技能倒戈的棋子，回合开始递减控制回合数 */
  lustControlledPieces:[],
  /* v30-fix: 嫉妒技能复制的被动列表 — 3回合后移除 */
  envyStolenPassives:[],
  /* v31: 天气系统 — 当前天气类型 + 剩余回合数 */
  weather:'sunny', weatherTurnsLeft:5,
  /* v31: 技能高亮目标列表 — [{r,c,label,color,expires}] */
  highlightedTargets:[],
  /* v31-fix P1: B王形态切换修饰 — cdReduce/buffDurationBonus/selfAttackChance */
  bkingFormMods:{ cdReduce:0, buffDurationBonus:0, selfAttackChance:0 }
};

/* ===== 工具：inBoard/inPalace/isAcrossRiver/cloneBoard 已移至 js/engine.js ===== */

/* ===== AI 路线锁定系统 =====
   技能显示路线后，AI 必须按路线走；若目标被占，则移到旁边。 */
function getAdjacentMoves(r,c){
  const res=[];
  for(const[dr,dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]){
    const nr=r+dr,nc=c+dc;
    if(inBoard(nr,nc)&&!state.board[nr][nc]) res.push({r:nr,c:nc});
  }
  return res;
}
/* 构建AI接下来 n 步的路线计划（模拟双方推演，仅记录AI的走法） */
function buildAIRoutePlan(steps){
  const plan=[];
  const sim=cloneBoard(state.board);
  /* PVP模式预测对方走法，PVE模式预测AI走法 */
  const targetColor = (state.gameMode==='pvp'||state.gameMode==='online') ? oppColor() : state.aiColor;
  let p=targetColor;
  const diff=DIFFICULTIES[state.difficulty];
  let aiSteps=0;
  // 模拟 steps*2-1 步（双方交替），仅记录目标方的走法
  for(let i=0;i<steps*2-1&&aiSteps<steps;i++){
    const m=getBestMove(sim,p,diff.depth,0);
    if(!m) break;
    if(p===targetColor){
      plan.push({from:{r:m.from.r,c:m.from.c},to:{r:m.to.r,c:m.to.c}});
      aiSteps++;
    }
    sim[m.to.r][m.to.c]=sim[m.from.r][m.from.c];
    sim[m.from.r][m.from.c]=null;
    p=p===RED?BLACK:RED;
  }
  return plan;
}
/* 显示多步路线（带序号+路径箭头+流动动画），steps=显示前N步
   v20: showRoutePlan = 显示 + 强制AI按路线走（用于"操控"类技能 awe/exam）
        displayRoutePlan = 只显示不强制（用于"看穿/展示"类技能 cheat/rollcall/被动） */
function showRoutePlan(plan, color, labelPrefix){
  state.aiRoutePlan=plan.slice();
  state.aiRouteTurns=plan.length;
  state.routeDisplay={plan:plan.slice(), color:color||'#8a4c6b', label:labelPrefix||'AI'};
  renderAll();
  startPulse();
}
/* v20: 仅展示路线，不强制 AI 按路线走（看穿/预判类技能专用） */
function displayRoutePlan(plan, color, labelPrefix){
  state.routeDisplay={plan:plan.slice(), color:color||'#8a4c6b', label:labelPrefix||'AI'};
  renderAll();
  startPulse();
}
function clearRoutePlan(){
  state.routeDisplay=null;
  renderAll();
}

/* ===== Canvas 渲染 ===== */
let canvas=document.getElementById('board-canvas');
let ctx=canvas.getContext('2d');
let replayCanvas=null, replayCtx=null;

function setupCanvas(){
  const dpr=window.devicePixelRatio||1;
  canvas.width=CANVAS_W*dpr; canvas.height=CANVAS_H*dpr;
  canvas.style.width=CANVAS_W+'px'; canvas.style.height=CANVAS_H+'px';
  ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr,dpr);
}
/* 切换到复盘画布 */
function switchToReplayCanvas(){
  if(!replayCanvas){
    replayCanvas=document.getElementById('replay-canvas');
    replayCtx=replayCanvas.getContext('2d');
  }
  if(replayCanvas){
    canvas=replayCanvas; ctx=replayCtx;
    setupCanvas();
  }
}
/* 切换回对弈画布 */
function switchToGameCanvas(){
  canvas=document.getElementById('board-canvas');
  ctx=canvas.getContext('2d');
  setupCanvas();
}
function cellToPixel(r,c){ return {x:PAD+c*CELL,y:PAD+r*CELL}; }
function pixelToCell(x,y){
  const c=Math.round((x-PAD)/CELL), r=Math.round((y-PAD)/CELL);
  if(r<0||r>=ROWS||c<0||c>=COLS) return null;
  return {row:r,col:c};
}
function drawBoard(){
  const g=ctx.createLinearGradient(0,0,CANVAS_W,CANVAS_H);
  g.addColorStop(0,'#e8d4a0'); g.addColorStop(0.5,'#dcc488'); g.addColorStop(1,'#d4b878');
  ctx.fillStyle=g; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  // 纹理
  ctx.save(); ctx.globalAlpha=0.04;
  for(let i=0;i<200;i++){ ctx.fillStyle=Math.random()>0.5?'#000':'#fff'; ctx.fillRect(Math.random()*CANVAS_W,Math.random()*CANVAS_H,1.5,1.5); }
  ctx.restore();
  // 外框
  ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=3;
  ctx.strokeRect(PAD-12,PAD-12,(COLS-1)*CELL+24,(ROWS-1)*CELL+24);
  ctx.lineWidth=1; ctx.strokeRect(PAD-6,PAD-6,(COLS-1)*CELL+12,(ROWS-1)*CELL+12);
  // 网格
  ctx.strokeStyle='#2a1a0a'; ctx.lineWidth=1.2;
  for(let r=0;r<ROWS;r++){ const y=PAD+r*CELL; ctx.beginPath(); ctx.moveTo(PAD,y); ctx.lineTo(PAD+(COLS-1)*CELL,y); ctx.stroke(); }
  for(let c=0;c<COLS;c++){
    const x=PAD+c*CELL;
    if(c===0||c===COLS-1){ ctx.beginPath(); ctx.moveTo(x,PAD); ctx.lineTo(x,PAD+(ROWS-1)*CELL); ctx.stroke(); }
    else{
      ctx.beginPath(); ctx.moveTo(x,PAD); ctx.lineTo(x,PAD+4*CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,PAD+5*CELL); ctx.lineTo(x,PAD+(ROWS-1)*CELL); ctx.stroke();
    }
  }
  // 九宫斜线
  ctx.beginPath();
  ctx.moveTo(PAD+3*CELL,PAD); ctx.lineTo(PAD+5*CELL,PAD+2*CELL);
  ctx.moveTo(PAD+5*CELL,PAD); ctx.lineTo(PAD+3*CELL,PAD+2*CELL);
  ctx.moveTo(PAD+3*CELL,PAD+7*CELL); ctx.lineTo(PAD+5*CELL,PAD+9*CELL);
  ctx.moveTo(PAD+5*CELL,PAD+7*CELL); ctx.lineTo(PAD+3*CELL,PAD+9*CELL);
  ctx.stroke();
  // 楚河汉界
  ctx.fillStyle='#3a2a1a'; ctx.font='bold 28px "Ma Shan Zheng",serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.save(); ctx.globalAlpha=0.5;
  ctx.fillText('楚  河',PAD+1.5*CELL,PAD+4.5*CELL);
  ctx.fillText('漢  界',PAD+6.5*CELL,PAD+4.5*CELL);
  ctx.restore();
  // 位置标记
  const marks=[[2,1],[2,7],[7,1],[7,7],[3,0],[3,2],[3,4],[3,6],[3,8],[6,0],[6,2],[6,4],[6,6],[6,8]];
  ctx.strokeStyle='#2a1a0a'; ctx.lineWidth=1;
  for(const[r,c] of marks){ const{x,y}=cellToPixel(r,c); drawPosMark(x,y,c); }
}
function drawPosMark(x,y,col){
  const s=4,g=5;
  ctx.save(); ctx.globalAlpha=0.4;
  if(col>0){
    ctx.beginPath(); ctx.moveTo(x-g,y-g-s); ctx.lineTo(x-g,y-g); ctx.lineTo(x-g-s,y-g); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+g+s,y-g); ctx.lineTo(x+g,y-g); ctx.lineTo(x+g,y-g-s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-g,y+g+s); ctx.lineTo(x-g,y+g); ctx.lineTo(x-g-s,y+g); ctx.stroke();
  }
  if(col<COLS-1){ ctx.beginPath(); ctx.moveTo(x+g+s,y+g); ctx.lineTo(x+g,y+g); ctx.lineTo(x+g,y+g+s); ctx.stroke(); }
  ctx.restore();
}
function drawPiece(row,col,piece,opts={}){
  const{x,y}=cellToPixel(row,col);
  const r=PIECE_RADIUS;
  const px=x+(opts.dx||0), py=y+(opts.dy||0);
  /* v19: 袁清山·潜龙勿用 — 隐藏己方强子（显示为雾化问号） */
  const isHidden = state.hiddenPiece && state.hiddenPiece.r===row && state.hiddenPiece.c===col && state.hiddenPiece.turns>0;
  /* v5.0 多阵营：取该颜色的配色；red/black 保持原样式，blue/green 用对应主题色 */
  const pColor=COLOR_PIECE_COLOR[piece.player]||(piece.player===RED?'#b8302a':'#2a2520');
  const isLight = isBottomSide(piece.player); /* red/blue 浅底深字；black/green 深底浅字 */
  // 阴影
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=8; ctx.shadowOffsetY=3;
  const grad=ctx.createRadialGradient(px-r/3,py-r/3,0,px,py,r);
  if(isLight){
    grad.addColorStop(0,'#fdf6e3'); grad.addColorStop(0.7,'#f0e0c0'); grad.addColorStop(1,'#d8c498');
  } else {
    grad.addColorStop(0,'#5a5550'); grad.addColorStop(0.6,'#3a3530'); grad.addColorStop(1,'#1a1714');
  }
  ctx.fillStyle=grad;
  ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // 外圈
  ctx.strokeStyle=isLight?'#8b201a':'#0a0805'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.stroke();
  // 内圈
  ctx.strokeStyle=isLight?pColor:'#8a8580'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.arc(px,py,r*0.82,0,Math.PI*2); ctx.stroke();
  // 文字
  ctx.fillStyle=isLight?pColor:'#f5e6a8';
  ctx.font=`bold ${r}px "ZCOOL XiaoWei",serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.strokeStyle=isLight?'rgba(139,32,26,0.3)':'rgba(0,0,0,0.6)'; ctx.lineWidth=0.5;
  const chars=PIECE_CHAR[piece.player]||PIECE_CHAR.red;
  /* v19: 袁清山·潜龙勿用 — 隐藏己方强子（雾化问号覆盖原文字） */
  if(isHidden){
    ctx.fillStyle='rgba(154,205,50,0.55)'; /* 薄荷绿雾 */
    ctx.beginPath(); ctx.arc(px,py,r*0.85,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.font=`bold ${r*1.1}px "Ma Shan Zheng",serif`;
    ctx.fillText('?',px,py+1);
  } else {
    ctx.strokeText(chars[piece.type],px,py+1);
    ctx.fillText(chars[piece.type],px,py+1);
  }
  // HP 血条（v18：移入棋子圆内底部，彻底避免相邻棋子血条互相覆盖）
  if(piece.maxHp&&piece.maxHp>0){
    const ratio=Math.max(0,Math.min(1,piece.hp/piece.maxHp));
    /* 血条画在棋子圆内下沿：宽 = 半径×1.5，高 4px，居中于 px，y=py+r*0.45 */
    const barW=r*1.5, barH=4;
    const barX=px-barW/2, barY=py+r*0.45;
    ctx.save();
    /* 圆形裁剪，保证血条不超出棋子边缘 */
    ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.clip();
    /* 暗底槽 */
    ctx.fillStyle='rgba(30,22,16,0.85)';
    ctx.fillRect(barX-1,barY-1,barW+2,barH+2);
    /* 血量填充：>60% 绿，30-60% 黄，<30% 红 */
    ctx.fillStyle=ratio>0.6?'#4caf50':(ratio>0.3?'#ffc107':'#e53935');
    ctx.fillRect(barX,barY,Math.max(0,barW*ratio),barH);
    /* 高光 */
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.fillRect(barX,barY,Math.max(0,barW*ratio),1);
    ctx.restore();
    /* HP 数值：画在血条正下方（仍在圆内），小号字 */
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.lineWidth=2;
    ctx.font=`bold 7px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const hpText=`${Math.max(0,piece.hp)}/${piece.maxHp}`;
    ctx.strokeText(hpText,px,barY+barH+5);
    ctx.fillText(hpText,px,barY+barH+5);
    /* 虚弱 buff 标记：画在棋子上方圆外（不与下方棋子冲突） */
    if(piece.buffs&&piece.buffs.some(b=>b.type==='weakness')){
      ctx.fillStyle='#c39bd3';
      ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=2;
      ctx.font=`bold 10px sans-serif`;
      ctx.strokeText('虛',px,py-r-4);
      ctx.fillText('虛',px,py-r-4);
    }
    ctx.restore();
  }
  // 选中
  if(opts.selected){
    ctx.save();
    ctx.strokeStyle='rgba(184,48,42,0.8)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(px,py,r+5,0,Math.PI*2); ctx.stroke();
    const pulse=(Math.sin(Date.now()/200)+1)/2;
    ctx.strokeStyle=`rgba(184,48,42,${0.15+pulse*0.25})`; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(px,py,r+8+pulse*4,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  // 上一步标记
  if(opts.lastMove){
    ctx.save();
    ctx.strokeStyle='rgba(184,148,90,0.7)'; ctx.lineWidth=2; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.arc(px,py,r+3,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}
function drawValidMove(r,c){
  const{x,y}=cellToPixel(r,c);
  const piece=state.board[r][c];
  ctx.save();
  if(piece){
    ctx.strokeStyle='rgba(184,48,42,0.7)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(x,y,PIECE_RADIUS+6,0,Math.PI*2); ctx.stroke();
  } else {
    ctx.fillStyle='rgba(74,124,89,0.5)';
    ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(74,124,89,0.7)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}
function drawOverlay(){
  // v31: 技能高亮目标棋子（金色光环+标签）
  if(state.highlightedTargets && state.highlightedTargets.length){
    const now = Date.now();
    ctx.save();
    for(const t of state.highlightedTargets){
      if(t.expires <= now) continue;
      const{x,y}=cellToPixel(t.r,t.c);
      const pulse=(Math.sin(now/180)+1)/2;
      const col = t.color || '#b8945a';
      /* 金色光环（双层脉冲） */
      ctx.strokeStyle=col; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(x,y,PIECE_RADIUS+6,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle=`rgba(184,148,90,${0.2+pulse*0.35})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(x,y,PIECE_RADIUS+10+pulse*4,0,Math.PI*2); ctx.stroke();
      /* 标签（带背景） */
      if(t.label){
        const lblW = ctx.measureText(t.label).width + 12;
        ctx.fillStyle=col;
        ctx.fillRect(x-lblW/2,y-PIECE_RADIUS-22,lblW,16);
        ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(t.label,x,y-PIECE_RADIUS-14);
      }
    }
    ctx.restore();
    /* 若有过期项，触发清理（下一帧 renderAll 时自然消失） */
    const hasExpired = state.highlightedTargets.some(t=>t.expires<=now);
    if(hasExpired){
      state.highlightedTargets = state.highlightedTargets.filter(t=>t.expires>now);
    }
  }
  // 指点江山：显示AI可走位置（清晰箭头版）
  if(state.revealedMoves){
    ctx.save();
    const time=Date.now()/1000;
    const dashOff=(time*20)%12;
    ctx.strokeStyle='rgba(58,107,138,0.85)'; ctx.fillStyle='rgba(58,107,138,0.15)';
    ctx.lineWidth=2.5;
    for(const m of state.revealedMoves){
      const{x,y}=cellToPixel(m.fr,m.fc);
      ctx.beginPath(); ctx.arc(x,y,PIECE_RADIUS+5,0,Math.PI*2); ctx.fill(); ctx.stroke();
      const{x:tx,y:ty}=cellToPixel(m.tr,m.tc);
      drawArrow(x,y,tx,ty,'rgba(58,107,138,0.7)',2.5,dashOff);
    }
    ctx.restore();
  }
  // 逻辑推理：高亮多个最佳走法（序号+箭头+路径）
  if(state.suggestedMoves){
    ctx.save();
    const colors=['#b8945a','#8a4c6b','#4a7c59','#3a6b8a'];
    const labels=['最佳','次佳','第三','第四'];
    state.suggestedMoves.forEach((item,i)=>{
      const s=item.s; const col=colors[i]||colors[0];
      const{x:fx,y:fy}=cellToPixel(s.fr,s.fc);
      const{x:tx,y:ty}=cellToPixel(s.tr,s.tc);
      // 起点环
      ctx.strokeStyle=col; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(fx,fy,PIECE_RADIUS+7,0,Math.PI*2); ctx.stroke();
      // 箭头
      drawArrow(fx,fy,tx,ty,col,3.5,0);
      // 序号标签（带背景）
      ctx.fillStyle=col;
      ctx.fillRect(tx-14,ty-PIECE_RADIUS-22,28,16);
      ctx.fillStyle='#fff'; ctx.font='bold 12px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText((i+1).toString(),tx,ty-PIECE_RADIUS-14);
      // 标签
      ctx.fillStyle=col; ctx.font='bold 9px sans-serif';
      ctx.fillText(labels[i]||'',tx,ty-PIECE_RADIUS-30);
    });
    ctx.restore();
  }
  // Debug/翻书：威胁标记（红框+动画脉冲）
  if(state.threatMarks){
    ctx.save();
    const pulse=Math.sin(Date.now()/200)*0.3+0.7;
    for(const t of state.threatMarks){
      const{x,y}=cellToPixel(t.r,t.c);
      ctx.strokeStyle=`rgba(196,57,47,${pulse})`; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(x,y,PIECE_RADIUS+8,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(196,57,47,0.95)';
      ctx.fillRect(x-8,y-PIECE_RADIUS-20,16,16);
      ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('!',x,y-PIECE_RADIUS-12);
    }
    ctx.restore();
  }
  // 星辰指引/翻书作弊：显示AI预测走法（多步路径）
  if(state.aiPredictedMove){
    const m=state.aiPredictedMove;
    ctx.save();
    const time=Date.now()/1000;
    const dashOff=(time*15)%10;
    // 第一步：实线箭头
    const{x:fx,y:fy}=cellToPixel(m.from.r,m.from.c);
    const{x:tx,y:ty}=cellToPixel(m.to.r,m.to.c);
    ctx.strokeStyle='rgba(138,76,107,0.9)'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(fx,fy,PIECE_RADIUS+5,0,Math.PI*2); ctx.stroke();
    drawArrow(fx,fy,tx,ty,'#8a4c6b',4,dashOff);
    // 标签
    ctx.fillStyle='#8a4c6b';
    ctx.fillRect(tx-22,ty-PIECE_RADIUS-22,44,16);
    ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('AI 1',tx,ty-PIECE_RADIUS-14);
    // 第二步：虚线箭头（如果有）
    if(m.next){
      const{x:fx2,y:fy2}=cellToPixel(m.next.fr,m.next.fc);
      const{x:tx2,y:ty2}=cellToPixel(m.next.tr,m.next.tc);
      ctx.strokeStyle='rgba(138,76,107,0.5)'; ctx.lineWidth=3;
      ctx.setLineDash([5,5]);
      drawArrow(fx2,fy2,tx2,ty2,'rgba(138,76,107,0.5)',3,dashOff);
      ctx.setLineDash([]);
      ctx.fillStyle='rgba(138,76,107,0.7)';
      ctx.fillRect(tx2-22,ty2-PIECE_RADIUS-22,44,16);
      ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif';
      ctx.fillText('AI 2',tx2,ty2-PIECE_RADIUS-14);
    }
    ctx.restore();
  }
  // 路线锁定计划：多步路径（带序号+流动动画）
  if(state.routeDisplay&&state.routeDisplay.plan.length>0){
    const plan=state.routeDisplay.plan;
    const baseColor=state.routeDisplay.color||'#8a4c6b';
    const label=state.routeDisplay.label||'AI';
    ctx.save();
    const time=Date.now()/1000;
    const dashOff=(time*15)%10;
    plan.forEach((step,i)=>{
      const{x:fx,y:fy}=cellToPixel(step.from.r,step.from.c);
      const{x:tx,y:ty}=cellToPixel(step.to.r,step.to.c);
      const isCurrent=i===0;
      const opacity=isCurrent?0.95:Math.max(0.35,0.85-i*0.15);
      const col=baseColor.replace(/[\d.]+\)$/,(opacity+')'));
      // 用 rgba 兜底
      const rgba=hexToRgba(baseColor,opacity);
      ctx.strokeStyle=rgba; ctx.lineWidth=isCurrent?4:2.5;
      ctx.fillStyle=rgba;
      // 起点环
      ctx.beginPath(); ctx.arc(fx,fy,PIECE_RADIUS+5,0,Math.PI*2); ctx.stroke();
      // 箭头
      drawArrow(fx,fy,tx,ty,rgba,isCurrent?4:2.5,isCurrent?dashOff:0);
      // 序号标签
      const lw=28;
      ctx.fillStyle=rgba;
      ctx.fillRect(tx-lw/2,ty-PIECE_RADIUS-22,lw,16);
      ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${label}${i+1}`,tx,ty-PIECE_RADIUS-14);
    });
    ctx.restore();
  }
}
/* hex 转 rgba（带透明度） */
function hexToRgba(hex,a){
  if(hex.startsWith('rgba')||hex.startsWith('rgb')){
    // 已是 rgb/rgba，直接替换透明度
    return hex.replace(/[\d.]+\)$/,a+')');
  }
  let h=hex.replace('#','');
  if(h.length===3) h=h.split('').map(c=>c+c).join('');
  const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* 绘制箭头（带箭头头部） */
function drawArrow(fx,fy,tx,ty,color,width,dashOffset){
  ctx.save();
  ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=width;
  if(dashOffset!==undefined){
    ctx.setLineDash([6,4]);
    ctx.lineDashOffset=-dashOffset;
  }
  const dx=tx-fx, dy=ty-fy;
  const len=Math.sqrt(dx*dx+dy*dy);
  if(len<1){ ctx.restore(); return; }
  const ux=dx/len, uy=dy/len;
  // 缩短线段，避免穿过棋子
  const sx=fx+ux*(PIECE_RADIUS+2);
  const sy=fy+uy*(PIECE_RADIUS+2);
  const ex=tx-ux*(PIECE_RADIUS+8);
  const ey=ty-uy*(PIECE_RADIUS+8);
  ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
  ctx.setLineDash([]);
  // 箭头头部
  const ah=10, aw=6;
  const ang=Math.atan2(uy,ux);
  ctx.beginPath();
  ctx.moveTo(ex+ux*2, ey+uy*2);
  ctx.lineTo(ex-ah*ux+aw*uy, ey-ah*uy-aw*ux);
  ctx.lineTo(ex-ah*ux-aw*uy, ey-ah*uy+aw*ux);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
function renderAll(skipPieces){
  drawBoard();
  if(skipPieces) return;
  if(state.lastMove){
    const{from,to}=state.lastMove;
    const fx=cellToPixel(from.r,from.c), tx=cellToPixel(to.r,to.c);
    ctx.save(); ctx.fillStyle='rgba(184,148,90,0.15)';
    ctx.fillRect(fx.x-CELL/2,fx.y-CELL/2,CELL,CELL);
    ctx.fillRect(tx.x-CELL/2,tx.y-CELL/2,CELL,CELL);
    ctx.restore();
  }
  drawOverlay();
  for(const m of state.validMoves) drawValidMove(m.row,m.col);
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c]; if(!p) continue;
    if(state.animating&&state.animPiece&&state.animPiece.to.r===r&&state.animPiece.to.c===c) continue;
    const sel=state.selected&&state.selected.row===r&&state.selected.col===c;
    const lm=state.lastMove&&((state.lastMove.from.r===r&&state.lastMove.from.c===c)||(state.lastMove.to.r===r&&state.lastMove.to.c===c));
    drawPiece(r,c,p,{selected:sel,lastMove:lm});
  }
  renderHUD();
}

/* ===== HUD 状态栏（策略游戏风格） ===== */
const HUD_BUFF_NAME = { weakness:'虚弱', ironwall:'铁壁', shield:'护盾', silence:'沉默', lock:'禁锢' };
function renderHUD(){
  /* v22 重构：原中间 game-hud 已移除，改为：
     - 顶部横向总栏：回合/相克提示/双方兵力统计
     - 左侧 sidebar：黑方头像 + B王技能池列表 + 黑方被动 + 黑方状态
     - 右侧 sidebar：红方头像 + 红方技能面板 + 选中棋子 + 红方被动 + 红方状态 */
  if(!state.board) return;

  /* === 1. 顶部横向总栏 === */
  /* 1a. 回合指示（顶部栏左侧）
     v10: 动态显示回合数 + 当前角色名，提升信息密度 */
  const topTurn = document.getElementById('top-turn-indicator');
  if(topTurn){
    const isRed = state.currentPlayer===RED;
    topTurn.classList.toggle('black', !isRed);
    const turnText = topTurn.querySelector('.turn-text');
    if(turnText){
      if(state.gameOver){
        turnText.textContent = '对局结束';
      } else if(state.aiThinking){
        turnText.textContent = 'B王思考中';
      } else {
        const round = state.moveCount || 0;
        const roundLabel = `第${Math.ceil(round/2)+1}回合`;
        if(state.gameMode==='pvp'||state.gameMode==='online'){
          const char = getCurrentChar();
          const sideLabel = state.currentPlayer===RED?'红方':'黑方';
          turnText.textContent = `${roundLabel} · ${sideLabel}·${char?char.name:'?'}`;
        } else if(state.gameMode==='faction'||state.gameMode==='4v4'){
          const char = getCurrentChar();
          const colorLabel = colorDisplayName(state.currentPlayer);
          turnText.textContent = `${roundLabel} · ${colorLabel}·${char?char.name:'?'}`;
        } else {
          const myTurn = state.currentPlayer===state.playerColor;
          turnText.textContent = `${roundLabel} · ${myTurn?'你的回合':'B王回合'}`;
        }
      }
    }
  }
  /* 1b. 相克提示（顶部栏中间） */
  const hintEl = document.getElementById('hud-type-hint');
  if(hintEl){
    hintEl.innerHTML = `炮→近战不掉血 · 车/马破甲30% · 兵受50%伤 · 兵打帅+50%`;
  }
  /* v31: 1c. 天气显示（顶部栏左侧，回合数旁边） */
  const weatherIconEl = document.getElementById('weather-icon');
  const weatherNameEl = document.getElementById('weather-name');
  const weatherEffectEl = document.getElementById('hud-weather-effect');
  if(typeof WEATHER_TYPES!=='undefined' && state.weather && WEATHER_TYPES[state.weather]){
    const w = WEATHER_TYPES[state.weather];
    if(weatherIconEl) weatherIconEl.textContent = w.icon;
    if(weatherNameEl) weatherNameEl.textContent = `${w.name}(${state.weatherTurnsLeft}回合)`;
    if(weatherEffectEl) weatherEffectEl.textContent = w.desc;
  } else {
    if(weatherIconEl) weatherIconEl.textContent = '☀';
    if(weatherNameEl) weatherNameEl.textContent = '晴';
    if(weatherEffectEl) weatherEffectEl.textContent = '—';
  }
  /* 1c. 双方兵力统计（顶部栏右侧）
     v32-fix P1: 区分增益/减益计数。原显示 "buff×21" 包含了 B王 p_aura 施加的
     15 个 weakness 减益，让玩家误以为数据错误。现改为 "增益×N 减益×M"。
     雾天的 +30% def 修饰已通过 getPieceEffectiveStats 叠加到 effDef，
     但顶部栏不显示 def（仅攻/血），玩家可点击 仕/相 查看防御增量。 */
  const DEBUFF_TYPES = {
    weakness:1, defReduce:1, vulnerability:1, silence:1, lock:1, preyMark:1
  };
  const redStatsTop = document.getElementById('hud-red-stats-top');
  const blackStatsTop = document.getElementById('hud-black-stats-top');
  if(redStatsTop && blackStatsTop){
    const redStats = { count:0, totalAtk:0, totalDef:0, totalHp:0, buffCount:0, debuffCount:0 };
    const blackStats = { count:0, totalAtk:0, totalDef:0, totalHp:0, buffCount:0, debuffCount:0 };
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const p = state.board[r][c];
        if(!p) continue;
        const stats = p.player===RED ? redStats : (p.player===BLACK ? blackStats : null);
        if(!stats) continue;
        stats.count++;
        const eff = getPieceEffectiveStats(p);
        stats.totalAtk += eff ? eff.effAtk : p.atk;
        stats.totalDef += eff ? eff.effDef : p.def;
        stats.totalHp += Math.max(0, p.hp);
        if(p.buffs && p.buffs.length){
          for(const b of p.buffs){
            if(DEBUFF_TYPES[b.type]) stats.debuffCount++;
            else stats.buffCount++;
          }
        }
      }
    }
    const fmtStats = (s) => {
      let parts = [`子${s.count}`, `攻${s.totalAtk}`, `血${s.totalHp}`];
      if(s.buffCount>0 || s.debuffCount>0){
        parts.push(`<span class="ts-buff">+${s.buffCount}</span>${s.debuffCount>0?` <span class="ts-debuff">-${s.debuffCount}</span>`:''}`);
      }
      return parts.join(' ');
    };
    redStatsTop.innerHTML = fmtStats(redStats);
    blackStatsTop.innerHTML = fmtStats(blackStats);
  }

  /* === 2. 选中棋子详情（右侧 sidebar） === */
  const selEl = document.getElementById('hud-selected-piece');
  if(selEl){
    const target = state.selected || state.inspect;
    if(target && state.board){
      const sr = target.row!==undefined ? target.row : target.r;
      const sc = target.col!==undefined ? target.col : target.c;
      const p = state.board[sr] && state.board[sr][sc];
      if(p){
        const isInspect = !state.selected;
        const stats = getPieceEffectiveStats(p);
        const chars = PIECE_CHAR[p.player]||PIECE_CHAR.red;
        const pieceName = chars[p.type]||'?';
        const typeName = PIECE_TYPE_NAME[p.ptype]||'未知';
        const sideName = p.player===RED?'red':(p.player===BLACK?'black':'');
        const atkStr = stats.charAtkBonus>0
          ? `${stats.baseAtk}(+${stats.charAtkBonus}) → <b>${stats.effAtk}</b>`
          : `${stats.baseAtk} → <b>${stats.effAtk}</b>`;
        const defStr = stats.charDefBonus>0
          ? `${stats.baseDef}(+${stats.charDefBonus}) → <b>${stats.effDef}</b>`
          : `${stats.baseDef} → <b>${stats.effDef}</b>`;
        const hpPct = p.maxHp>0 ? Math.round(p.hp/p.maxHp*100) : 0;
        const hpColor = hpPct>60?'#3a7c4a':(hpPct>30?'#b87333':'#b8302a');
        let html = `<div class="hud-sel-head ${sideName}">
          <span class="hud-sel-piece">${pieceName}</span>
          <span class="hud-sel-type">${typeName}</span>
          ${isInspect?'<span class="hud-sel-inspect">查看</span>':''}
        </div>`;
        html += `<div class="hud-sel-hp">
          <span class="hud-sel-hp-val" style="color:${hpColor}">${Math.max(0,p.hp)}</span>/<span>${p.maxHp}</span>
          <div class="hud-sel-hp-bar"><div class="hud-sel-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
        </div>`;
        html += `<div class="hud-sel-row"><span>攻</span><span class="hud-sel-atk">${atkStr}</span></div>`;
        html += `<div class="hud-sel-row"><span>防</span><span class="hud-sel-def">${defStr}</span></div>`;
        if(stats.buffs.length){
          /* v10: buff 紧凑显示为图标 chip（title 悬停显示完整描述） */
          html += '<div class="hud-sel-buffs">';
          stats.buffs.forEach(b=>{
            const icon = BUFF_ICON_MAP[b.type] || '?';
            const durLabel = b.duration>0 ? b.duration : '∞';
            html += `<span class="buff-chip" title="${b.name}：${b.desc}（剩余${b.duration>0?b.duration+'回合':'永久'}）">${icon}${durLabel}</span>`;
          });
          html += '</div>';
        }
        selEl.innerHTML = html;
      } else {
        selEl.innerHTML = '<div class="side-empty">点击棋子查看</div>';
      }
    } else {
      selEl.innerHTML = '<div class="side-empty">点击棋子查看</div>';
    }
  }

  /* === 3. 左侧 sidebar：B王技能池列表 === */
  renderOppSkillPool();

  /* === 4. 双方被动 + 状态详情（左右 sidebar） === */
  const fmtPassiveDetail = (p) => {
    if(!p) return '<div class="side-empty">—</div>';
    const triggerLabel = getPassiveTriggerLabel(p.trigger);
    /* v30-fix: 被动名已含触发标签（如"傲慢光环""连环计"）则不重复追加，
       避免"傲慢光环光环""奇兵突袭光环"等冗余显示。 */
    const showTrigger = !(p.name||'').endsWith(triggerLabel);
    return `<div class="side-passive-item">
      <div><span class="sp-name">${p.name}</span>${showTrigger?`<span class="sp-trigger">${triggerLabel}</span>`:''}</div>
      <div class="sp-desc">${p.desc||''}</div>
    </div>`;
  };
  const fmtBuffDetail = (color) => {
    const list = [];
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const p = state.board[r][c];
        if(!p || p.player!==color || !p.buffs || !p.buffs.length) continue;
        const charName = (PIECE_CHAR[p.player] && PIECE_CHAR[p.player][p.type]) || '';
        p.buffs.forEach(b=>{
          const info = getBuffDesc(b);
          list.push(`<div class="side-buff-item"><span class="sb-name">${charName}·${info.name}</span> <span class="sb-desc">${info.desc}</span> <span class="sb-dur">${b.duration}回</span></div>`);
        });
      }
    }
    return list.length ? list.join('') : '<div class="side-empty">无</div>';
  };
  /* 右侧我方面板 = 红方 */
  const myPassiveEl = document.getElementById('my-passive-detail');
  const myBuffEl = document.getElementById('my-buff-detail');
  if(myPassiveEl) myPassiveEl.innerHTML = fmtPassiveDetail(getPassiveForColor(RED));
  if(myBuffEl) myBuffEl.innerHTML = fmtBuffDetail(RED);
  /* 左侧对方面板 = 黑方 */
  const oppPassiveEl = document.getElementById('opp-passive-detail');
  const oppBuffEl = document.getElementById('opp-buff-detail');
  if(oppPassiveEl) oppPassiveEl.innerHTML = fmtPassiveDetail(getPassiveForColor(BLACK));
  if(oppBuffEl) oppBuffEl.innerHTML = fmtBuffDetail(BLACK);
}

/* v22 新增：渲染 B王/AI 技能池列表（左侧 sidebar）
   - PVE/故事模式/三英：显示 B王该难度所有可用技能 + 描述 + CD 状态
   - PVP/online：显示对方玩家选定的主动技能 + 描述 + CD（仅 1 个）
   - 技能池从 DIFFICULTIES[难度].skills 取，CD 状态从 state.roundsSinceAISkill 计算 */
function renderOppSkillPool(){
  const poolEl = document.getElementById('opp-skill-pool-list');
  if(!poolEl) return;
  const isPvp = (state.gameMode==='pvp'||state.gameMode==='online');
  let skillList = [];
  let currentCD = 0;
  let threshold = 3;
  let silenced = false;
  if(isPvp){
    /* PVP/online：对方玩家的选定主动技能（仅 1 个） */
    const oppCharId = state.currentPlayer===RED ? state.pvpBlackChar : state.pvpRedChar;
    /* 显示对方（黑方视角看红方、红方视角看黑方）的技能。
       这里 sidebar 左侧固定显示"黑方信息"，PVP 下取 pvpBlackChar */
    const blackCharId = state.pvpBlackChar;
    const blackChar = (typeof CHARACTERS!=='undefined' && blackCharId && CHARACTERS[blackCharId]) ? CHARACTERS[blackCharId] : null;
    const blackSkillObj = state.pvpBlackActiveSkill;
    const blackSkill = blackSkillObj || (blackChar ? blackChar.skill : null);
    if(blackSkill){
      skillList = [blackSkill];
      currentCD = state.roundsSinceP2Skill || 0;
      threshold = Math.max(1, (blackSkill.cd||3) - (state.skillCdReduce||0));
      silenced = state.oppSkillBlockedColor===BLACK && state.silenceTurns>0;
    }
  } else {
    /* PVE/故事/三英：B王技能池（按难度） */
    const diff = (typeof DIFFICULTIES!=='undefined' && state.difficulty && DIFFICULTIES[state.difficulty]) ? DIFFICULTIES[state.difficulty] : null;
    if(diff){
      skillList = (diff.skills && diff.skills.length>0) ? diff.skills : (diff.skill ? [diff.skill] : []);
      currentCD = state.roundsSinceAISkill || 0;
      threshold = Math.max(1, 3 + (state.bkingCdIncrease||0) - (state.skillCdReduce||0));
      silenced = state.aiSkillBlocked || (state.silenceTurns>0);
    }
  }
  if(skillList.length===0){
    poolEl.innerHTML = '<div class="side-empty">—</div>';
    return;
  }
  let html = '';
  skillList.forEach(s=>{
    const cdLeft = Math.max(0, threshold - currentCD);
    const isReady = !silenced && cdLeft===0;
    const cdText = silenced ? '沉默' : (isReady ? '就绪' : `冷${cdLeft}`);
    const cls = isReady ? 'ready' : 'cooldown';
    html += `<div class="opp-skill-card ${cls}">
      <div class="opp-skill-card-head">
        <span class="opp-skill-card-name">${s.name||'?'}</span>
        <span class="opp-skill-card-cd">${cdText}</span>
      </div>
      <div class="opp-skill-card-desc">${s.desc||''}</div>
    </div>`;
  });
  poolEl.innerHTML = html;
}
let pulseRAF=null;
function startPulse(){
  if(pulseRAF) return;
  function loop(){
    // 选中棋子或技能效果激活时持续刷新动画
    const hasOverlay=state.selected||state.revealedMoves||state.suggestedMoves||state.threatMarks||state.aiPredictedMove||state.routeDisplay;
    if(hasOverlay&&!state.animating){ renderAll(); pulseRAF=requestAnimationFrame(loop); }
    else pulseRAF=null;
  }
  pulseRAF=requestAnimationFrame(loop);
}

/* ===== 走子动画 ===== */
function animateMove(from,to,cb){
  state.animating=true; state.animPiece={to};
  const piece=state.board[to.r][to.c];
  if(!piece){ state.animating=false; state.animPiece=null; if(cb)cb(); return; }
  const s=cellToPixel(from.r,from.c), e=cellToPixel(to.r,to.c);
  const dur=350, t0=performance.now();
  function frame(now){
    const t=Math.min(1,(now-t0)/dur);
    const e2=1-Math.pow(1-t,3);
    const dx=(e.x-s.x)*e2, dy=(e.y-s.y)*e2;
    renderAll(true);
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const p=state.board[r][c]; if(!p) continue;
      if(r===to.r&&c===to.c) continue;
      drawPiece(r,c,p,{});
    }
    drawPiece(from.r,from.c,piece,{dx,dy});
    if(t<1) requestAnimationFrame(frame);
    else { state.animating=false; state.animPiece=null; renderAll(); if(cb)cb(); }
  }
  requestAnimationFrame(frame);
}

/* ===== 游戏逻辑 ===== */
function selectPiece(r,c){
  const mc=myColor();
  // 三金·狂战之怒（v13: 选中棋子后挂 ironwall + attackBoost buff）
  // v23 P0-4: 对齐 data.js 描述 — 3回合攻击+60% + 连走3步 + 吃子后复活1子
  if(state.skillActive==='ironwall'){
    const p=state.board[r][c];
    if(p&&p.player===mc&&p.type!==T.KING){
      addBuff(p, 'ironwall', 0, 3);     /* 铁壁：防御×2，3回合 */
      addBuff(p, 'attackBoost', Math.floor(p.atk * 0.6), 3); /* 攻击+60%，3回合 */
      state.skillActive='ironwall-active';
      state.ironwallTarget={r,c}; /* 保留用于反吃逻辑 */
      state.ironwallTurns=3;
      state.ironwallPiece=p;             /* 记录狂战棋子（用于吃子后复活判定） */
      state.ironwallRevivePending=true;  /* 标记本次激活可触发一次复活 */
      /* 连走3步 = 默认1步 + 额外2步 */
      state.extraMove=Math.max(state.extraMove||0, 2);
      speakTaunt('狂战之怒！3回合内攻击+60%，连走3步，吃子复活！','self');
      addBattleLog('skill', '<b>狂战之怒</b> 3回合攻击+60%+连走3步+吃子复活1子');
      updateSkillDisplay();
      renderAll();
      return;
    }
    state.skillActive=null;
    state.ironwallTarget=null;
    state.ironwallPiece=null;
    state.ironwallRevivePending=false;
    renderAll();
    return;
  }

  // 胡浩·正道护体 / 刘佳伟·稳如泰山（v13: 选中棋子后挂 shield + defenseBoost buff）
  /* v23 P1: data.js 描述"己方一颗帅或将获得护盾"，原实现 p.type!==T.KING 排除帅/将，
     与描述相反。改为只允许帅/将（两个技能共用此分支）。 */
  if(state.shieldMode){
    const p=state.board[r][c];
    if(p&&p.player===mc&&p.type===T.KING){
      addBuff(p, 'shield', state.shieldAmount||100, 3); /* 护盾 */
      /* v22 修复：defenseBoost 数值读取 state.shieldDefBuff（正道护体0.3/稳如泰山0.25），原硬编码 0.3 与稳如泰山描述不符 */
      const defRatio = state.shieldDefBuff||0.3;
      addBuff(p, 'defenseBoost', Math.floor((p.def||0)*defRatio), 3); /* 防御+相应比例 */
      state.shieldMode=false;
      state.shieldAmount=0;
      state.shieldDefBuff=0;
      /* v22: 台词区分正道护体(+30%)和稳如泰山(+25%) */
      const defPct = Math.round(defRatio*100);
      speakTaunt(`护盾已就位，防御+${defPct}%！`,'self');
      updateSkillDisplay();
      renderAll();
      return;
    }
    speakTaunt('请选择己方帅/将！','self');
    state.shieldMode=false;
    renderAll();
    return;
  }

  /* v20: 玩家选目标类技能（debug/execute/mark/pierce）
     debug-mark / execute-mark：选己方非王非防守棋子，挂 executeMark buff（攻击方+50%伤害）
     mark-target / pierce-target：选敌方非王棋子，挂 vulnerability buff（被攻击时受伤+50%） */
  if(state.skillActive==='debug-mark' || state.skillActive==='execute-mark'){
    const p=state.board[r][c];
    if(p && p.player===mc && p.type!==T.KING && p.type!==T.ADVISOR && p.type!==T.ELEPHANT){
      addBuff(p, 'executeMark', 0.5, 2); /* 必中+50%伤害，2回合（命中后消耗） */
      const skillName = state.skillActive==='debug-mark' ? 'Debug扫描' : '嗜血斩杀';
      speakTaunt(skillName+'！'+PIECE_CHAR[mc===RED?'red':'black'][p.type]+'下次攻击+50%必中！','self');
      state.skillActive=null;
      updateSkillDisplay();
      renderAll();
      return;
    }
    speakTaunt('请选择己方非帅/仕/相的棋子！','self');
    renderAll();
    return;
  }
  if(state.skillActive==='mark-target' || state.skillActive==='pierce-target'){
    const p=state.board[r][c];
    if(p && p.player!==mc && p.type!==T.KING){
      addBuff(p, 'vulnerability', 0.5, 2); /* 易伤+50%，2回合（命中后消耗） */
      if(state.skillActive==='pierce-target'){
        addBuff(p, 'defReduce', 1.0, 2); /* 破甲突袭：防御归零，2回合 */
      }
      const skillName = state.skillActive==='mark-target' ? '洞察标记' : '破甲突袭';
      speakTaunt(skillName+'！已锁定，下次攻击该子受伤+50%！','self');
      state.skillActive=null;
      updateSkillDisplay();
      renderAll();
      return;
    }
    speakTaunt('请选择敌方非帅/将的棋子！','self');
    renderAll();
    return;
  }

  // 周子翰·江山易主：选择己方棋子进行传送
  if(state.teleportMode){
    const p=state.board[r][c];
    if(p&&p.player===mc&&p.type!==T.KING){
      state.selected={row:r,col:c,teleport:true};
      // 显示所有空位作为传送目标
      state.validMoves=[];
      for(let rr=0;rr<ROWS;rr++) for(let cc=0;cc<COLS;cc++){
        if(!state.board[rr][cc]) state.validMoves.push({row:rr,col:cc});
      }
      renderAll();
      return;
    }
    state.teleportMode=false;
    renderAll();
    return;
  }

  // 鸡哥·完美伪装：选择己方棋子进行伪装（与另一己方棋子互换）
  if(state.disguiseMode){
    const p=state.board[r][c];
    if(p&&p.player===mc&&p.type!==T.KING){
      state.selected={row:r,col:c,disguise:true};
      // 显示所有己方非将棋子作为可互换目标
      state.validMoves=[];
      for(let rr=0;rr<ROWS;rr++) for(let cc=0;cc<COLS;cc++){
        const tp=state.board[rr][cc];
        if(tp&&tp.player===mc&&tp.type!==T.KING&&(rr!==r||cc!==c)) state.validMoves.push({row:rr,col:cc});
      }
      renderAll();
      return;
    }
    state.disguiseMode=false;
    renderAll();
    return;
  }

  // 周子翰·乾坤大挪移：两阶段选棋互换（先敌方一子，再己方一子）
  // v19 重写：修复互换方向错误（原为"己方王与己方子互换"）、未存快照/历史、
  //   未校验将军/飞将、取消不回滚 extraMove 等恶性 Bug
  if(state.swapMode){
    const p=state.board[r][c];
    if(state.swapPhase==='self'){
      // 阶段2：选己方非王棋子与已锁定的敌方棋子互换
      if(p&&p.player===mc&&p.type!==T.KING){
        const A=state.swapTargetA, B={r,c};
        // 校验：互换后不能飞将、不能让己方王被将军
        const tmp=cloneBoard(state.board);
        const t=tmp[A.r][A.c];
        tmp[A.r][A.c]=tmp[B.r][B.c]; tmp[B.r][B.c]=t;
        if(kingsFacing(tmp)||isInCheck(tmp,mc)){
          speakTaunt('此处不可换！换后己方将帅受困！','self');
          renderAll(); return;
        }
        // 保存快照（仙帝回溯/悔棋依赖）
        state.boardSnapshots.push(cloneBoard(state.board));
        if(state.boardSnapshots.length>6) state.boardSnapshots.shift();
        const pieceA=state.board[A.r][A.c], pieceB=state.board[B.r][B.c];
        state.board[A.r][A.c]=pieceB; state.board[B.r][B.c]=pieceA;
        state.lastMove={from:{r:B.r,c:B.c},to:{r:A.r,c:A.c}};
        state.moveCount++;
        addHistoryEntry(pieceB,{r:B.r,c:B.c},{r:A.r,c:A.c},null);
        state.swapMode=false; state.swapPhase=null; state.swapTargetA=null;
        state.selected=null; state.validMoves=[];
        /* extraMove=1 保留：互换不耗回合，随后玩家连走两步（doMove 末尾递减） */
        speakTaunt(pick(getCurrentChar().skillLines),'self');
        updateSkillDisplay(); updateCapturedDisplay(); renderAll();
        return;
      }
      // 点错：返回阶段1重选敌方棋子
      state.swapPhase='enemy'; state.swapTargetA=null; state.validMoves=[];
      renderAll(); return;
    }
    // 阶段1：选敌方非王棋子
    if(p&&p.player!==mc&&p.type!==T.KING){
      state.swapTargetA={r,c};
      state.swapPhase='self';
      // 高亮己方可换的非王棋子
      state.validMoves=[];
      for(let rr=0;rr<ROWS;rr++) for(let cc=0;cc<COLS;cc++){
        const tp=state.board[rr][cc];
        if(tp&&tp.player===mc&&tp.type!==T.KING) state.validMoves.push({row:rr,col:cc});
      }
      speakTaunt('已锁敌'+PIECE_CHAR[p.player===RED?'red':'black'][p.type]+'，选己方一子互换！','self');
      renderAll(); return;
    }
    // 取消互换：回滚 extraMove，避免白嫖连走两步
    state.swapMode=false; state.swapPhase=null; state.swapTargetA=null;
    state.extraMove=0; state.selected=null; state.validMoves=[];
    speakTaunt('乾坤大挪移取消！','self');
    renderAll(); return;
  }

  const piece=state.board[r][c];
  if(!piece||piece.player!==state.currentPlayer){
    /* v14: 点击对方/空位 — 清除选中，但若点击的是对方棋子，进入"查看"模式
       用于查看对方棋子属性与 debuff，判断技能是否生效 */
    if(piece && piece.player!==state.currentPlayer){
      state.inspect={row:r,col:c}; /* 只读查看，不选中 */
    } else {
      state.inspect=null;
    }
    state.selected=null; state.validMoves=[]; renderAll(); return;
  }
  /* v14: 选中己方棋子时清除查看模式 */
  state.inspect=null;
  // 因果律锁：被锁定的棋子无法移动（PVP/PVE通用）
  if(state.lockedPiece&&r===state.lockedPiece.r&&c===state.lockedPiece.c){
    speakTaunt('因果律锁！此子被禁锢，无法移动！','self');
    state.selected={row:r,col:c};
    state.validMoves=[];
    renderAll();
    return;
  }
  state.selected={row:r,col:c};
  state.validMoves=getLegalMoves(state.board,r,c);
  /* v17: oppSlowTurns 减速 — PVP 下对方人类玩家也受限（限制车炮直线移动距离<=1）
     v19: 修复方向判断 — 用 skillOpp 判断"被减速方"，不再用 aiColor（PVP 黑方被减速时不生效） */
  if(state.oppSlowTurns>0 && state.validMoves.length>0){
    const _so = state.skillOwnerColor || state.playerColor;
    const _sopp = _so===RED?BLACK:RED;
    if(state.currentPlayer===_sopp){
      const piece=state.board[r][c];
      if(piece && (piece.type===T.ROOK || piece.type===T.CANNON)){
        state.validMoves = state.validMoves.filter(m=>{
          const dist = Math.abs(m.row-r) + Math.abs(m.col-c);
          return dist<=1;
        });
      }
    }
  }
  renderAll(); startPulse();
}
function tryMove(r,c){
  if(!state.selected) return false;
  // 周子翰·江山易主/优雅闪烁：执行传送（棋子移动到空位，不吃子）
  if(state.selected.teleport){
    const from={r:state.selected.row,c:state.selected.col};
    const to={r,c};
    if(state.board[to.r][to.c]){ return false; } // 必须是空位
    const piece=state.board[from.r][from.c];
    /* v19: 保存快照供仙帝回溯/悔棋（原缺失导致回溯跳过传送） */
    state.boardSnapshots.push(cloneBoard(state.board));
    if(state.boardSnapshots.length>6) state.boardSnapshots.shift();
    state.board[to.r][to.c]=piece;
    state.board[from.r][from.c]=null;
    /* v13: 优雅闪烁 — 瞬移后给该棋子挂 attackBoost buff（攻击+30%，2回合）
       v10 弱角色增强：瞬移后增加 50 点护盾（2回合） */
    if(state.teleportBuff>0){
      const atkBonus = Math.floor((piece.atk||0) * state.teleportBuff);
      addBuff(piece, 'attackBoost', atkBonus, 2);
      addBuff(piece, 'shield', 50, 2);
      state.teleportBuff=0;
      speakTaunt('优雅闪烁！瞬移完成，攻击+30%+护盾50！','self');
    } else if(state.blinkActive){
      /* v22 修复 Bug 3：blink（隐遁闪烁）瞬移完成后挂 immune buff 1 回合，
         替代原死代码 teleportUntrackable（全文件无读取点）。 */
      addBuff(piece, 'immune', 1, 1);
      state.blinkActive=false;
      speakTaunt('隐遁闪烁！瞬移完成，下回合免疫！','self');
    } else {
      speakTaunt('江山易主！乾坤挪移完成！','self');
    }
    state.teleportMode=false;
    state.selected=null;
    state.validMoves=[];
    state.lastMove={from:{...from},to:{...to}};
    state.moveCount++;
    addHistoryEntry(piece,from,to,null);
    updateSkillDisplay();
    renderAll();
    // 传送后切换回合（v19：补 tickBuffs，避免 buff 多挂一回合）
    tickBuffs(state.currentPlayer);
    advanceToNextPlayer();
    updateTurnIndicator(); updateCapturedDisplay();
    checkGameEnd();
    /* v30: 回合开始 — B王形态切换 + 色欲控制恢复 */
    if(!state.gameOver){
      checkBkingFormSwitch();
      processLustControlRecovery();
    }
    if(!state.gameOver&&(state.gameMode==='pve'||state.gameMode==='three')&&state.currentPlayer===state.aiColor) aiMove();
    return true;
  }
  // 鸡哥·完美伪装：执行两子互换
  if(state.selected.disguise){
    const from={r:state.selected.row,c:state.selected.col};
    const to={r,c};
    /* v19: 保存快照供回溯（原缺失） */
    state.boardSnapshots.push(cloneBoard(state.board));
    if(state.boardSnapshots.length>6) state.boardSnapshots.shift();
    // 执行互换（两颗己方棋子位置互换）
    const tmp=state.board[from.r][from.c];
    state.board[from.r][from.c]=state.board[to.r][to.c];
    state.board[to.r][to.c]=tmp;
    speakTaunt('完美伪装！位置互换完成！下次攻击必打偏！','self');
    state.disguiseMode=false;
    state.selected=null;
    state.validMoves=[];
    state.skillActive='disguise-confuse'; // 对方下次攻击打偏+反击
    state.lastMove={from:{...from},to:{...to}};
    state.moveCount++;
    addHistoryEntry(state.board[to.r][to.c],from,to,null);
    updateSkillDisplay();
    renderAll();
    // 互换后切换回合（v19：补 tickBuffs）
    tickBuffs(state.currentPlayer);
    advanceToNextPlayer();
    updateTurnIndicator(); updateCapturedDisplay();
    checkGameEnd();
    /* v30: 回合开始 — B王形态切换 + 色欲控制恢复 */
    if(!state.gameOver){
      checkBkingFormSwitch();
      processLustControlRecovery();
    }
    if(!state.gameOver&&(state.gameMode==='pve'||state.gameMode==='three')&&state.currentPlayer===state.aiColor) aiMove();
    return true;
  }
  if(!state.validMoves.some(m=>m.row===r&&m.col===c)) return false;
  doMove({r:state.selected.row,c:state.selected.col},{r,c});
  return true;
}
/* ===== buff 系统 =====
   棋子 buffs 数组元素：{ type, duration, value, _fresh }
   - weakness：攻击方获虚弱，下回合攻击力 -value（calcDamage 内读取）
   - _fresh：本回合新增标记，避免回合结束时立即被递减（保证"下回合"生效一次后再过期）
   回合结束（当前行动方走完）时，仅递减该方棋子的 buff duration，归零即移除。 */
const BUFF_DESC_MAP = {
  weakness: { name:'虚弱', desc:(b)=>`攻击-${Math.round((b.value||0.3)*100)}%` },
  ironwall:  { name:'铁壁', desc:()=>'防御×2' },
  shield:    { name:'护盾', desc:(b)=>`吸收${b.value||80}伤害` },
  silence:   { name:'沉默', desc:()=>'无法使用技能' },
  lock:      { name:'禁锢', desc:()=>'无法移动' },
  attackBoost: { name:'攻击强化', desc:(b)=>`攻击+${b.value||20}` },
  defenseBoost: { name:'防御强化', desc:(b)=>`防御+${b.value||20}` },
  executeMark: { name:'必中标记', desc:(b)=>`伤害+${Math.round((b.value||0.5)*100)}%` },
  reflect: { name:'反伤', desc:(b)=>`反弹${Math.round((b.value||0.3)*100)}%伤害` },
  immune: { name:'无敌', desc:()=>'免疫所有伤害' },
  preyMark: { name:'猎物标记', desc:()=>'防御归零，被吃时敌方回血' },
  pierce:  { name:'破防', desc:()=>'无视防御增益' },
  bkiller: { name:'弑王', desc:(b)=>`对B王棋子伤害+${Math.round((b.value||0.5)*100)}%` },
  defReduce: { name:'破甲', desc:(b)=>`防御-${Math.round((b.value||0.3)*100)}%` },
  vulnerability: { name:'易伤', desc:(b)=>`被攻击时受伤+${Math.round((b.value||0.5)*100)}%` }, /* v20 */
  trueDmgBoost: { name:'真伤强化', desc:(b)=>`攻击附带${b.value||20}真实伤害` } /* v30-fix: 暴怒技能 buff，补全显示避免英文 ID 泄露 */
};
function getBuffDesc(b){
  const m = BUFF_DESC_MAP[b.type];
  if(!m) return { name:b.type||'未知', desc:'' };
  return { name:m.name, desc:m.desc(b) };
}
/* v10: buff 紧凑图标映射，用于状态栏 buff-chip 显示 */
const BUFF_ICON_MAP = {
  shield: '🛡',
  attackBoost: '⚔',
  defenseBoost: '🏰',
  weakness: '↓',
  ironwall: '🏰',
  executeMark: '⚡',
  reflect: '↩',
  immune: '✦',
  vulnerability: '✗',
  silence: '🤐',
  defReduce: '↓',
  lock: '🔒',
  preyMark: '🎯',
  pierce: '↯',
  bkiller: '☠',
  trueDmgBoost: '🔥' /* v30-fix: 暴怒技能 buff 图标 */
};
function tickBuffs(player){
  if(!player) return;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(!p || p.player!==player) continue;
    /* v34: 仙兵消散 — 万仙来朝召唤的临时棋子，3 回合后消散 */
    if(p._immortalSoldier){
      p._immortalTurnsLeft--;
      if(p._immortalTurnsLeft<=0){
        state.board[r][c]=null;
        if(typeof addBattleLog==='function') addBattleLog('state', '<b>仙兵消散</b> 万仙之力散去，仙兵归天');
        continue;
      }
    }
    /* v35-fix P0-Bug7: 诛仙剑 _zhuxianTurnsLeft 递减统一由 tickZhuxianFormation 处理
       （原在 tickBuffs 中递减，导致只在施法方回合递减，阵法持续过长）*/
    /* v34: 万仙加持 buff — 每回合回 10% 血 */
    if(p.buffs){
      const hasWanxian = p.buffs.some(b => b.type==='wanxianBlessing');
      if(hasWanxian && p.maxHp){
        const heal = Math.floor(p.maxHp * 0.10);
        p.hp = Math.min(p.maxHp, p.hp + heal);
      }
    }
    if(!p.buffs) continue;
    for(const b of p.buffs){
      if(b._fresh){ b._fresh=false; continue; } /* 本回合新增：跳过首次递减 */
      if(b._aura===true) continue; /* v22 P2 Bug 1: AURA 光环 buff 不递减，由光环每回合重新施加 */
      if(b._permanent===true) continue; /* 永久 buff 不递减（如传说觉醒的溢出的气） */
      if(b.duration<=0) continue; /* v22 P2 Bug 7: duration<=0 视为永久 buff，跳过递减 */
      b.duration--;
    }
    /* v22 P2 Bug 7: 保留永久 buff（duration<=0）和 _aura buff，以及 _permanent buff */
    p.buffs = p.buffs.filter(b => b.duration>0 || b._aura===true || b._permanent===true);
    if(p.buffs.length===0) delete p.buffs;
  }
}
/* v34: 诛仙剑阵斩杀检查 — 在 advanceToNextPlayer 中由对方走完一步后调用
   遍历棋盘所有带 zhuxianMark 标记且 hp/maxHp < 50% 的棋子，直接斩杀（无视免疫/护盾） */
function tickZhuxianMark(){
  if(!state.board) return;
  let killed = 0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = state.board[r][c];
    if(!p || !p.buffs) continue;
    const mark = p.buffs.find(b => b.type==='zhuxianMark');
    if(!mark) continue;
    /* 血量低于 50% 直接被斩杀（无视免疫/护盾/金仙之体）*/
    if(p.maxHp && p.hp < p.maxHp * 0.5){
      p.hp = 0;
      state.board[r][c] = null;
      pushCaptured(p);
      killed++;
      if(typeof addBattleLog==='function'){
        const charName = (typeof PIECE_CHAR!=='undefined' && PIECE_CHAR[p.player===RED?'red':'black']) ?
          PIECE_CHAR[p.player===RED?'red':'black'][p.type] : '?';
        addBattleLog('skill', `<b>诛仙斩杀</b> ${charName}（${r+1}行${c+1}列）血量低于50%被诛仙剑阵斩杀！无视免疫/护盾`);
      }
    }
  }
  if(killed > 0){
    if(typeof speakTaunt==='function') speakTaunt(`诛仙剑出！${killed} 仙应劫而亡！`,'self');
    if(typeof updateCapturedDisplay==='function') updateCapturedDisplay();
  }
  state.zhuxianExecuteCheck = false;  /* 一次性消耗 */
}

/* v35: 诛仙剑阵·阵法闭合引爆 — 在 advanceToNextPlayer 中调用
   v35-fix P0-Bug2/7: 只在对方回合切换时触发持续伤害（避免双重伤害），
                       统一在此处递减 _zhuxianTurnsLeft（避免只在施法方回合递减）
   1. 剑阵持续期间（对方回合结束）：剑阵范围内（曼哈顿距离≤2）的敌方棋子受30真实伤害+禁锢
   2. _zhuxianTurnsLeft 归零后阵法闭合：引爆造成一次性巨额真实伤害（maxHp×40%，无视免疫/护盾），清除剑 */
function tickZhuxianFormation(){
  if(!state.board || !state.zhuxianFormationActive) return;
  /* 收集所有诛仙剑位置 */
  const swords=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(p && p._zhuxianSword) swords.push({r,c,p});
  }
  if(swords.length===0){
    state.zhuxianFormationActive = false;
    return;
  }
  const mc = swords[0].p.player;
  const oc = mc===RED ? BLACK : (mc===BLACK ? RED : null);
  if(oc===null) return;
  /* v35-fix P0-Bug2: 只在对方回合结束时触发持续伤害（避免双重伤害）
     advanceToNextPlayer 在 currentPlayer 切换前调用，此时 currentPlayer 仍是刚走完的一方。
     我们要在对方走完时（即 currentPlayer===oc）造成伤害，让伤害感觉是"对方走入剑阵"。
     但更合理的设计是：施法方回合结束时施压（currentPlayer===mc）。
     修正：只在施法方回合结束时造成持续伤害（让对方在自己回合感受到压力）。 */
  if(state.currentPlayer !== mc) return;
  /* v35-fix P0-Bug7: 统一在此处递减 _zhuxianTurnsLeft（每施法方回合递减1）*/
  for(const s of swords){
    s.p._zhuxianTurnsLeft--;
  }
  /* 检查是否需要闭合引爆（所有剑的 _zhuxianTurnsLeft 都<=0）*/
  const shouldDetonate = swords.every(s=>s.p._zhuxianTurnsLeft<=0);
  if(shouldDetonate){
    /* 阵法闭合引爆 */
    let killed = 0;
    /* 引爆：对所有敌方棋子造成 maxHp×40% 真实伤害（无视免疫/护盾）*/
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const p = state.board[r][c];
      if(!p || p.player!==oc) continue;
      const dmg = Math.floor((p.maxHp||100) * 0.25);
      p.hp = Math.max(0, p.hp - dmg);
      if(p.hp<=0){
        state.board[r][c] = null;
        pushCaptured(p);
        killed++;
      }
    }
    /* 清除所有诛仙剑 */
    for(const s of swords){
      state.board[s.r][s.c] = null;
    }
    speakTaunt('诛仙阵成！四剑闭合！天地同灭！','self');
    addBattleLog('skill', `<b>诛仙剑阵·阵法闭合</b> 四剑引爆！敌方全体受 maxHp×25% 真实伤害（无视免疫/护盾）${killed>0?`，斩杀 ${killed} 棋子`:''}`);
    state.zhuxianFormationActive = false;
    if(typeof updateCapturedDisplay==='function') updateCapturedDisplay();
    if(typeof highlightPieces==='function'){
      const hl=swords.map(s=>({r:s.r, c:s.c, label:'阵法闭合', color:'#8b0000'}));
      highlightPieces(hl, 4000);
    }
    return;
  }
  /* 剑阵持续期间：剑阵范围内敌方受真实伤害+禁锢 */
  let dmgCount=0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = state.board[r][c];
    if(!p || p.player!==oc) continue;
    /* 检查是否在任意剑的范围内（曼哈顿距离≤2）*/
    const inRange = swords.some(s=>Math.abs(s.r-r)+Math.abs(s.c-c)<=2);
    if(!inRange) continue;
    /* 受30真实伤害 */
    p.hp = Math.max(0, p.hp - 30);
    if(p.hp<=0){
      state.board[r][c] = null;
      pushCaptured(p);
      dmgCount++;
    } else {
      /* 施加禁锢buff（1回合，无法移动）*/
      addBuff(p, 'lock', 1, 1);
    }
  }
  if(dmgCount>0){
    addBattleLog('skill', `<b>诛仙剑阵</b> 剑意绞杀！${dmgCount} 棋子被斩杀`);
    if(typeof updateCapturedDisplay==='function') updateCapturedDisplay();
  }
}
/* v34: 通天彻地反噬处理 — 已删除（通天彻地改为禁锢+被动失效+连走，不再需要自身反噬）*/
/* ===== v30: B王形态切换系统 =====
   故事模式（state.storyChapterId 标识）下，每 BKING_FORM_SWITCH_INTERVAL 回合
   切换一次 B王 战斗形态，移除旧形态 buff 并应用新形态 buff。
   形态 buff 通过 _bkingForm=true 标记，避免与其他技能 buff 冲突。
   说明：故事战斗中 gameMode 实际为 'pve'/'three'（见 startStoryChapter），
   故以 state.storyChapterId 作为故事模式判定依据。 */
function addBkingFormBuff(piece, type, value, duration){
  if(!piece || !type) return;
  if(!piece.buffs) piece.buffs = [];
  /* v31-fix P1: 狡诈形态 buffDurationBonus — buff 持续时间 +1 */
  const durBonus = (state.bkingFormMods && state.bkingFormMods.buffDurationBonus) || 0;
  piece.buffs.push({
    type: type,
    value: value,
    duration: duration + durBonus,
    _fresh: true,
    _bkingForm: true
  });
}
function checkBkingFormSwitch(){
  if(!state.storyChapterId) return;
  if(state.gameMode==='pvp' || state.gameMode==='online') return;
  if(state.gameMode==='faction' || state.gameMode==='4v4') return;
  if(typeof BKING_FORMS==='undefined' || typeof BKING_FORM_CYCLE==='undefined' || typeof BKING_FORM_SWITCH_INTERVAL==='undefined') return;
  if(state.moveCount<=0 || state.moveCount % BKING_FORM_SWITCH_INTERVAL !== 0) return;

  const curIdx = state.bkingCurrentForm ? BKING_FORM_CYCLE.indexOf(state.bkingCurrentForm) : -1;
  const nextIdx = (curIdx + 1) % BKING_FORM_CYCLE.length;
  const nextFormKey = BKING_FORM_CYCLE[nextIdx];
  const form = BKING_FORMS[nextFormKey];
  if(!form) return;

  const aiColor = state.aiColor || BLACK;

  /* 移除上一形态的 buff（标记 _bkingForm=true） */
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const p = state.board[r][c];
      if(!p || p.player!==aiColor || !p.buffs) continue;
      p.buffs = p.buffs.filter(b => !b._bkingForm);
      if(p.buffs.length===0) delete p.buffs;
    }
  }

  /* 应用新形态的 buff（多挂 1 回合避免切换瞬间被 tickBuffs 清掉） */
  const duration = BKING_FORM_SWITCH_INTERVAL + 1;
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const p = state.board[r][c];
      if(!p || p.player!==aiColor) continue;
      if(form.atkMul && form.atkMul > 1.0){
        const atkBonus = Math.floor((p.atk || 0) * (form.atkMul - 1));
        if(atkBonus > 0) addBkingFormBuff(p, 'attackBoost', atkBonus, duration);
      }
      if(form.defMul && form.defMul > 1.0){
        const defBonus = Math.floor((p.def || 0) * (form.defMul - 1));
        if(defBonus > 0) addBkingFormBuff(p, 'defenseBoost', defBonus, duration);
      }
      if(form.defMul && form.defMul < 1.0){
        addBkingFormBuff(p, 'defReduce', 1 - form.defMul, duration);
      }
      if(form.hpRegen && (p.maxHp || 0) > 0 && p.hp < p.maxHp){
        p.hp = Math.min(p.maxHp, p.hp + form.hpRegen);
      }
    }
  }

  /* v31-fix P1: 形态切换 3 个字段未应用 — cdReduce / buffDurationBonus / selfAttackChance
     原代码只应用了 atkMul/defMul/hpRegen 三个字段，导致"进攻/狡诈形态"声称的"技能CD-1"
     实际无效，"疯狂形态"的"攻击己方"完全无效。
     现将这 3 个字段存入 state.bkingFormMods，由 maybeAISkill / tickBuffs / aiMove 读取。 */
  state.bkingFormMods = state.bkingFormMods || {};
  state.bkingFormMods.cdReduce = form.cdReduce || 0;
  state.bkingFormMods.buffDurationBonus = form.buffDurationBonus || 0;
  state.bkingFormMods.selfAttackChance = form.selfAttackChance || 0;

  state.bkingCurrentForm = nextFormKey;

  if(typeof addBattleLog==='function'){
    addBattleLog('state', `<b>B王形态切换</b> → ${form.icon||''} <b>${form.name}</b>（${form.desc||''}）`);
  }
  if(typeof speakTaunt==='function'){
    speakTaunt(`${form.icon||''} ${form.name}！${form.desc||''}`, 'bking');
  }
  renderAll();
}
/* v30: 色欲控制棋子恢复 — 每回合开始递减 _lustControlTurns，
   归零时恢复 piece.player 为原属方并清理标记。 */
function processLustControlRecovery(){
  if(!state.lustControlledPieces || state.lustControlledPieces.length===0) return;
  const remaining = [];
  let changed = false;
  for(const entry of state.lustControlledPieces){
    const p = entry.piece;
    if(!p || !p._lustControlled){
      /* v31-fix P2: 色欲控制的棋子被吃/移除时输出战报提示 */
      if(!p || !state.board.flat().includes(p)){
        if(typeof addBattleLog==='function'){
          addBattleLog('state', `<b>色欲·魅惑人心</b> 控制的棋子已被击杀，控制解除`);
        }
      }
      changed = true; continue;
    }
    p._lustControlTurns = (p._lustControlTurns || 0) - 1;
    if(p._lustControlTurns <= 0){
      p.player = p._originalPlayer;
      delete p._lustControlled;
      delete p._originalPlayer;
      delete p._lustControlTurns;
      changed = true;
      if(typeof addBattleLog==='function'){
        addBattleLog('state', '色欲控制解除，棋子回归原主');
      }
    } else {
      remaining.push(entry);
    }
  }
  state.lustControlledPieces = remaining;
  if(changed) renderAll();
}
/* v22: 检查并执行 predForcedMoves 强制走法
   返回 true 表示命中并已调度执行，false 表示未命中或走法非法。
   - gameMode 守卫：仅在 pvp/online 下生效（与 set 点 forceOpponentRandomMove 一致）
   - aoeLockdownTurns 守卫：被禁锢方优先执行禁锢逻辑，强制走法作废（避免 aoeLockdownTurns 永久残留）
   - 合法性校验：from 处有棋子且属于 currentPlayer（防止坐标过期崩盘）
   - 交互锁：设置 state.forcedMovePending + 保存 timer ID，阻止 800ms 延迟内玩家抢操作
   - setTimeout 回调重新校验：防止 800ms 内棋盘变化导致崩盘 */
function tryConsumeForcedMove(){
  if(state.gameOver) return false;
  if(state.gameMode!=='pvp' && state.gameMode!=='online') return false;
  if(!state.predForcedMoves || !state.predForcedMoves[state.currentPlayer]) return false;
  /* aoeLockdownTurns 守卫：被禁锢方优先执行禁锢逻辑，强制走法作废 */
  const _skillOwner = state.skillOwnerColor || state.playerColor;
  const _skillOpp = _skillOwner===RED?BLACK:RED;
  if(state.aoeLockdownTurns>0 && state.currentPlayer===_skillOpp){
    delete state.predForcedMoves[state.currentPlayer];
    if(typeof addBattleLog==='function') addBattleLog('state', `被禁锢方预测走法作废`);
    return false;
  }
  const cm = state.predForcedMoves[state.currentPlayer];
  delete state.predForcedMoves[state.currentPlayer];
  /* 合法性校验：走法可能已过期（棋子被吃/移动/被替换） */
  const piece = state.board[cm.from.r] && state.board[cm.from.r][cm.from.c];
  if(!piece || piece.player !== state.currentPlayer){
    if(typeof addBattleLog==='function') addBattleLog('state', `预测走法已失效（棋子已移动），跳过强制走子`);
    return false;
  }
  /* 交互锁：阻止 800ms 内玩家抢操作导致回合错乱 */
  state.forcedMovePending = true;
  /* 取消上一个未执行的 forced move timer，避免跨局残留 */
  if(state.forcedMoveTimer){ clearTimeout(state.forcedMoveTimer); }
  speakTaunt('被预测命中！只能按对方的算计走...');
  if(typeof addBattleLog==='function') addBattleLog('state', `<b>${state.currentPlayer===RED?'红方':'黑方'}</b> 被预测命中，强制走子`);
  state.forcedMoveTimer = setTimeout(()=>{
    state.forcedMovePending = false;
    state.forcedMoveTimer = null;
    if(state.gameOver) return; /* 期间游戏可能已结束 */
    /* 重新校验棋子合法性：800ms 内棋盘可能因技能/undo/网络消息变化 */
    const p = state.board[cm.from.r] && state.board[cm.from.r][cm.from.c];
    if(!p || p.player !== state.currentPlayer){
      if(typeof addBattleLog==='function') addBattleLog('state', `预测走法执行时校验失败，跳过`);
      return;
    }
    doMove(cm.from, cm.to);
  }, 800);
  return true;
}
function doMove(from,to){
  const piece=state.board[from.r][from.c];
  let captured=state.board[to.r][to.c];
  /* 技能激活者颜色（PVP/PVE通用）：PVE默认为playerColor */
  const skillOwner = state.skillOwnerColor || state.playerColor;
  const skillOpp = skillOwner===RED?BLACK:RED;

  /* v30-fix P0-4: 袁清山·潜龙勿用 — 隐藏棋子无法被对方攻击/锁定/吃掉
     原实现仅渲染雾化（drawPiece 的 isHidden 标志），实战完全失效。
     现在在 doMove 入口检查：若攻击目标为激活方隐藏棋子且攻击者非激活方，
     则攻击落空，对方仍消耗这一步。 */
  if(state.hiddenPiece && state.hiddenPiece.turns>0 && captured){
    const isHiddenTarget = (state.hiddenPiece.r===to.r && state.hiddenPiece.c===to.c);
    if(isHiddenTarget && state.currentPlayer===skillOpp){
      speakTaunt('潜龙勿用！攻击落空，目标不可被锁定！','self');
      if(typeof addBattleLog==='function') addBattleLog('skill', '<b>潜龙勿用</b> 隐藏棋子免疫攻击，本次走子落空');
      /* 走子落空：仅移动攻击方到目标位（无法吃子），等同于普通移动到空位
         实际上目标位有隐藏棋子，所以这里改为不动攻击方（消耗一回合） */
      /* 推进回合：让对方消耗这一步 */
      if(typeof advanceToNextPlayer==='function'){
        advanceToNextPlayer();
      }
      return;
    }
  }

  // 三金·铜墙铁壁：被保护的棋子无法被吃，攻击者反被吃掉
  if(state.ironwallTarget&&state.ironwallTurns>0&&state.currentPlayer===skillOpp&&captured){
    if(to.r===state.ironwallTarget.r&&to.c===state.ironwallTarget.c){
      speakTaunt('铜墙铁壁！攻击无效，反击吃掉攻击者！','self');
      const attacker=state.board[from.r][from.c];
      if(attacker.player===skillOpp){
        if(attacker.player===RED) state.redCaptured.push(attacker); else state.blackCaptured.push(attacker);
        state.board[from.r][from.c]=null;
        captured=null;
      }
      state.ironwallTarget=null;
      state.ironwallTurns=0;
      if(state.skillActive==='ironwall-active') state.skillActive=null;
    }
  }

  // 鸡哥·完美伪装：对方攻击打偏+真身反击
  if(state.skillActive==='disguise-confuse'&&state.currentPlayer===skillOpp&&captured&&captured.player===skillOwner){
    /* v22 修复 Bug 5：描述"下次攻击打偏"为必然事件，原 50% 概率与描述不符，改为必然打偏 */
    if(true){
      speakTaunt('完美伪装！打偏了！反击！','self');
      const attacker=state.board[from.r][from.c];
      if(attacker.player===skillOpp){
        if(attacker.player===RED) state.redCaptured.push(attacker); else state.blackCaptured.push(attacker);
        state.board[from.r][from.c]=null;
        captured=null;
      }
    }
    state.skillActive=null;
  }

  // v16: 鸡哥·虚晃一枪（oppMissNext）：对方下回合攻击打偏
  if(state.oppMissNext&&state.currentPlayer===skillOpp&&captured){
    speakTaunt('虚晃一枪！攻击打偏了！','self');
    state.oppMissNext=false; /* 一次性消耗 */
    state.selected=null; state.validMoves=[];
    renderAll();
    return; /* 攻击失败，回合不消耗 */
  }

  // 仙帝护盾：技能激活方棋子不可被吃
  /* v22 修复 PVP 恶性 bug：原逻辑用 getLegalAIMoves + Math.random() 替对方"改走法"，
     PVE 下替 AI 改走法合理，但 PVP 下对方是人类玩家，强行改走法会导致
     "对方点的吃子 → 系统随机漂移到别处"，玩家根本不知道发生了什么。
     PVP 下应直接 return 阻止吃子，让人类玩家自己重新选。 */
  if(state.celestialShield&&state.currentPlayer===skillOpp&&captured&&captured.player===skillOwner){
    if(state.gameMode==='pvp'||state.gameMode==='online'){
      speakTaunt('仙帝护盾！此子不可被吃！','self');
      return; /* PVP：直接阻止，让人类玩家自己重选 */
    }
    /* PVE：AI 自动换路走 */
    const altMoves=getLegalAIMoves(state.board,skillOpp).filter(m=>!state.board[m.tr][m.tc]||state.board[m.tr][m.tc].player!==skillOwner);
    if(altMoves.length>0){
      const m=altMoves[Math.floor(Math.random()*altMoves.length)];
      to={r:m.tr,c:m.tc};
      captured=state.board[to.r][to.c];
      speakTaunt('仙帝护盾？换一路走！');
    }
  }

  // 铜墙铁壁/课堂点名/异常捕获：对方不能吃子
  /* v22 修复 PVP 恶性 bug：同上，PVP 下直接 return，不再替人类玩家随机改走法。
     原"随机改走法"导致异常捕获/课堂点名释放后，对方点击吃子时棋子被漂移到
     随机空位，玩家以为是 bug。现 PVP 下明确提示并阻止，让玩家自己重选。 */
  if((state.skillActive==='shield'||state.skillActive==='catch-shield')&&state.currentPlayer===skillOpp&&captured){
    if(state.gameMode==='pvp'||state.gameMode==='online'){
      speakTaunt(state.skillActive==='catch-shield'?'异常捕获！此子吃不了！':'课堂点名！此子吃不了！','self');
      return; /* PVP：直接阻止 */
    }
    /* PVE：AI 自动换路走 */
    const altMoves=getLegalAIMoves(state.board,skillOpp).filter(m=>!state.board[m.tr][m.tc]);
    if(altMoves.length>0){
      const m=altMoves[Math.floor(Math.random()*altMoves.length)];
      to={r:m.tr,c:m.tc};
      captured=state.board[to.r][to.c];
      speakTaunt(state.skillActive==='catch-shield'?'异常捕获！攻击无效！':'被点名了？换一路走！');
    }
  }

  // B王洞察：玩家不能吃子（PVE下玩家被禁制）
  if(state.playerCannotCapture&&state.currentPlayer===state.playerColor&&captured){
    speakTaunt('禁制！这步吃不了！');
    return;
  }
  /* v17: 刘佳伟·以退为进 / 解宇轩·异常捕获：对方下回合禁吃
     oppCannotCapture 由技能设置，skillOpp 走棋时检查并阻止吃子 */
  if(state.oppCannotCapture&&state.currentPlayer===skillOpp&&captured){
    speakTaunt('以退为进！这步吃不了！');
    return;
  }

  // 保存快照用于仙帝回溯（最多保留6步）
  state.boardSnapshots.push(cloneBoard(state.board));
  if(state.boardSnapshots.length>6) state.boardSnapshots.shift();

  const histEntry={
    /* v16: 深克隆 buffs，避免 doMove 中 consumeBuff/新增 buff 污染悔棋快照 */
    from:{...from},to:{...to},
    piece: piece ? {...piece, buffs: piece.buffs ? piece.buffs.map(b=>({...b})) : undefined} : null,
    captured: captured ? {...captured, buffs: captured.buffs ? captured.buffs.map(b=>({...b})) : undefined} : null,
    player:state.currentPlayer,
    /* 保存技能状态快照，用于悔棋时同步CD */
    skillSnap:{
      rsps:state.roundsSincePlayerSkill, rsas:state.roundsSinceAISkill, rp2s:state.roundsSinceP2Skill,
      psl:state.playerSkillLock, p2sl:state.p2SkillLock, asl:state.aiSkillLock,
      wat:state.weakenedAITurns, iwt:state.ironwallTurns,
      lt:state.lockTurns, st:state.silenceTurns,
      sa:state.skillActive,
      /* v17: 保存技能封锁状态，悔棋时恢复 */
      asb:state.aiSkillBlocked, osbc:state.oppSkillBlockedColor
    },
    /* v5.0 战斗系统：实际被消灭的棋子（悔棋时据此 pop 阵亡名单） */
    actualCaptured:null
  };
  state.history.push(histEntry);
  state.board[to.r][to.c]=piece;
  state.board[from.r][from.c]=null;

  // 联机模式：本地走棋后同步给对方
  if(state.gameMode==='online'&&!netSuppressSend&&state.currentPlayer===netMyColor){
    netSendMove(from,to);
  }

  if(captured){
    /* v4.0 闪避被动：dodgeNext 时撤销吃子（来自上一次未消耗的闪避标记） */
    if(state.dodgeNext){
      state.dodgeNext=false;
      speakTaunt('闪避！攻击落空！');
      /* 棋子保留原位，吃子失败 */
      state.board[from.r][from.c]=piece;
      state.board[to.r][to.c]=captured;
      state.selected=null; state.validMoves=[];
      renderAll();
      return;
    }
    /* v22 修复 Bug 3：闪避被动在 calcDamage 之前预检
       p_dodge/p_elegant/p_shield 原在 on_captured 中设 dodgeNext，
       但那时伤害已结算，闪避无效。现改为伤害前预检，命中则直接取消攻击。 */
    if(typeof tryDodgePassive==='function' && tryDodgePassive(captured, piece)){
      /* 闪避成功：棋子保留原位，吃子失败，回合不消耗 */
      state.board[from.r][from.c]=piece;
      state.board[to.r][to.c]=captured;
      state.selected=null; state.validMoves=[];
      renderAll();
      return;
    }
    /* v5.0 战斗系统：攻击方与防守方互相造成伤害（兵种相克）
       v13: calcDamage 统一读取 buff 系统，并返回反伤/免疫/executeMark 消耗信息 */
    const attacker=piece, defender=captured;
    const dmg=calcDamage(attacker, defender);
    /* v4.0 被动战斗修饰：attackBoost/bkingAtkDebuff/AURA 光环应用到伤害 */
    if(typeof applyPassiveCombatMods==='function'){
      applyPassiveCombatMods(attacker, defender, dmg);
    }
    const dmgToDefender=dmg.defenderDmg;
    const dmgToAttacker=dmg.attackerDmg;
    /* v10: 马真实伤害 — 无视 immune 和 shield，独立结算（与 makeMv 一致） */
    if(dmg.trueDmg > 0){
      defender.hp -= dmg.trueDmg;
    }
    /* v13: 防守方免疫时双方不掉血
       v27: 区分 heroDodge（敏捷系闪避）与普通 immune buff 提示
       v32: 区分 weatherMiss（天气未命中），原显示"免疫！"让玩家误以为天气没生效 */
    if(dmg.defenderImmune){
      attacker.hp -= 0; defender.hp -= 0;
      if(dmg.weatherMiss){
        /* 天气导致的未命中（如雾-10%）— 不消耗 executeMark，不计为闪避 */
        const w = (typeof WEATHER_TYPES!=='undefined' && state.weather) ? WEATHER_TYPES[state.weather] : null;
        const wname = w ? w.name : '天气';
        speakTaunt(`${wname}气遮蔽！攻击未命中！`);
        if(typeof addBattleLog==='function') addBattleLog('state', `<b>${wname}气遮蔽</b> 攻击因天气未命中！攻击落空`);
        if(typeof showProcNotice==='function') showProcNotice(`${wname}气未命中`, `${w ? w.name : '天气'}导致攻击偏离目标`, 'dodge');
      } else if(dmg.heroDodge){
        speakTaunt('敏捷闪避！攻击落空！');
        if(typeof addBattleLog==='function') addBattleLog('state', `<b>敏捷闪避</b> ${defender.charId||'防守方'} 闪避触发！攻击落空`);
        if(typeof showProcNotice==='function') showProcNotice('骑兵闪避！', '马躲避了炮的攻击', 'dodge');
      } else {
        speakTaunt('免疫！伤害无效！');
        if(typeof addBattleLog==='function') addBattleLog('state', `<b>免疫</b> 防守方免疫效果，伤害无效`);
      }
    } else {
      /* v30-fix P0-5/P1-1: 攻击方受到的伤害（attackerDmg + reflectDmg）
         优先被攻击方 shield 吸收。原实现直接扣血，导致护盾对反伤无效，
         车打帅时 50 反伤直接杀死攻击方（即使有护盾）。 */
      let attackerDmgRemaining = dmgToAttacker;
      if(attackerDmgRemaining > 0 && attacker.buffs){
        let absorbed = 0;
        for(const b of attacker.buffs){
          if(b.type === 'shield' && (b.value || 0) > 0 && attackerDmgRemaining > 0){
            const use = Math.min(b.value, attackerDmgRemaining);
            b.value -= use;
            attackerDmgRemaining -= use;
            absorbed += use;
          }
        }
        if(absorbed > 0){
          attacker.buffs = attacker.buffs.filter(b => !(b.type === 'shield' && (b.value || 0) <= 0));
          if(attacker.buffs.length === 0) delete attacker.buffs;
        }
      }
      attacker.hp -= attackerDmgRemaining;
      defender.hp-=dmgToDefender;
      /* v13: 反伤 buff（reflect）— 由 calcDamage 计算并返回
         v30-fix: 反伤也优先被攻击方 shield 吸收 */
      if(dmg.reflectDmg > 0){
        let reflectRemaining = dmg.reflectDmg;
        if(attacker.buffs){
          for(const b of attacker.buffs){
            if(b.type === 'shield' && (b.value || 0) > 0 && reflectRemaining > 0){
              const use = Math.min(b.value, reflectRemaining);
              b.value -= use;
              reflectRemaining -= use;
            }
          }
          attacker.buffs = attacker.buffs.filter(b => !(b.type === 'shield' && (b.value || 0) <= 0));
          if(attacker.buffs.length === 0) delete attacker.buffs;
        }
        if(reflectRemaining > 0){
          attacker.hp -= reflectRemaining;
          speakTaunt('反伤！反弹'+dmg.reflectDmg+'伤害！');
        } else if(absorbed > 0){
          speakTaunt('护盾吸收反伤！');
        }
      }
    }
    /* v10: 车一击必杀自损（immune 时 attackerSelfDmg=0，不会扣血，与 makeMv 一致） */
    if(dmg.attackerSelfDmg > 0){
      attacker.hp -= dmg.attackerSelfDmg;
    }
    /* v13: 消耗 executeMark buff（必中标记：攻击命中后移除） */
    if(dmg.executeMarkBuff){
      consumeBuff(attacker, 'executeMark');
    }
    /* v13: 消耗 shield buff（护盾吸收：攻击命中后实际扣除护盾值）
       calcDamage 仅计算吸收量（shieldConsumed），由 doMove 实际扣除，
       避免 makeMv/undoMv 模拟（minimax/getBestMove）永久消耗真实棋盘的 shield。 */
    if(dmg.shieldConsumed > 0 && defender.buffs){
      let remaining = dmg.shieldConsumed;
      for(const b of defender.buffs){
        if(b.type === 'shield' && remaining > 0){
          const used = Math.min(b.value || 0, remaining);
          b.value = (b.value || 0) - used;
          remaining -= used;
        }
      }
      defender.buffs = defender.buffs.filter(b => !(b.type === 'shield' && (b.value || 0) <= 0));
      if(defender.buffs.length === 0) delete defender.buffs;
    }
    /* v20: 消耗 vulnerability buff（易伤标记：被攻击命中后移除） */
    consumeBuff(defender, 'vulnerability');
    /* 规则5：非炮打相/士 → 攻击方获虚弱 buff
       重新赋值新数组，避免与 histEntry.piece 的浅拷贝共享引用（悔棋还原时干净）
       v22 修复 Bug 11：原直接 push 不合并，若攻击方已有 weakness buff 会叠加两个，
       calcDamage 中 atkMul *= (1-0.3) 被乘两次导致攻击力指数级衰减。
       改用 addBuff 合并同类 buff。 */
    if(dmg.attackerBuff){
      addBuff(attacker, dmg.attackerBuff.type, dmg.attackerBuff.value, dmg.attackerBuff.duration);
      /* addBuff 不会重置 _fresh（已存在则保留），但新加的 buff 已自带 _fresh=true */
      attacker.buffs = attacker.buffs ? attacker.buffs.map(b=>({...b})) : attacker.buffs;
    }
    if(defender.hp<=0){
      /* 防守方阵亡：攻击方占据目标位置，防守方入阵亡名单，触发被动 */
      histEntry.actualCaptured=defender;
      pushCaptured(defender);
      if(state.gameMode==='pve'&&state.currentPlayer===state.aiColor) speakTaunt(pick(B_TAUNTS.capture));
      /* v22: 战报 — 吃子击杀 */
      addBattleLog('capture', `<b>${PIECE_CHAR[attacker.player===RED?'red':'black'][attacker.type]}</b>(${attacker.hp}HP) 击杀 <b>${PIECE_CHAR[defender.player===RED?'red':'black'][defender.type]}</b>，造成 ${dmg.defenderDmg} 伤害`);
      /* v19: 大爱仙尊·算计连环 — 猎物被诛时己方全体回复其 maxHP 的 40% */
      if(defender.buffs && defender.buffs.some(b=>b.type==='preyMark')){
        const healMax=Math.floor((defender.maxHp||defender.hp||100)*0.4);
        const healColor=attacker.player;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===healColor&&p.maxHp) p.hp=Math.min(p.maxHp,p.hp+healMax);
        }
        speakTaunt('猎物已诛，因果回收...回复'+healMax+'！','self');
      }
      if(typeof passivesOnCapture==='function'){
        let capturerChar, victimChar;
        if(state.gameMode==='faction'||state.gameMode==='4v4'){
          /* v5.0 多阵营：按 multiPlayers 找对应颜色角色 */
          const capMp=state.multiPlayers.find(p=>p.color===state.currentPlayer);
          const vicMp=state.multiPlayers.find(p=>p.color===defender.player);
          capturerChar=capMp?capMp.char:state.character;
          victimChar=vicMp?vicMp.char:state.character;
        } else {
          capturerChar = state.currentPlayer===state.playerColor?state.character:(state.gameMode==='pvp'?(state.currentPlayer===RED?state.pvpRedChar:state.pvpBlackChar):'bking');
          victimChar = defender.player===state.playerColor?state.character:(state.gameMode==='pvp'?(defender.player===RED?state.pvpRedChar:state.pvpBlackChar):'bking');
        }
        passivesOnCapture(capturerChar, defender, from.r, from.c, to.r, to.c);
        passivesOnCaptured(victimChar, capturerChar, defender, attacker);
      }
      /* v16: 同归于尽 — 攻击方也阵亡，入阵亡名单并清空位置（之前攻击方 hp<=0 仍占据棋盘） */
      if(attacker.hp<=0){
        histEntry.actualAttackerCaptured=attacker;
        pushCaptured(attacker);
        state.board[to.r][to.c]=null; /* 攻击方也移出棋盘 */
        speakTaunt('同归于尽！');
        /* v22: 战报 — 同归于尽 */
        addBattleLog('capture', `<b>${PIECE_CHAR[attacker.player===RED?'red':'black'][attacker.type]}</b> 与 <b>${PIECE_CHAR[defender.player===RED?'red':'black'][defender.type]}</b> 同归于尽！`);
      }
      /* v23 P0-4: 三金·狂战之怒 — ironwall 棋子吃子后复活1颗最近被吃的己方棋子。
         ironwallRevivePending 一次性消耗（与 data.js 描述"回血1子"对齐）。
         即使同归于尽也触发（描述为"吃子后"，不限定攻击方存活）。 */
      if(state.ironwallPiece && state.ironwallRevivePending && attacker===state.ironwallPiece){
        let reviveCharId=null;
        if(state.gameMode==='faction'||state.gameMode==='4v4'){
          const mp=state.multiPlayers.find(p=>p.color===attacker.player);
          reviveCharId=mp?mp.char:state.character;
        } else if(state.gameMode==='pvp'||state.gameMode==='online'){
          reviveCharId=attacker.player===RED?state.pvpRedChar:state.pvpBlackChar;
        } else {
          reviveCharId=attacker.player===state.playerColor?state.character:'bking';
        }
        if(reviveCharId && typeof reviveLastPiece==='function'){
          const totalBefore=state.redCaptured.length+state.blackCaptured.length;
          reviveLastPiece(reviveCharId);
          const totalAfter=state.redCaptured.length+state.blackCaptured.length;
          if(totalAfter<totalBefore){
            speakTaunt('狂战之怒！兄弟归来！','self');
            addBattleLog('skill', '<b>狂战之怒</b> 复活1颗己方棋子');
            updateCapturedDisplay();
          }
        }
        state.ironwallRevivePending=false; /* 一次性消耗 */
      }
    }else if(attacker.hp<=0){
      /* 攻击方阵亡：防守方留守原地，攻击方入阵亡名单 */
      histEntry.actualCaptured=attacker;
      state.board[to.r][to.c]=defender;
      pushCaptured(attacker);
      /* v22: 战报 — 攻击方反被杀 */
      addBattleLog('capture', `<b>${PIECE_CHAR[defender.player===RED?'red':'black'][defender.type]}</b>(${defender.hp}HP) 反杀 <b>${PIECE_CHAR[attacker.player===RED?'red':'black'][attacker.type]}</b>，造成 ${dmg.attackerDmg} 伤害`);
    }else{
      /* 双方存活：攻击方退回原位，双方带伤留在棋盘上 */
      histEntry.actualCaptured=null;
      state.board[from.r][from.c]=attacker;
      state.board[to.r][to.c]=defender;
      /* v22: 战报 — 攻防交锋 */
      addBattleLog('move', `<b>${PIECE_CHAR[attacker.player===RED?'red':'black'][attacker.type]}</b> 攻击 <b>${PIECE_CHAR[defender.player===RED?'red':'black'][defender.type]}</b>，双方互伤 (${attacker.hp}/${attacker.maxHp} vs ${defender.hp}/${defender.maxHp})`);
    }
  }else{
    histEntry.actualCaptured=null;
  }

  /* v16/v17: 三金·兄弟连斩（barrageActive）：吃子后获得额外回合
     v17 修复：PVP 下使用 skillOwner 判断（原 playerColor 仅 PVE 正确） */
  if(state.barrageActive && captured && state.currentPlayer===skillOwner){
    state.barrageActive=false; /* 一次性消耗 */
    state.extraMove=(state.extraMove||0)+1;
    speakTaunt('兄弟连斩！再走一步！','self');
  }
  /* v19: 罗伦杰·无尽连斩（stormActive）：吃子后获得额外回合（最多3步，原 state.stormActive 只写不读） */
  if(state.stormActive && state.stormActive>0 && captured && state.currentPlayer===skillOwner && histEntry.actualCaptured){
    state.stormActive--;
    state.extraMove=(state.extraMove||0)+1;
    speakTaunt('无尽连斩！再走一步！（剩余'+state.stormActive+'步）','self');
  }

  state.selected=null; state.validMoves=[];
  state.revealedMoves=null; state.suggestedMoves=null; state.threatMarks=null;
  state.lastMove={from:{...from},to:{...to}};
  state.moveCount++;
  addHistoryEntry(piece,from,to,captured);
  /* v22: 战报 — 普通走子（不吃子时记录，吃子已在上面记录） */
  if(!captured){
    const pChar = PIECE_CHAR[piece.player===RED?'red':'black'][piece.type];
    addBattleLog('move', `<b>${pChar}</b> 移动至 (${to.r},${to.c})`);
  }

  if(state.gameMode==='three'){
    // 三英战B王：玩家走时累加当前武将CD，B王走时累加B王技能CD
    if(state.currentPlayer===state.playerColor){
      const idx=state.threeHeroIndex;
      /* v19: 读取选中技能实际 CD 作为上限（不再硬编码 3） */
      const curSkill = getActiveSkillForCurrentPlayer();
      const baseCd = (curSkill && curSkill.cd) || 3;
      const threshold = Math.max(1, baseCd + (state.bkingCdIncrease||0) - (state.skillCdReduce||0));
      if(state.threeHeroCDs[idx]<threshold) state.threeHeroCDs[idx]++;
    } else {
      if(state.aiSkillLock) state.aiSkillLock=false;
      else state.roundsSinceAISkill++;
    }
  } else if(state.gameMode==='pvp'){
    if(state.currentPlayer===RED){
      if(state.playerSkillLock) state.playerSkillLock=false;
      else state.roundsSincePlayerSkill++;
    } else {
      if(state.p2SkillLock) state.p2SkillLock=false;
      else state.roundsSinceP2Skill++;
    }
  } else if(state.gameMode==='faction'||state.gameMode==='4v4'){
    /* v5.0 多阵营/4v4：技能已禁用，仅累加全局计数（用于被动周期触发） */
    if(state.currentPlayer===state.playerColor){
      if(!state.playerSkillLock) state.roundsSincePlayerSkill++;
    }
  } else {
    if(state.currentPlayer===state.playerColor){
      if(state.playerSkillLock) state.playerSkillLock=false;
      else state.roundsSincePlayerSkill++;
    } else {
      if(state.aiSkillLock) state.aiSkillLock=false;
      else state.roundsSinceAISkill++;
    }
  }
  if(state.weakenedAITurns>0&&state.currentPlayer===state.aiColor) state.weakenedAITurns--;
  updateSkillDisplay();

  animateMove(from,to,()=>{
    // 仙帝护盾在对方走完后解除（PVP/PVE通用）
    const so=state.skillOwnerColor||state.playerColor;

    // 异常捕获：对方走完后解除护盾，己方获得额外回合（连走两步）
    if(state.skillActive==='catch-shield'&&state.currentPlayer===(so===RED?BLACK:RED)){
      state.skillActive=null;
      state.catchActive=false;
      state.extraMove=1;
      speakTaunt('异常处理完毕！下回合连走两步！','self');
    }
    if(state.celestialShield&&state.currentPlayer===(so===RED?BLACK:RED)){
      state.celestialShield=false;
    }

    // 铜墙铁壁：回合数递减
    if(state.ironwallTurns>0&&state.currentPlayer===(so===RED?BLACK:RED)){
      state.ironwallTurns--;
      if(state.ironwallTurns<=0){
        state.skillActive=null;
        state.ironwallTarget=null;
        speakTaunt('铜墙铁壁消散...','self');
      }
    }
    // 因果律锁：回合数递减（对方走完时递减）
    if(state.lockTurns>0&&state.currentPlayer===(so===RED?BLACK:RED)){
      state.lockTurns--;
      if(state.lockTurns<=0){
        state.lockedPiece=null;
        speakTaunt('因果律锁解除...','self');
      }
    }
    // 破妄之眼沉默：回合数递减（B王走完时递减）
    /* v22 修复 Bug 7：PVP 下 oppSkillBlockedColor===currentPlayer 时
       下面 line 1513 会再次递减 silenceTurns，造成双重递减。
       此处仅 PVE/三英 模式递减（PVP 由统一分支处理）。 */
    if(state.silenceTurns>0 && state.currentPlayer===state.aiColor
       && state.gameMode!=='pvp' && state.gameMode!=='online'){
      state.silenceTurns--;
    }
    // B王洞察：玩家走完后解除禁制（只持续一回合）
    if(state.playerCannotCapture&&state.currentPlayer===state.playerColor){
      state.playerCannotCapture=false;
    }
    /* v17: 对方禁吃解除（被禁吃方走完后清除，只持续一回合）
       v22 修复 Bug 1（主动技能）：原条件 currentPlayer===so（技能释放方走完），
       导致禁吃在玩家走完的瞬间就被清除，对方根本没被禁吃到。
       应为被禁吃方（skillOpp）走完时清除。 */
    if(state.oppCannotCapture&&state.currentPlayer===skillOpp){
      state.oppCannotCapture=false;
    }
    /* v22 修复 Bug 2（主动技能）：skillActive='shield' 永不清除导致对方永久禁吃。
       rollcall/awe/exam/saint/leap 等技能设置的 shield 状态应在对方走完后清除。 */
    if(state.skillActive==='shield' && state.currentPlayer===skillOpp){
      state.skillActive=null;
    }
    /* v22 修复 Bug 3（主动技能）：skillActive='weaken' 永不清除导致 AI 永久降智。
       weakenedAITurns 归零时同步清除 skillActive。 */
    if(state.skillActive==='weaken' && state.weakenedAITurns<=0){
      state.skillActive=null;
    }
    /* v22 修复 Bug 7/9（主动技能）：barrageActive/stormActive 跨回合残留。
       技能释放方回合结束（无 extraMove）时清除一次性标记。 */
    if(state.currentPlayer===so && !state.extraMove){
      if(state.barrageActive) state.barrageActive=false;
      if(state.stormActive) state.stormActive=null;
      /* v22 修复 Bug 2（主动技能）：oppMissNext 移至对方回合结束清除（原在技能方
         回合末清除，对方根本没到回合就清了，oppMissNext 永远不生效）。 */
      /* v22 修复 Bug 11（主动技能）：disguise-confuse 对方未攻击时残留 */
      if(state.skillActive==='disguise-confuse') state.skillActive=null;
      /* v22 修复 Bug 8（被动技能）：p_flipgod 的 skillCdReduce 一次性消耗，
         玩家回合结束（无 extraMove）时清零，避免永久 -1 CD。 */
      if(state.skillCdReduce>0) state.skillCdReduce=0;
    }
    /* v22 修复 Bug 2（主动技能）：oppMissNext 改在对方（skillOpp）回合结束时清除。
       对方走完一回合（无论是否攻击打偏），oppMissNext 都应过期。
       若对方攻击触发打偏（line 1206），oppMissNext 已在那里被一次性消耗。 */
    if(state.oppMissNext && state.currentPlayer===skillOpp && !state.extraMove){
      state.oppMissNext=false;
    }
    /* v17: 三英模式自动轮换 — 玩家走完后自动切换到下一位武将
       不再需要手动点击切换按钮，武将buff随之切换 */
    if(state.gameMode==='three' && state.currentPlayer===state.playerColor && !state.extraMove){
      const nextIdx = (state.threeHeroIndex + 1) % state.threeHeroes.length;
      if(nextIdx !== state.threeHeroIndex){
        switchThreeHeroAuto(nextIdx);
      }
    }

    // 先手夺人技能：连续行动（技能激活方获得额外回合）
    /* v22 修复 Bug 14：原 extraMove 提前 return 跳过 tickBuffs，
       导致额外回合不递减 buff 持续时间，buff 多挂一回合。
       v22 修复 Bug 1（被动技能）：原 currentPlayer=so 在被动触发 extraMove 时
       会把回合交给 state.playerColor（RED），导致 PVP 黑方被动触发的额外回合给错人。
       现改为：有技能激活时给技能方，否则保持当前玩家（被动触发方）。 */
    if(state.extraMove>0){
      tickBuffs(state.currentPlayer);
      state.extraMove--;
      state.currentPlayer = state.skillOwnerColor || state.currentPlayer;
      updateTurnIndicator(); updateCapturedDisplay();
      if(state.extraMove>0) speakTaunt('什么？还能再走一步？');
      return;
    }

    // AI额外行动
    if(state.aiExtraMoves>0&&state.currentPlayer===state.aiColor){
      state.aiExtraMoves--;
      aiMove();
      return;
    }

    /* v5.0 多阵营模式：按 activePlayers 轮换并跳过已淘汰玩家；
       2 玩家模式自动回退到 RED<->BLACK 切换 */
    /* buff 系统：当前行动方回合结束，递减其棋子 buff duration（虚弱等） */
    tickBuffs(state.currentPlayer);
    /* v16: 递减一次性技能标记（之前只写不读，导致技能效果永久残留）
       v22 修复 PVP 恶性 bug：原每回合都递减，导致技能释放方走完自己回合时
       aoeLockdownTurns/oppSlowTurns/oppPassiveDisabled 就被消耗一层，
       实际效果只持续设计回合数的一半（甚至立即失效）。
       现仅在"对方走完"时递减（与设计意图"对方下回合受限"一致）。
       - aoeLockdownTurns：由 line 1624 在对方回合开始时跳过并递减（不在此处递减）
       - oppSlowTurns/oppPassiveDisabled：仅对方走完时递减 */
    const _so2 = state.skillOwnerColor || state.playerColor;
    const _sopp2 = _so2===RED?BLACK:RED;
    if(state.currentPlayer===_sopp2){
      if(state.oppSlowTurns>0) state.oppSlowTurns--;
      if(state.oppPassiveDisabled>0) state.oppPassiveDisabled--;
    }
    /* v19: 袁清山·潜龙勿用 — 递减隐藏回合数 */
    if(state.hiddenPiece && state.hiddenPiece.turns>0){
      state.hiddenPiece.turns--;
      if(state.hiddenPiece.turns<=0) state.hiddenPiece=null;
    }
    /* v19: 罗伦杰·无尽连斩 — 回合结束时清零（防止跨回合残留） */
    if(state.stormActive && state.stormActive<=0) state.stormActive=null;
    /* v17: 递减 silenceTurns 并在耗尽时解除技能封锁
       - PVE: 原 logic 在 line 1269 仅当 currentPlayer===aiColor 递减（B王走完递减）
       - PVP: 被封锁方走完时递减，归零时清除 oppSkillBlockedColor
       这样 silence 持续 N 回合（与技能设定的 silenceTurns 一致） */
    if(state.oppSkillBlockedColor===state.currentPlayer){
      if(state.silenceTurns>0){
        state.silenceTurns--;
      }
      if(state.silenceTurns<=0){
        state.oppSkillBlockedColor=null;
      }
    }
    advanceToNextPlayer();
    updateTurnIndicator(); updateCapturedDisplay();
    checkGameEnd();
    /* v30: 回合开始 — B王形态切换 + 色欲控制恢复 */
    if(!state.gameOver){
      checkBkingFormSwitch();
      processLustControlRecovery();
    }
    /* v31: 天气系统 — 每回合切换前推进 1 回合 */
    if(!state.gameOver && typeof tickWeather==='function'){
      tickWeather();
    }
    /* v4.0 被动技能：回合开始触发 */
    if(!state.gameOver&&typeof passivesOnTurnStart==='function'){
      passivesOnTurnStart();
    }
    /* v16: 被动触发后刷新 HUD（aura 可能添加 buff，周期性被动可能修改状态） */
    renderHUD();
    updateSkillDisplay();
    // 唐昊博涵·标准答案：PVP模式下对方回合开始时自动执行被操控的走法
    if(!state.gameOver&&state.controlActive&&state.controlledMove&&(state.gameMode==='pvp'||state.gameMode==='online')&&state.currentPlayer===(so===RED?BLACK:RED)){
      const cm=state.controlledMove;
      state.controlActive=false; state.controlledMove=null;
      /* v22: controlActive 抢先执行时，一并清理 predForcedMoves[当前方]
         避免陈旧的预测走法在下一回合被错误消费 */
      if(state.predForcedMoves && state.predForcedMoves[state.currentPlayer]){
        delete state.predForcedMoves[state.currentPlayer];
      }
      /* v22 修复 Bug 7：PVP 下 controlledMove.from 处的棋子可能已被吃/移动，
         执行前校验棋子仍存在且属于当前方，否则放弃操控（走法失效）。 */
      if(cm && cm.from && state.board[cm.from.r] && state.board[cm.from.r][cm.from.c]){
        const piece = state.board[cm.from.r][cm.from.c];
        if(piece && piece.player === state.currentPlayer){
          speakTaunt('标准答案！对方被迫按你的答案行棋！','opp');
          setTimeout(()=>{ doMove(cm.from,cm.to); },800);
        } else {
          /* 走法失效：原棋子已不在或易主，放弃操控 */
          speakTaunt('标准答案失效...棋子已不在原地。','self');
        }
      } else {
        /* 走法失效：坐标越界或无棋子 */
        state.controlledMove = null;
      }
      return;
    }
    // B王·指鹿为马：玩家回合开始时强制走指定的一步
    if(!state.gameOver&&state.playerConfusedMove&&state.currentPlayer===state.playerColor){
      const cm=state.playerConfusedMove;
      state.playerConfusedMove=null;
      /* v22: 同步清理 predForcedMoves[当前方]，避免冲突 */
      if(state.predForcedMoves && state.predForcedMoves[state.currentPlayer]){
        delete state.predForcedMoves[state.currentPlayer];
      }
      speakTaunt('被指鹿为马了！只能按本王的意思走...');
      setTimeout(()=>{ doMove(cm.from,cm.to); },800);
      return;
    }
    // 指鹿为马强制走法（通用版）：回合开始时检查 confuseForcedMove
    if(state.confuseForcedMove && state.confuseForcedMove.color === state.currentPlayer){
      const fm = state.confuseForcedMove;
      state.confuseForcedMove = null;
      setTimeout(() => {
        // 执行强制走法
        doMove(fm.from, fm.to);
      }, 800);
      return;
    }
    // v22: PVP 预测类被动强制走法 — 统一委托给 tryConsumeForcedMove
    if(tryConsumeForcedMove()){
      return;
    }
    // v16/v17: 全场禁锢（aoeLockdownTurns）：对方回合开始时跳过（无法移动）
    /* v17 修复：PVP 下使用 skillOpp 判断（原 state.playerColor 仅 PVE 正确） */
    const _skillOwner = state.skillOwnerColor || state.playerColor;
    const _skillOpp = _skillOwner===RED?BLACK:RED;
    if(!state.gameOver&&state.aoeLockdownTurns>0&&state.currentPlayer===_skillOpp){
      speakTaunt('对方被禁锢！无法移动，跳过回合！','self');
      state.aoeLockdownTurns--; /* 消耗一回合 */
      tickBuffs(state.currentPlayer);
      advanceToNextPlayer();
      updateTurnIndicator(); updateCapturedDisplay();
      checkGameEnd();
      if(!state.gameOver&&typeof passivesOnTurnStart==='function') passivesOnTurnStart();
      if(!state.gameOver&&typeof tickWeather==='function') tickWeather();
      if(!state.gameOver&&state.currentPlayer===state.aiColor) aiMove();
      return;
    }
    // 玩家受技能限制无法走棋时，AI自动多走
    if(!state.gameOver&&checkPlayerRestrictedAndSkip()) return;
    if(!state.gameOver&&(state.gameMode==='pve'||state.gameMode==='three')&&state.currentPlayer===state.aiColor) aiMove();
  });
}
function aiMove(){
  state.aiThinking=true; showThinking(true); updateTurnIndicator();
  let diff=DIFFICULTIES[state.difficulty];
  // v28: 故事模式 — 从 BKING_LAYERS 读取 depth/skillChance 覆盖 DIFFICULTIES 默认值
  if(state.storyChapterId && state.bkingLayer && typeof BKING_LAYERS!=='undefined'){
    const layer=BKING_LAYERS[state.bkingLayer];
    if(layer) diff={ ...diff, depth:layer.depth, skillChance:layer.skillChance };
  }
  // 三英战B王：B王超模——思考深度+1，且每4回合触发连环双杀
  if(state.gameMode==='three'){
    diff={ ...diff, depth:diff.depth+1 };
    state.threeBKingTurns++;
    if(state.threeBKingTurns%4===0){
      state.threeBKingDoubleNext=true;
      speakTaunt('狂妄·三连击！本王今日要连下两城！','opp');
    }
  }
  setTimeout(()=>{
    // 仙帝威压：B王必须弃子（优先弃掉强大的棋子）
    if(state.aweActive){
      if(state.awePieces.length>0){
        // 选择价值最大的棋子弃掉（仙帝威压下被迫献出强子）
        let maxVal=-1, maxPiece=null;
        for(const {r,c} of state.awePieces){
          const p=state.board[r][c];
          if(p&&PIECE_VALUE[p.type]>maxVal && p.type!==T.KING){
            maxVal=PIECE_VALUE[p.type];
            maxPiece={r,c};
          }
        }
        // 若没有可弃的非将棋子，则弃任意一枚
        if(!maxPiece){
          for(const {r,c} of state.awePieces){
            const p=state.board[r][c];
            if(p&&p.type!==T.KING){ maxPiece={r,c}; break; }
          }
        }
        if(maxPiece){
          const piece=state.board[maxPiece.r][maxPiece.c];
          /* v39 修复 P1 bug: 原硬编码 blackCaptured，PVP 黑方释放时颜色错误 */
          const capList = piece.player===RED ? state.redCaptured : state.blackCaptured;
          if(capList) capList.push(piece);
          state.board[maxPiece.r][maxPiece.c]=null;
          speakTaunt(`可恶！仙帝威压！本王被迫献出${PIECE_CHAR.black[piece.type]}！`);
        }
      }
      state.aweActive=false;
      state.awePieces=[];
    }

    // B王技能（被破妄之眼沉默/禁用时跳过）
    let aiSkip=false;
    if(state.aiSkillBlocked||state.silenceTurns>0){
      if(state.aiSkillBlocked){ state.aiSkillBlocked=false; }
      speakTaunt('可恶！破妄之眼！本王的奇术被封锁了！');
    } else {
      /* v31-fix P1: 形态切换 cdReduce — 进攻/狡诈形态声称"技能CD-1"实际无效。
         现读取 state.bkingFormMods.cdReduce 降低 CD 阈值。 */
      const formCdReduce = (state.bkingFormMods && state.bkingFormMods.cdReduce) || 0;
      const skillThreshold = Math.max(1, 3 - formCdReduce);
      if(state.roundsSinceAISkill >= skillThreshold) aiSkip = maybeAISkill();
    }
    if(aiSkip){
      state.aiThinking=false; showThinking(false);
      updateTurnIndicator();
      return;
    }
    /* v31-fix P1: 疯狂形态 selfAttackChance — "每回合可能攻击己方"原为死代码。
       现在掷骰：若触发，让 AI 选最强己方棋子直接攻击 B王方最弱的棋子（自残）。
       仅在真实战斗中触发，AI 模拟不影响。 */
    const selfAtkChance = (state.bkingFormMods && state.bkingFormMods.selfAttackChance) || 0;
    if(selfAtkChance > 0 && Math.random() < selfAtkChance && state.gameMode!=='pvp' && state.gameMode!=='online'){
      const aiColor = state.aiColor || BLACK;
      let strongestOwn = null, weakestOwn = null, sPos=null, wPos=null;
      let bestAtk = -1, weakestHp = Infinity;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const p = state.board[r][c];
        if(!p || p.player!==aiColor) continue;
        const atk = (p.atk||0) + Math.floor((p.charAtk||0)/10);
        if(atk > bestAtk){ bestAtk = atk; strongestOwn = p; sPos = {r,c}; }
        if(p.type !== T.KING && (p.hp||0) < weakestHp){
          weakestHp = p.hp; weakestOwn = p; wPos = {r,c};
        }
      }
      if(strongestOwn && weakestOwn && sPos && wPos && (sPos.r!==wPos.r || sPos.c!==wPos.c)){
        if(typeof addBattleLog==='function'){
          addBattleLog('state', `<b>疯狂形态</b> 触发！B王 <b>${PIECE_CHAR[aiColor] ? PIECE_CHAR[aiColor][strongestOwn.type] : '?'}</b> 失控攻击己方 <b>${PIECE_CHAR[aiColor] ? PIECE_CHAR[aiColor][weakestOwn.type] : '?'}</b>`);
        }
        /* 直接结算：强子攻击弱子 */
        const dmg = calcDamage(strongestOwn, weakestOwn);
        weakestOwn.hp = Math.max(0, (weakestOwn.hp||0) - dmg.defenderDmg);
        if(weakestOwn.hp <= 0){
          state.board[wPos.r][wPos.c] = null;
          if(typeof addBattleLog==='function') addBattleLog('state', `己方 <b>${PIECE_CHAR[aiColor] ? PIECE_CHAR[aiColor][weakestOwn.type] : '?'}</b> 被击杀`);
        }
        /* 触发反伤等被动 */
        if(dmg.attackerDmg > 0){
          strongestOwn.hp = Math.max(0, (strongestOwn.hp||0) - dmg.attackerDmg);
          if(strongestOwn.hp <= 0){
            state.board[sPos.r][sPos.c] = null;
            if(typeof addBattleLog==='function') addBattleLog('state', `攻击方 <b>${PIECE_CHAR[aiColor] ? PIECE_CHAR[aiColor][strongestOwn.type] : '?'}</b> 反伤致死`);
          }
        }
        renderAll();
        state.aiThinking = false; showThinking(false);
        /* 自残后跳过本回合正常走子 */
        if(state.gameMode!=='pvp' && state.gameMode!=='online' && state.currentPlayer===state.aiColor){
          setTimeout(()=>{
            tickBuffs(state.aiColor);
            advanceToNextPlayer();
            updateTurnIndicator(); updateCapturedDisplay();
            checkGameEnd();
            if(!state.gameOver && typeof tickWeather==='function') tickWeather();
            if(!state.gameOver && typeof passivesOnTurnStart==='function') passivesOnTurnStart();
            renderHUD(); updateSkillDisplay();
            if(!state.gameOver && state.currentPlayer===state.aiColor) aiMove();
          }, 600);
        }
        return;
      }
    }
    let depth=diff.depth;
    if(state.skillActive==='weaken'||state.weakenedAITurns>0) depth=Math.max(1,depth-2);
    /* AI 超时保护：限制最大搜索深度（engine.js AI_MAX_DEPTH）
       hard 原始 depth=6，三英模式 +1=7，会导致 minimax 主线程长时间阻塞。
       在 game.js 入口处先行 cap，避免向 getBestMove 传入过大 depth。 */
    if(typeof AI_MAX_DEPTH!=='undefined') depth=Math.min(depth,AI_MAX_DEPTH.hard);
    let move;
    // 唐昊博涵·标准答案：操控B王走指定的步
    if(state.controlActive&&state.controlledMove){
      move=state.controlledMove;
      state.controlActive=false;
      state.controlledMove=null;
      speakTaunt('标准答案！B王被迫按标准答案行棋！','opp');
      // 确保目标位置仍可达（若被占则走旁边）
      const tgt=state.board[move.to.r][move.to.c];
      if(tgt&&tgt.player!==state.aiColor){
        const adj=getAdjacentMoves(move.to.r,move.to.c);
        if(adj.length>0) move.to=adj[0];
      }
    } else if(state.skillActive==='confuse'){
      move=getRandomMove(state.board,state.aiColor);
      state.skillActive=null;
    } else if(state.aiRoutePlan.length>0){
      // 路线锁定：AI 必须按显示的路线走
      move=state.aiRoutePlan.shift();
      state.aiRouteTurns--;
      // 若目标位置被玩家占据（非空且非己方），则改走旁边
      const target=state.board[move.to.r][move.to.c];
      if(target&&target.player!==state.aiColor){
        const adj=getAdjacentMoves(move.to.r,move.to.c);
        if(adj.length>0){
          speakTaunt('占了本王的路？那就走旁边！','opp');
          move.to=adj[0];
        } else {
          // 无旁路可走，重新计算
          move=getBestMove(state.board,state.aiColor,depth,0);
        }
      }
    } else {
      // 因果律锁：过滤掉被锁定棋子的走法
      let legalMoves=getLegalAIMoves(state.board,state.aiColor);
      if(state.lockedPiece){
        legalMoves=legalMoves.filter(m=>!(m.fr===state.lockedPiece.r&&m.fc===state.lockedPiece.c));
        if(legalMoves.length===0){
          // 被锁棋子是唯一可走的，则解锁
          state.lockedPiece=null; state.lockTurns=0;
          legalMoves=getLegalAIMoves(state.board,state.aiColor);
        }
      }
      /* v16: oppSlowTurns 减速 — 限制车炮直线移动距离<=1（之前只递减未限制） */
      if(state.oppSlowTurns>0 && legalMoves.length>0){
        const filtered = legalMoves.filter(m=>{
          const piece = state.board[m.fr][m.fc];
          const dist = Math.abs(m.tr-m.fr) + Math.abs(m.tc-m.fc);
          if((piece.type===T.ROOK || piece.type===T.CANNON) && dist>1) return false;
          return true;
        });
        if(filtered.length>0){
          legalMoves = filtered;
          speakTaunt('减速！长距离移动受限！','opp');
        }
      }
      // 破妄之眼沉默 / ikun唱跳篮球：30%概率走"艺术走法"（随机走）
      /* v22 修复 Bug 5（主动技能）：原仅检查 silenceTurns，weaken（weakenedAITurns）
         的"30%艺术走法"完全不生效。现统一检查两个降智状态。 */
      if((state.silenceTurns>0||state.weakenedAITurns>0)&&Math.random()<0.3&&legalMoves.length>0){
        const m=legalMoves[Math.floor(Math.random()*legalMoves.length)];
        move={from:{r:m.fr,c:m.fc},to:{r:m.tr,c:m.tc}};
        speakTaunt('干扰！本王走错了...','opp');
      } else if(legalMoves.length===0){
        move=null;
      } else {
        move=getBestMoveFromMoves(state.board,state.aiColor,legalMoves,depth,diff.randomChance);
      }
    }
    state.aiThinking=false;
    if(state.skillActive==='confuse') state.skillActive=null;
    showThinking(false);
    if(!move){
      state.gameOver=true;
      showResult(true,'B王已无路可走');
      return;
    }
    doMove(move.from,move.to);
    // 三英战B王：连环双杀——第一走后追加一走
    if(state.gameMode==='three'&&state.threeBKingDoubleNext&&!state.gameOver){
      state.threeBKingDoubleNext=false;
      state.aiExtraMoves=1;
    }
    // 路线锁定：AI走完后刷新剩余路线显示
    if(state.routeDisplay){
      if(state.aiRoutePlan.length>0){
        state.routeDisplay.plan=state.aiRoutePlan.slice();
        setTimeout(()=>renderAll(),300);
      } else {
        state.routeDisplay=null;
      }
    }
  },600+Math.random()*400);
}
function getRandomMove(b,p){
  const moves=getLegalAIMoves(b,p);
  if(moves.length===0) return null;
  const m=moves[Math.floor(Math.random()*moves.length)];
  return {from:{r:m.fr,c:m.fc},to:{r:m.tr,c:m.tc}};
}
function undoLastMove(){
  if(state.history.length===0||state.animating||state.aiThinking) return;
  /* v22: 强制走法执行期间禁止悔棋，避免坐标失效崩盘 */
  if(state.forcedMovePending) return;
  /* PVE悔棋2步（玩家+AI），PVP悔棋1步 */
  let steps=(state.gameMode==='pvp'||state.gameMode==='online')?1:(state.currentPlayer===state.playerColor?2:1);
  /* v5.0 多阵营/4v4：悔棋 1 步（避免跨玩家回退引发混乱） */
  if(state.gameMode==='faction'||state.gameMode==='4v4') steps=1;
  steps=Math.min(steps,state.history.length);
  let lastSnap=null;
  for(let i=0;i<steps;i++){
    const last=state.history.pop();
    state.board[last.from.r][last.from.c]=last.piece;
    state.board[last.to.r][last.to.c]=last.captured;
    state.currentPlayer=last.player;
    /* v5.0 多阵营：同步 playerIndex 到当前玩家 */
    if(state.activePlayers&&state.activePlayers.length>2){
      const idx=state.activePlayers.indexOf(last.player);
      if(idx>=0) state.playerIndex=idx;
    }
    /* v5.0 战斗系统：按实际被消灭的棋子回退阵亡名单（兼容旧记录） */
    const actualCap=(last.actualCaptured!==undefined)?last.actualCaptured:last.captured;
    if(actualCap){
      if(isBottomSide(actualCap.player)) state.redCaptured.pop();
      else state.blackCaptured.pop();
    }
    /* v16: 同归于尽时回退攻击方阵亡记录 */
    if(last.actualAttackerCaptured){
      if(isBottomSide(last.actualAttackerCaptured.player)) state.redCaptured.pop();
      else state.blackCaptured.pop();
    }
    state.moveCount--;
    removeLastHistoryEntry();
    lastSnap=last.skillSnap;
  }
  /* 恢复技能状态（同步CD，修复悔棋后CD不同步问题） */
  if(lastSnap){
    state.roundsSincePlayerSkill=lastSnap.rsps;
    state.roundsSinceAISkill=lastSnap.rsas;
    state.roundsSinceP2Skill=lastSnap.rp2s;
    state.playerSkillLock=lastSnap.psl;
    state.p2SkillLock=lastSnap.p2sl;
    state.aiSkillLock=lastSnap.asl;
    state.weakenedAITurns=lastSnap.wat;
    state.ironwallTurns=lastSnap.iwt;
    state.lockTurns=lastSnap.lt;
    state.silenceTurns=lastSnap.st;
    state.skillActive=lastSnap.sa;
    /* v17: 恢复技能封锁状态（PVE: aiSkillBlocked, PVP: oppSkillBlockedColor） */
    state.aiSkillBlocked=lastSnap.asb||false;
    state.oppSkillBlockedColor=lastSnap.osbc||null;
    /* 同步铁壁和锁定目标 */
    if(state.ironwallTurns<=0) state.ironwallTarget=null;
    if(state.lockTurns<=0) state.lockedPiece=null;
  }
  state.selected=null; state.validMoves=[];
  state.revealedMoves=null; state.suggestedMoves=null; state.aiPredictedMove=null; state.threatMarks=null;
  state.extraMove=0; state.aiExtraMoves=0;
  state.teleportMode=false; state.disguiseMode=false; state.swapMode=false; state.swapPhase=null; state.swapTargetA=null;
  state.controlActive=false; state.controlledMove=null;
  state.catchActive=false;
  /* v16: 悔棋时清理一次性技能标记（避免残留） */
  state.oppMissNext=false;
  state.barrageActive=false;
  state.lastMove=state.history.length>0?{from:state.history[state.history.length-1].from,to:state.history[state.history.length-1].to}:null;
  state.gameOver=false;
  renderAll(); updateTurnIndicator(); updateCapturedDisplay(); hideCheckWarning(); updateSkillDisplay();
}
function checkGameEnd(){
  /* v5.0 多阵营模式：王被吃=该阵营淘汰，游戏直到只剩 1 阵营 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    checkMultiFactionEnd();
    return;
  }
  /* v5.0 战斗系统：将/帅 HP 归零被移出棋盘即败 */
  const rk=findKing(state.board,RED), bk=findKing(state.board,BLACK);
  if(!rk||!bk){
    state.gameOver=true;
    const w=!rk?BLACK:RED;
    let title, sub='主帅阵亡！';
    if(state.gameMode==='pvp'||state.gameMode==='online'){
      const winChar=w===RED?CHARACTERS[state.pvpRedChar]:CHARACTERS[state.pvpBlackChar];
      title=`${winChar.name}·击杀主帅`;
    }else{
      title=w===state.playerColor?'击杀对手主帅':'主帅阵亡';
    }
    showMateOverlay(w===state.playerColor,title,sub);
    return;
  }
  const inChk=isInCheck(state.board,state.currentPlayer);
  const hasMv=hasLegalMoves(state.board,state.currentPlayer);
  const curChar=getCurrentChar();
  if(inChk&&!hasMv){
    // 绝杀：先显示绝杀遮罩，确认后再进入结局
    state.gameOver=true;
    const w=state.currentPlayer===RED?BLACK:RED;
    let title, sub;
    if(state.gameMode==='pvp'||state.gameMode==='online'){
      const winChar = w===RED ? CHARACTERS[state.pvpRedChar] : CHARACTERS[state.pvpBlackChar];
      title = `${winChar.name}·将死`;
      sub = '绝杀！无解可破';
    } else {
      title = w===state.playerColor ? '将死对手' : '被B王将死';
      sub = '绝杀！无解可破';
    }
    showMateOverlay(w===state.playerColor, title, sub);
  } else if(!hasMv){
    state.gameOver=true;
    const w=state.currentPlayer===RED?BLACK:RED;
    let title, sub;
    if(state.gameMode==='pvp'||state.gameMode==='online'){
      const winChar = w===RED ? CHARACTERS[state.pvpRedChar] : CHARACTERS[state.pvpBlackChar];
      title = `${winChar.name}·困毙`;
      sub = '困毙！无路可走';
    } else {
      title = w===state.playerColor ? '困毙对手' : '被B王困毙';
      sub = '困毙！无路可走';
    }
    showMateOverlay(w===state.playerColor, title, sub);
  } else if(inChk){
    showCheckWarning();
    if(state.gameMode==='pve'&&state.currentPlayer===state.playerColor) speakTaunt(pick(B_TAUNTS.check));
  } else hideCheckWarning();
}

/* v5.0 多阵营/4v4 胜负判定：王被吃即淘汰，仅剩 1 阵营时结束 */
function checkMultiFactionEnd(){
  const ap=state.activePlayers;
  if(!ap||ap.length===0) return;
  /* 检查哪些阵营的王还在棋盘上 */
  const alive=[];
  for(const c of ap){
    if(state.eliminatedPlayers.indexOf(c)>=0) continue;
    if(findKing(state.board,c)) alive.push(c);
    else state.eliminatedPlayers.push(c);
  }
  /* 仅剩 1 阵营 → 游戏结束 */
  const survivors=ap.filter(c=>state.eliminatedPlayers.indexOf(c)<0);
  if(survivors.length<=1){
    state.gameOver=true;
    const winner=survivors[0]||null;
    const winChar=winner?getCurrentChar():null;
    const winnerName=winChar?winChar.name:(winner?colorDisplayName(winner):'无人');
    const title=winner?`${winnerName}·一统棋盘`:'同归于尽';
    const sub=winner?`淘汰其余 ${ap.length-1} 阵营，独占鳌头`:'全员阵亡';
    /* 玩家胜利条件：玩家所在阵营存活（玩家颜色 = multiPlayers[0].color） */
    const playerWins=winner&&winner===state.playerColor;
    showMateOverlay(playerWins, title, sub);
    return;
  }
  /* 当前玩家是否被将死/困毙 → 淘汰 */
  const inChk=isInCheck(state.board,state.currentPlayer);
  const hasMv=hasLegalMoves(state.board,state.currentPlayer);
  if(!hasMv){
    /* 当前阵营被将死或困毙，淘汰之 */
    state.eliminatedPlayers.push(state.currentPlayer);
    const elimChar=getCurrentChar();
    const elimName=elimChar?elimChar.name:colorDisplayName(state.currentPlayer);
    speakTaunt(`${colorDisplayName(state.currentPlayer)}·${elimName} 主帅阵亡，出局！`);
    /* 跳过被淘汰玩家，轮到下一个未淘汰者 */
    advanceToNextPlayer();
    updateTurnIndicator(); updateCapturedDisplay();
    /* 递归检查是否只剩 1 阵营 */
    checkMultiFactionEnd();
    return;
  }
  if(inChk){
    showCheckWarning();
  } else {
    hideCheckWarning();
  }
}

/* 检查玩家在技能限制下是否有合法走法 */
function hasPlayerLegalMovesWithRestrictions(){
  const p=state.playerColor;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const piece=state.board[r][c];
    if(piece&&piece.player===p){
      const moves=getLegalAIMoves(state.board,p).filter(m=>m.fr===r&&m.fc===c);
      for(const m of moves){
        // 如果玩家不能吃子，跳过吃子走法
        if(state.playerCannotCapture&&state.board[m.tr][m.tc]) continue;
        return true;
      }
    }
  }
  return false;
}

/* 玩家受技能限制无法走棋时，AI自动多走 */
function checkPlayerRestrictedAndSkip(){
  if(state.gameMode!=='pve') return false;
  if(state.currentPlayer!==state.playerColor) return false;
  if(!state.playerCannotCapture) return false;
  if(hasPlayerLegalMovesWithRestrictions()) return false;
  // 玩家受限制无法走棋，自动让AI多走
  speakTaunt('哼！本王禁制了你！你无路可走，本王再走一步！');
  state.playerCannotCapture=false; // 解除限制（已消耗）
  state.currentPlayer=state.aiColor;
  updateTurnIndicator();
  setTimeout(()=>aiMove(),800);
  return true;
}

/* 检测强制绝杀（mate in 2）：当前方无论怎么走，对方都能在2步内将死 */
function isForcedMate(board, attacker, depth){
  const defender=attacker===RED?BLACK:RED;
  const defMoves=getLegalAIMoves(board,defender);
  if(defMoves.length===0) return false; // 已是终局
  // 检查防守方每种走法后，进攻方是否都能将死
  for(const dm of defMoves){
    const cap=board[dm.tr][dm.tc];
    makeMv(board,dm);
    const canMate=attackerCanMate(board,attacker,depth-1);
    undoMv(board,dm,cap);
    if(!canMate) return false;
  }
  return true;
}
/* 进攻方是否能在 depth 步内将死防守方 */
function attackerCanMate(board, attacker, depth){
  if(depth<=0) return false;
  const defender=attacker===RED?BLACK:RED;
  const atkMoves=getLegalAIMoves(board,attacker);
  for(const am of atkMoves){
    const cap=board[am.tr][am.tc];
    makeMv(board,am);
    const defHasMv=hasLegalMoves(board,defender);
    const defInChk=isInCheck(board,defender);
    let mates=false;
    if(!defHasMv&&defInChk) mates=true; // 直接将死
    else if(defHasMv&&depth>1) mates=isForcedMate(board,attacker,depth-1);
    undoMv(board,am,cap);
    if(mates) return true;
  }
  return false;
}

/* 绝杀遮罩 */
function showMateOverlay(playerWins, reason, subtitle){
  const overlay=document.getElementById('mate-overlay');
  const seal=document.getElementById('mate-seal');
  const title=document.getElementById('mate-title');
  const desc=document.getElementById('mate-desc');
  seal.textContent=playerWins?'胜':'负';
  seal.classList.toggle('lose',!playerWins);
  title.textContent=subtitle.split('！')[0]||'绝 杀';
  desc.textContent=subtitle;
  overlay.classList.add('show');
  // 存储结果信息供确认后使用
  overlay.dataset.reason=reason;
  overlay.dataset.playerWins=playerWins;
}
function hideMateOverlay(){
  document.getElementById('mate-overlay').classList.remove('show');
}

/* ===== 技能系统 ===== */
/* 获取当前行棋方与对手方颜色（PVP/PVE通用） */
function myColor(){ return state.currentPlayer; }
function oppColor(){ return state.currentPlayer===RED?BLACK:RED; }
/* v5.0 多阵营 / 4v4：将当前回合切换到下一个未淘汰的玩家。
   - 2 玩家模式（PVE/PVP）：保持原 currentPlayer===RED?BLACK:RED 行为
   - 3-4 玩家模式：按 activePlayers 顺序循环，跳过已淘汰颜色 */
function advanceToNextPlayer(){
  /* v34: 通天教主机制 — 在回合切换前处理诛仙斩杀检查 */
  if(state.zhuxianExecuteCheck && typeof tickZhuxianMark==='function') tickZhuxianMark();
  /* v35: 诛仙剑阵·阵法闭合检查 — 持续伤害+禁锢+3回合后引爆 */
  if(state.zhuxianFormationActive && typeof tickZhuxianFormation==='function') tickZhuxianFormation();
  const ap=state.activePlayers;
  if(!ap||ap.length<=2){
    state.currentPlayer=state.currentPlayer===RED?BLACK:RED;
    return;
  }
  let next=(state.playerIndex+1)%ap.length;
  let guard=0;
  while(state.eliminatedPlayers.indexOf(ap[next])>=0 && guard<ap.length){
    next=(next+1)%ap.length;
    guard++;
  }
  state.playerIndex=next;
  state.currentPlayer=ap[next];
}
/* 获取当前方的被吃棋子列表 */
function myCaptured(){ return state.currentPlayer===RED?state.redCaptured:state.blackCaptured; }
/* 获取对方历史最近一步 */
function lastOppMove(){
  const oc=oppColor();
  for(let i=state.history.length-1;i>=0;i--){ if(state.history[i].player===oc) return state.history[i]; }
  return null;
}

function canUseSkill(){
  if(state.aiThinking||state.animating||state.swapMode||state.disguiseMode||state.teleportMode) return false;
  /* v22: 强制走法执行期间禁止释放技能，避免连环斩等技能与强制走法冲突崩盘 */
  if(state.forcedMovePending) return false;
  if(state.skillActive==='ironwall') return false;
  /* v5.0 多阵营/4v4：技能系统暂未适配多玩家，禁用主动技能以保持稳定 */
  if(state.gameMode==='faction'||state.gameMode==='4v4') return false;
  if(state.gameMode==='three'){
    if(state.currentPlayer!==state.playerColor) return false;
    /* v19: 读取选中技能实际 CD，不再硬编码 3 */
    const skill=getActiveSkillForCurrentPlayer();
    const baseCd=(skill&&skill.cd)||3;
    /* v10: 谋属性 CD 减少 */
    const intCdReduce=getIntCdReduction(getCurrentCharId());
    /* v10-skill-redesign: heroType（智力系 -1）CD 减少，与谋属性叠加 */
    const heroCdReduce=(getCharBonus(getCurrentCharId()).cdReduce)||0;
    const threshold=Math.max(1, baseCd + (state.bkingCdIncrease||0) - (state.skillCdReduce||0) - intCdReduce - heroCdReduce);
    const cd=state.threeHeroCDs[state.threeHeroIndex]||0;
    return cd>=threshold;
  }
  /* v16: 根据选中技能实际 cd 判断就绪，不再硬编码 3 */
  const skill=getActiveSkillForCurrentPlayer();
  const baseCd=(skill&&skill.cd)||3;
  /* 仙帝威压 +1 CD；掀桌之神/天道因果 -1（最低 1）
     v22 修复：PVP/online 模式下无 B王，bkingCdIncrease 不应影响双方 CD，
     否则仙帝 Alice 的 p_pressure 被动会让双方都 CD+1（包括自己）。
     PVP 下 threshold 只受 skillCdReduce 影响。 */
  const bkingAdj = (state.gameMode==='pvp'||state.gameMode==='online') ? 0 : (state.bkingCdIncrease||0);
  /* v10: 谋属性 CD 减少 */
  const intCdReduce=getIntCdReduction(getCurrentCharId());
  /* v10-skill-redesign: heroType（智力系 -1）CD 减少，与谋属性叠加 */
  const heroCdReduce=(getCharBonus(getCurrentCharId()).cdReduce)||0;
  const threshold=Math.max(1, baseCd + bkingAdj - (state.skillCdReduce||0) - intCdReduce - heroCdReduce);
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    if(state.gameMode==='online'&&state.currentPlayer!==netMyColor) return false;
    /* v17: PVP 技能封锁检查 — 对方释放 silence 后，被封锁方不能用技能
       oppSkillBlockedColor 在 silenceTurns 耗尽前持续封锁（与 PVE 一致）
       v35-fix P1-Bug3: 金仙之体（goldenImmortal）免疫沉默 */
    if(state.oppSkillBlockedColor===state.currentPlayer&&state.silenceTurns>0){
      if(!hasGoldenImmunityForCurrentPlayer()) return false;
    }
    const cd=state.currentPlayer===RED?state.roundsSincePlayerSkill:state.roundsSinceP2Skill;
    return cd>=threshold;
  }
  /* PVE */
  /* v31-fix P2: PVE 玩家沉默阻断检查 — 当前虽无 B王技能沉默玩家，但补上以防未来扩展
     v35-fix P1-Bug3: 金仙之体免疫沉默 */
  if(state.oppSkillBlockedColor===state.playerColor && state.silenceTurns>0){
    if(!hasGoldenImmunityForCurrentPlayer()) return false;
  }
  return state.roundsSincePlayerSkill>=threshold&&state.currentPlayer===state.playerColor;
}

function getCurrentChar(){
  if(state.gameMode==='three'){
    const id=state.threeHeroes[state.threeHeroIndex];
    return CHARACTERS[id]||CHARACTERS[state.character];
  }
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    return state.currentPlayer===RED?CHARACTERS[state.pvpRedChar]:CHARACTERS[state.pvpBlackChar];
  }
  /* v5.0 多阵营 / 4v4：按当前玩家颜色取对应角色 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.color===state.currentPlayer);
    if(mp) return CHARACTERS[mp.char]||CHARACTERS[state.character];
  }
  return CHARACTERS[state.character];
}

/* v10: 获取当前玩家的角色 ID（用于 getIntCdReduction / applyIntToSkillDamage 等谋属性计算）
   与 getCurrentChar 对应，返回角色 ID 而非角色对象 */
function getCurrentCharId(){
  if(state.gameMode==='three'){
    return state.threeHeroes[state.threeHeroIndex] || state.character;
  }
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    return state.currentPlayer===RED ? state.pvpRedChar : state.pvpBlackChar;
  }
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    const mp=state.multiPlayers.find(p=>p.color===state.currentPlayer);
    if(mp) return mp.char;
  }
  return state.character;
}

/* v35-fix P1-Bug3: 检查当前玩家是否有金仙之体免疫（帅/将带 goldenImmortal buff）
   金仙之体免疫所有负面buff，包括沉默/禁锢/虚弱等 */
function hasGoldenImmunityForCurrentPlayer(){
  if(!state.board) return false;
  const mc = state.currentPlayer;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(p && p.player===mc && p.type===T.KING && p.buffs){
      if(p.buffs.some(b=>b.type==='goldenImmortal')) return true;
    }
  }
  return false;
}

/* v10: 获取当前玩家选中的主动技能（修复选将面板选择未生效的 bug）
   优先读取 state.playerActiveSkill（选将面板保存），回退到 char.skill */
function getActiveSkillForCurrentPlayer(){
  const ch=getCurrentChar();
  if(!ch) return null;
  /* PVP 模式：根据当前玩家颜色取对应选中技能 */
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    if(state.currentPlayer===RED && state.pvpRedActiveSkill) return state.pvpRedActiveSkill;
    if(state.currentPlayer===BLACK && state.pvpBlackActiveSkill) return state.pvpBlackActiveSkill;
  }
  /* PVE / 三英 / 阵营：使用 state.playerActiveSkill */
  if(state.playerActiveSkill) return state.playerActiveSkill;
  return ch.skill;
}

/* v17: 获取当前玩家选中的被动技能 */
function getPassiveForCurrentPlayer(){
  const ch=getCurrentChar();
  if(!ch) return null;
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    if(state.currentPlayer===RED && state.pvpRedPassive) return state.pvpRedPassive;
    if(state.currentPlayer===BLACK && state.pvpBlackPassive) return state.pvpBlackPassive;
  }
  if(state.playerPassiveSkill) return state.playerPassiveSkill;
  return (ch.passives&&ch.passives.length)?ch.passives[0]:null;
}

/* v17: 获取指定颜色玩家的被动技能（用于 HUD 双方显示） */
function getPassiveForColor(color){
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    if(color===RED) return state.pvpRedPassive || (CHARACTERS[state.pvpRedChar]?.passives?.[0] || null);
    if(color===BLACK) return state.pvpBlackPassive || (CHARACTERS[state.pvpBlackChar]?.passives?.[0] || null);
  }
  if(color===state.playerColor){
    return state.playerPassiveSkill || (CHARACTERS[state.character]?.passives?.[0] || null);
  }
  /* B王/AI 被动 */
  if(typeof getBkingPassives==='function'){
    const bkPassives = getBkingPassives();
    return bkPassives.length ? bkPassives[0] : null;
  }
  return null;
}

/* v17: 被动触发类型中文标签（用于 HUD 显示，区分主动/被动同名） */
function getPassiveTriggerLabel(trigger){
  const map = {
    turn_start:'回合',
    on_capture:'吃子',
    on_captured:'被吃',
    on_skill:'施法',
    aura:'光环',
    periodic:'周期',
    immune:'免疫'
  };
  return map[trigger] || trigger || '被动';
}

/* v17: 统一封锁对方技能（PVP/PVE 通用）
   PVE: aiSkillBlocked=true（B王下回合不能用技能）
   PVP: oppSkillBlockedColor=对方颜色（对方回合不能用技能）
   v21: 集成 p_bold（永久免疫）/ p_shameless（每局1次）免疫检查，
        若对方免疫成功则回滚 silenceTurns 等设置并阻止封锁。 */
function blockOppSkill(){
  const oppCharId = charForColor(oppColor());
  if(oppCharId && typeof tryConsumeSilenceImmunity==='function'
     && tryConsumeSilenceImmunity(oppCharId)){
    /* 免疫生效：回滚本技能设置的沉默/禁锢状态 */
    state.silenceTurns=0;
    state.aoeLockdownTurns=0;
    state.oppCannotCapture=false;
    speakTaunt('免疫！沉默/禁锢无效！','opp');
    return false;
  }
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    state.oppSkillBlockedColor = oppColor();
  } else {
    state.aiSkillBlocked = true;
  }
  return true;
}

/* v10: 按颜色召唤兵（指定HP）到空位，供 illusion 等技能调用 */
function summonPawnForColor(color, hp){
  for(let r=(color===RED?5:0); r<(color===RED?10:5); r++){
    for(let c=0;c<COLS;c++){
      if(!state.board[r][c]){
        state.board[r][c]={
          type:T.PAWN, player:color,
          hp:hp||PIECE_STATS[T.PAWN].hp,
          maxHp:hp||PIECE_STATS[T.PAWN].hp,
          atk:PIECE_STATS[T.PAWN].atk,
          def:PIECE_STATS[T.PAWN].def,
          _summoned:true /* v22 修复 Bug 9：标记为召唤物，对局结束或被吃时正常处理 */
        };
        return;
      }
    }
  }
}

/* v22 修复 Bug 1（主动技能）：提取 CD 重置逻辑为独立函数。
   原 usePlayerSkill 末尾的 CD 重置逻辑会被 case 内的 return 跳过，
   导致技能失败（如目标不存在）后玩家可立即再用。
   现将失败 case 的 return 改为 break，使其落入末尾的 resetSkillCooldown() 调用。
   注意：retreat/selfreverse 的"无步可退"属"无法启动"场景，保留 return 跳过重置（免费重试）。 */
function resetSkillCooldown(){
  if(state.gameMode==='three'){
    state.threeHeroCDs[state.threeHeroIndex]=0;
  } else if(state.gameMode==='pvp'){
    if(state.currentPlayer===RED){ state.roundsSincePlayerSkill=0; state.playerSkillLock=true; }
    else { state.roundsSinceP2Skill=0; state.p2SkillLock=true; }
  } else {
    state.roundsSincePlayerSkill=0; state.playerSkillLock=true;
  }
  /* 掀桌之神/天道因果的 CD 减免一次性消耗完毕 */
  state.skillCdReduce=0;
}

function usePlayerSkill(){
  if(!canUseSkill()) return;
  const char=getCurrentChar();
  /* v10: 使用选将面板选中的技能，而非默认 char.skill */
  const activeSkill=getActiveSkillForCurrentPlayer();
  const sid=activeSkill?activeSkill.id:char.skill.id;
  // 技能释放对话：我方先说话，对方反应
  dialogue(pick(char.skillLines), getOppReact());
  // 记录技能激活者（PVP下用于判定技能效果方向）
  state.skillOwnerColor=myColor();
  /* v22: 战报 — 主动技能释放 */
  addBattleLog('skill', `<b>${char.name}</b> 释放奇术 <b>${activeSkill?activeSkill.name:char.skill.name}</b>`);

  switch(sid){
    case 'rewind': // 侯智博·偷天换日（撤销对方一步+额外回合）
      {
        const lastAI=lastOppMove();
        if(lastAI){
          state.board[lastAI.from.r][lastAI.from.c]=lastAI.piece;
          state.board[lastAI.to.r][lastAI.to.c]=lastAI.captured;
          if(lastAI.captured){ if(lastAI.captured.player===RED) state.redCaptured.pop(); else state.blackCaptured.pop(); }
          const idx=state.history.indexOf(lastAI);
          state.history.splice(idx,1);
          state.moveCount--;
          removeLastHistoryEntry();
          state.currentPlayer=myColor();
          state.lastMove=state.history.length>0?{from:state.history[state.history.length-1].from,to:state.history[state.history.length-1].to}:null;
          if(state.boardSnapshots.length>0) state.boardSnapshots.pop();
          state.extraMove=1; // 额外一回合
        }
      }
      addBattleLog('skill', '<b>偷天换日</b> 撤销对方一步+额外回合');
      break;
    case 'rollcall': // 王昕·课堂点名（展示B王3步路线+B王不能吃子）v20: 改为只展示不强制
      {
        const plan=buildAIRoutePlan(3);
        if(plan.length>0) displayRoutePlan(plan,'#2d5a3d','B');
        state.skillActive='shield'; // B王不能吃子（忙着回答问题）
      }
      addBattleLog('skill', '<b>课堂点名</b> 展示B王3步+B王不能吃子');
      break;
    case 'teleport': // 周子翰·江山易主（传送己方棋子到任意空位）
      state.teleportMode=true;
      speakTaunt('选择一颗己方棋子进行乾坤挪移！','self');
      addBattleLog('skill', '<b>江山易主</b> 选己方棋子传送至空位');
      break;
    case 'ironwall': // 三金·狂战之怒（v13: 挂 ironwall+attackBoost buff 到选中棋子，2回合）
      state.skillActive='ironwall';
      state.ironwallTarget=null;
      speakTaunt('选择一颗己方棋子激发狂战之怒！','self');
      addBattleLog('skill', '<b>狂战之怒</b> 选子加铁壁+攻击buff 2回合');
      break;
    case 'disguise': // 鸡哥·完美伪装（互换位置+混乱攻击）
      state.disguiseMode=true;
      speakTaunt('选择一颗己方棋子进行伪装！','self');
      addBattleLog('skill', '<b>完美伪装</b> 选己方棋子进行伪装互换');
      break;
    case 'weaken': // ikun·唱跳rap（三回合弱化）
      state.skillActive='weaken';
      state.weakenedAITurns=3;
      addBattleLog('skill', '<b>唱跳rap</b> 对方弱化3回合');
      break;
    case 'revive': // 胡浩·浩然正气（复活两颗+额外回合）
      {
        const cap=myCaptured();
        let revived=0;
        while(cap.length>0&&revived<2){
          const piece=cap.pop();
          /* v22 修复 Bug 8：跳过被献祭的棋子（sacrifice 不应被复活） */
          if(state.sacrificedList && state.sacrificedList.some(sp=>sp===piece)) continue;
          let placed=false;
          /* 红方从底部放置，黑方从顶部放置 */
          const rs=myColor()===RED?ROWS-1:0;
          const re=myColor()===RED?-1:ROWS;
          const st=myColor()===RED?-1:1;
          for(let r=rs;r!==re&& !placed;r+=st) for(let c=0;c<COLS&&!placed;c++)
            /* v22 修复 Bug 4：复活时重置 HP 至满血（原未重置，复活棋子带残血上场） */
            if(!state.board[r][c]){ state.board[r][c]={...piece,player:myColor(),hp:piece.maxHp||piece.hp,maxHp:piece.maxHp||piece.hp,buffs:[]}; placed=true; }
          revived++;
        }
        state.extraMove=1;
      }
      addBattleLog('skill', '<b>浩然正气</b> 复活2子+额外回合');
      break;
    case 'lockdown': // 解宇轩·因果律锁（锁定对方一颗棋子4回合不能移动）
      {
        const oc=oppColor();
        const cand=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING){
            const mv=getLegalAIMoves(state.board,oc).filter(m=>m.fr===r&&m.fc===c);
            if(mv.length>0) cand.push({r,c,type:p.type});
          }
        }
        if(cand.length===0){ speakTaunt('对方无可锁定棋子！','self'); break; } /* v22: return->break 重置CD */
        // 选择价值最高的对方棋子锁定
        cand.sort((a,b)=>PIECE_VALUE[b.type]-PIECE_VALUE[a.type]);
        const target=cand[0];
        state.lockedPiece={r:target.r,c:target.c};
        state.lockTurns=4;
        speakTaunt(`因果律锁！${PIECE_CHAR[oc===RED?'red':'black'][target.type]}被禁锢4回合！`,'self');
        /* v22 P2 Bug 9: 补全战报 */
        addBattleLog('skill', '<b>因果律锁</b> 锁定对方最强子4回合');
      }
      break;
    case 'catch': // 陆星辰·异常捕获（对方下回合不能吃子+己方下回合连走两步）
      state.skillActive='catch-shield'; // 对方下回合不能吃子
      /* v22 修复 Bug 10（主动技能）：原立即设 extraMove+1 导致玩家本回合就多走一步，
         加上 doMove 回调中对方走完再设 extraMove=1，玩家总共多得 2 步（应为 1 步）。
         现删除立即触发，仅保留对方走完后的延迟触发（doMove 回调 line ~1449）。 */
      speakTaunt('异常捕获！你的攻击已被try-catch！下回合我连走两步！','self');
      addBattleLog('skill', '<b>异常捕获</b> 对方下回合禁吃+己方连走2步');
      break;
    case 'control': // 唐昊博涵·标准答案（操控对方走一步对你有利的棋，不能吃你的子）
      {
        const oc=oppColor();
        const oppMoves=getLegalAIMoves(state.board,oc);
        // 过滤掉能吃己方子的走法，剩下对己方有利的（评分最高的走法）
        const mc=myColor();
        const safe=oppMoves.filter(m=>{
          const tgt=state.board[m.tr][m.tc];
          return !tgt||tgt.player!==mc; // 不能吃己方子
        });
        if(safe.length===0){ speakTaunt('对方无路可走！','self'); break; } /* v22: return->break 重置CD */
        // 选对己方最有利的走法（走完后己方评分最高）
        const ranked=safe.map(m=>{
          const cap=state.board[m.tr][m.tc]; makeMv(state.board,m);
          const v=minimax(state.board,2,-Infinity,Infinity,true);
          undoMv(state.board,m,cap);
          return {move:m,val:v};
        }).sort((a,b)=>b.val-a.val);
        const best=ranked[0].move;
        // 强制对方走这步
        state.controlActive=true;
        state.controlledMove={from:{r:best.fr,c:best.fc},to:{r:best.tr,c:best.tc}};
        speakTaunt(`标准答案！这步我替你走了：${PIECE_CHAR[oc===RED?'red':'black'][state.board[best.fr][best.fc].type]}→(${best.tr},${best.tc})`,'self');
        addBattleLog('skill', '<b>标准答案</b> 操控对方走一步有利棋');
      }
      break;
    case 'awe': // 仙帝Alice·命定因果（对方弃最强子+仙帝命定3步路线+对方不能吃子+仙帝连走两步+剥夺B王被动2回合）
      {
        state.aweActive=true;
        const oc=oppColor();
        // 收集对方所有可移动的棋子（用于弃子）
        state.awePieces=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc){
            const moves=getLegalAIMoves(state.board,oc).filter(m=>m.fr===r&&m.fc===c);
            if(moves.length>0) state.awePieces.push({r,c});
          }
        }
        // 独门仙法：命定对方接下来3步路线（对方必须遵从）
        const plan=buildAIRoutePlan(3);
        if(plan.length>0) showRoutePlan(plan,'#9b59b6','仙');
        // 仙法压制：对方下回合无法吃子
        state.skillActive='shield';
        /* v22 修复 Bug 11（主动技能）：原缺失"仙帝连走两步"+"剥夺B王被动2回合"两项效果 */
        // 仙帝威压：下回合连走两步
        state.extraMove=(state.extraMove||0)+1;
        speakTaunt('仙帝降临！本座连走两步！','self');
        // 天罚：剥夺B王被动2回合（oppPassiveDisabled 在 PVE 下屏蔽 B王被动）
        state.oppPassiveDisabled=2;
      }
      addBattleLog('skill', '<b>命定因果</b> 对方弃子+命定3步+禁吃+连走2步+被动失效2回合');
      break;
    case 'silence': // 刘雪沛·破妄之眼（沉默B王4回合+30%走错概率+对B王伤害+50%）
      state.silenceTurns=4;
      blockOppSkill(); // v17: 统一封锁对方技能（PVP/PVE）
      /* v23 P1: 对B王伤害+50% — 给对方全体加 vulnerability buff（4回合） */
      addTeamBuff(state.board, oppColor(), 'vulnerability', 0.5, 4);
      speakTaunt('破妄之眼！B王，你的显摆到此为止！4回合内无法使用奇术，且受伤+50%！','self');
      addBattleLog('skill', '<b>破妄之眼</b> 沉默B王4回合+对B王伤害+50%（4回合）');
      break;
    case 'logic_silence': // 解宇轩·逻辑沉默（沉默3回合+对方下回合无法吃子）
      state.silenceTurns=3;
      blockOppSkill();
      state.oppCannotCapture=true; /* v19: 新增 — 对方下回合禁吃 */
      speakTaunt('逻辑沉默！3回合内你无法使用奇术，且下回合无法吃子！','self');
      addBattleLog('skill', '<b>逻辑沉默</b> 沉默3回合+对方下回合禁吃');
      break;
    case 'flip': // 大汉棋圣·掀桌不玩了（回溯3步+保留先手）
      {
        // 使用棋盘快照回溯最多3步
        const steps=Math.min(3, state.boardSnapshots.length);
        if(steps>0){
          /* v22 修复 Bug 12（主动技能）：原先 splice 删除 N 个再取最后一个，
             若快照数==N 则数组变空，boardSnapshots[-1] 为 undefined，
             回退到 state.board（当前棋盘），回溯完全无效。
             现先保存目标快照再截断数组。 */
          const targetIdx = Math.max(0, state.boardSnapshots.length - steps - 1);
          const target = state.boardSnapshots[targetIdx];
          state.board = cloneBoard(target || state.board);
          state.boardSnapshots = state.boardSnapshots.slice(0, targetIdx + 1);
          // 回退历史记录
          for(let i=0;i<steps;i++){
            if(state.history.length>0){
              const last=state.history.pop();
              state.moveCount=Math.max(0,state.moveCount-1);
              /* v22 修复 Bug 13（主动技能）：回溯时同步恢复技能状态（CD/沉默等） */
              if(last.skillSnap){
                state.roundsSincePlayerSkill=last.skillSnap.rsps;
                state.roundsSinceAISkill=last.skillSnap.rsas;
                state.roundsSinceP2Skill=last.skillSnap.rp2s;
                state.playerSkillLock=last.skillSnap.psl;
                state.p2SkillLock=last.skillSnap.p2sl;
                state.aiSkillLock=last.skillSnap.asl;
                state.weakenedAITurns=last.skillSnap.wat;
                state.ironwallTurns=last.skillSnap.iwt;
                state.lockTurns=last.skillSnap.lt;
                state.silenceTurns=last.skillSnap.st;
                state.skillActive=last.skillSnap.sa;
                state.aiSkillBlocked=last.skillSnap.asb;
                state.oppSkillBlockedColor=last.skillSnap.osbc;
              }
            }
          }
          // 重建吃子记录（v19: 用 actualCaptured 而非 captured，避免虚增存活棋子）
          state.redCaptured=[]; state.blackCaptured=[];
          for(const h of state.history){
            const killed = h.actualCaptured || null;
            if(killed){
              if(killed.player===RED) state.redCaptured.push(killed);
              else state.blackCaptured.push(killed);
            }
          }
        }
        // 掀桌者保留先手：当前回合设为释放技能方
        state.currentPlayer=myColor();
        state.selected=null; state.validMoves=[];
        state.lastMove=null; state.revealedMoves=null;
        renderAll();
        updateTurnIndicator(); updateCapturedDisplay();
      }
      addBattleLog('skill', '<b>掀桌不玩了</b> 回溯3步+保留先手');
      break;
    case 'arrogance': // B王·傲慢·目中无人（对方全体下回合攻击-25%+B王下次攻击+30%）
      addTeamBuff(state.board, oppColor(), 'weakness', 0.25, 1); /* 对方全体攻击-25%，1回合 */
      {
        const mc=myColor();
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type===T.KING){
            addBuff(p, 'attackBoost', Math.floor((p.atk||25)*0.3), 2); /* B王下次攻击+30% */
            break;
          }
        }
      }
      speakTaunt('傲慢！本王就是天！你们这群凡人不配直视！','self');
      addBattleLog('skill', '<b>傲慢·目中无人</b> 对方全体攻击-25%（1回合）+B王下次攻击+30%');
      break;
    case 'greedy': // B王·贪婪·夺人所爱（窃取对方一个永久buff给己方+B王回血30%）
      {
        const mc=myColor(), oc=oppColor();
        let stolen=false;
        let targetPiece=null, stolenBuff=null;
        for(let r=0;r<ROWS&&!stolenBuff;r++) for(let c=0;c<COLS&&!stolenBuff;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.buffs){
            const perm=p.buffs.find(b=>b._permanent||b.duration<0);
            if(perm){ targetPiece=p; stolenBuff=perm; }
          }
        }
        if(targetPiece&&stolenBuff){
          const idx=targetPiece.buffs.indexOf(stolenBuff);
          if(idx>=0) targetPiece.buffs.splice(idx,1);
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            const p=state.board[r][c];
            if(p&&p.player===mc&&p.type===T.KING){
              addBuff(p, stolenBuff.type, stolenBuff.value, stolenBuff.duration<0?-1:stolenBuff.duration, false, !!stolenBuff._permanent);
              break;
            }
          }
          stolen=true;
        }
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type===T.KING&&p.maxHp){
            p.hp=Math.min(p.maxHp, p.hp+Math.floor(p.maxHp*0.3)); /* B王回复30%最大HP */
            break;
          }
        }
        speakTaunt('贪婪！你的buff？现在是我的了！','self');
        addBattleLog('skill', '<b>贪婪·夺人所爱</b> '+(stolen?'窃取对方一个buff给B王+':'')+'B王回复30%最大HP');
      }
      break;
    /* ===== v30: B王七宗罪新增技能 ===== */
    case 'sloth': // B王·懒惰·拖泥带水（对方全体下回合无法移动远距离≤1格+攻击-20%）
      {
        const oc=oppColor();
        addTeamBuff(state.board, oc, 'weakness', 0.2, 1); /* 对方全体攻击-20%，1回合 */
        state.oppSlowTurns=2; /* 对方下回合移动距离≤1，持续2回合 */
        speakTaunt('懒惰？这叫以逸待劳！急什么？慢慢来！','self');
        addBattleLog('skill', '<b>懒惰·拖泥带水</b> 对方全体移动距离≤1（2回合）+攻击-20%（1回合）');
      }
      break;
    case 'envy': // B王·嫉妒·东施效颦（复制对方一个被动技能给己方，持续3回合）
      {
        const mc=myColor(), oc=oppColor();
        /* v30-fix: 使用 getPassiveForColor 获取对方实际选中的被动技能 */
        let oppPassiveId = null;
        if(typeof getPassiveForColor === 'function'){
          const oppPassive = getPassiveForColor(oc);
          if(oppPassive && oppPassive.id) oppPassiveId = oppPassive.id;
        }
        /* PVP 模式下从 pvp 字段获取 */
        if(!oppPassiveId && (state.gameMode==='pvp'||state.gameMode==='online')){
          if(oc===RED && state.pvpRedPassive) oppPassiveId = state.pvpRedPassive.id;
          else if(oc===BLACK && state.pvpBlackPassive) oppPassiveId = state.pvpBlackPassive.id;
        }
        if(oppPassiveId){
          /* 给己方临时添加该被动（标记 _envyStolen，3回合后移除） */
          if(!state.envyStolenPassives) state.envyStolenPassives=[];
          state.envyStolenPassives.push({ id: oppPassiveId, remainingTurns: 3, stolenFrom: oc });
          /* 同时让对方失去该被动3回合 */
          if(!state.oppPassiveDisabled) state.oppPassiveDisabled=0;
          state.oppPassiveDisabled=3;
          speakTaunt('嫉妒？本王只是借来用用！你的本事？现在是我的了！','self');
          addBattleLog('skill', '<b>嫉妒·东施效颦</b> 复制对方被动技能（3回合）+对方失去该被动');
          if(typeof showProcNotice==='function') showProcNotice('嫉妒·东施效颦！', '复制对方被动技能（3回合）', 'proc');
        } else {
          /* 若无对方被动信息，退化为给己方全体加 attackBoost */
          addTeamBuff(state.board, mc, 'attackBoost', 20, 3);
          speakTaunt('嫉妒？本王只是借来用用！','self');
          addBattleLog('skill', '<b>嫉妒·东施效颦</b> 无对方被动可偷，退化为己方全体棋子攻击+20（3回合）');
        }
      }
      break;
    case 'wrath': // B王·暴怒·怒火中烧（B王进入狂暴，3回合内攻击+50%但防御-30%+每次攻击附带20真实伤害）
      {
        const mc=myColor();
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc){
            addBuff(p, 'attackBoost', Math.floor((p.atk||0)*0.5), 3); /* 攻击+50%，3回合 */
            addBuff(p, 'defReduce', 0.3, 3); /* 防御-30%，3回合 */
            addBuff(p, 'trueDmgBoost', 20, 3); /* 真实伤害+20，3回合（新增buff类型） */
          }
        }
        speakTaunt('暴怒！本王要毁了一切！怒火中烧，你承受不住！','self');
        addBattleLog('skill', '<b>暴怒·怒火中烧</b> B王全体攻击+50%+防御-30%+攻击附带20真伤（3回合）');
      }
      break;
    case 'gluttony': // B王·暴食·吞噬同袍（吞噬己方一颗非王棋子，B王获得其HP和攻击的50%+下次攻击+40%）
      {
        const mc=myColor();
        /* 优先吞噬攻击最高的己方非王棋子（最大化收益） */
        let target=null, maxAtk=-1;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type!==T.KING){
            const atk=(p.atk||0)+Math.floor((p.charAtk||0)/10);
            if(atk>maxAtk){ maxAtk=atk; target={r,c,p}; }
          }
        }
        if(target){
          const eaten=target.p;
          const hpGain=Math.floor((eaten.maxHp||0)*0.5);
          const atkGain=Math.floor(((eaten.atk||0)+Math.floor((eaten.charAtk||0)/10))*0.5);
          /* 从棋盘移除被吞噬的棋子 */
          state.board[target.r][target.c]=null;
          /* 找到B王的帅，加成 */
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            const p=state.board[r][c];
            if(p&&p.player===mc&&p.type===T.KING){
              p.maxHp=(p.maxHp||p.hp)+hpGain;
              p.hp=Math.min(p.maxHp, p.hp+hpGain);
              addBuff(p, 'attackBoost', atkGain+Math.floor((p.atk||0)*0.4), 2); /* 永久攻击加成+下次攻击+40% */
              break;
            }
          }
          /* 移入己方阵亡名单（吞噬不计入对方战绩） */
          if(mc===RED&&state.redCaptured) state.redCaptured.push(eaten);
          else if(mc===BLACK&&state.blackCaptured) state.blackCaptured.push(eaten);
          speakTaunt('暴食！吞噬一切！你的力量，本王收下了！吃饱了才有力气显摆！','self');
          addBattleLog('skill', '<b>暴食·吞噬同袍</b> 吞噬己方1子+获得其50%HP和攻击+下次攻击+40%');
          if(typeof showProcNotice==='function') showProcNotice('暴食·吞噬同袍！', 'B王吞噬己方棋子获得属性', 'proc');
          renderAll(); updateCapturedDisplay();
        } else {
          speakTaunt('暴食？没有棋子可吞噬！','self');
          addBattleLog('skill', '<b>暴食·吞噬同袍</b> 无可吞噬棋子，技能失效');
        }
      }
      break;
    case 'lust': // B王·色欲·魅惑人心（诱惑对方一颗非王棋子倒戈1回合+该子攻击-30%）
      {
        const mc=myColor(), oc=oppColor();
        /* 找对方攻击最高的非王棋子（最大化收益） */
        let target=null, maxAtk=-1;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING){
            const atk=(p.atk||0)+Math.floor((p.charAtk||0)/10);
            if(atk>maxAtk){ maxAtk=atk; target={r,c,p}; }
          }
        }
        if(target){
          /* 暂时改变该棋子的 player 字段为 mc，1回合后恢复 */
          target.p._originalPlayer=target.p.player;
          target.p.player=mc;
          target.p._lustControlled=true;
          target.p._lustControlTurns=2; /* 2回合后恢复（下回合+本回合结束） */
          addBuff(target.p, 'weakness', 0.3, 2); /* 该子攻击-30%，2回合 */
          if(!state.lustControlledPieces) state.lustControlledPieces=[];
          state.lustControlledPieces.push({r:target.r,c:target.c,piece:target.p});
          speakTaunt('色欲！让本王看看你的忠心！倒戈吧，跟着本王才有前途！','self');
          addBattleLog('skill', '<b>色欲·魅惑人心</b> 诱惑对方1子倒戈1回合+该子攻击-30%');
          if(typeof showProcNotice==='function') showProcNotice('色欲·魅惑人心！', '对方棋子倒戈1回合', 'proc');
          renderAll();
        } else {
          speakTaunt('色欲？无人可诱惑！','self');
          addBattleLog('skill', '<b>色欲·魅惑人心</b> 无可诱惑棋子，技能失效');
        }
      }
      break;
    /* ===== 新增角色技能 ===== */
    case 'retreat': // 刘佳伟·以退为进（撤销己方1步+对方下回合禁吃）
      {
        const mc=myColor();
        let lastSelf=null;
        for(let i=state.history.length-1;i>=0;i--){ if(state.history[i].player===mc){ lastSelf=state.history[i]; break; } }
        if(lastSelf){
          state.board[lastSelf.from.r][lastSelf.from.c]=lastSelf.piece;
          state.board[lastSelf.to.r][lastSelf.to.c]=lastSelf.captured;
          if(lastSelf.captured){ if(lastSelf.captured.player===BLACK) state.blackCaptured.pop(); else state.redCaptured.pop(); }
          const idx=state.history.indexOf(lastSelf);
          state.history.splice(idx,1);
          state.moveCount--;
          removeLastHistoryEntry();
          state.oppCannotCapture=true; /* 对方下回合禁吃 */
          speakTaunt('以退为进！下回合你休想吃子！','self');
          addBattleLog('skill', '<b>以退为进</b> 撤销己方1步+对方下回合禁吃');
          renderAll(); updateCapturedDisplay();
        } else {
          /* v22 修复 Bug 10：无步可退时提示，return 跳过 CD 重置（免费重试） */
          speakTaunt('无步可退！','self');
          return;
        }
      }
      break;
    case 'hidden': // 袁清山·潜龙勿用（隐藏己方强子3回合）
      {
        const mc=myColor();
        let best=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type!==T.KING){
            if(!best||PIECE_VALUE[p.type]>PIECE_VALUE[best.p.type]) best={r,c,p};
          }
        }
        if(best){
          state.hiddenPiece={r:best.r,c:best.c,turns:3};
          speakTaunt('潜龙勿用！你找不到我的最强子！','self');
          addBattleLog('skill', '<b>潜龙勿用</b> 隐藏己方强子3回合');
        }
      }
      break;
    case 'combo': // 罗伦杰·连环斩（吃1子后再吃1子）
      // v10 弱角色增强：连击成功后攻击+20%（1回合）
      {
        const mc=myColor();
        const oc=oppColor();
        const myMoves=getLegalAIMoves(state.board,mc);
        const captureMoves=myMoves.filter(m=>state.board[m.tr][m.tc]&&state.board[m.tr][m.tc].player===oc);
        if(captureMoves.length===0){
          speakTaunt('连环斩需要先吃一子！','self');
          break; /* v22: return->break 重置CD */
        }
        /* 找价值最高的吃子 */
        captureMoves.sort((a,b)=>PIECE_VALUE[state.board[b.tr][b.tc].type]-PIECE_VALUE[state.board[a.tr][a.tc].type]);
        const first=captureMoves[0];
        doMove({r:first.fr,c:first.fc},{r:first.tr,c:first.tc});
        /* 第一斩后，再找第二斩 */
        setTimeout(()=>{
          const myMoves2=getLegalAIMoves(state.board,mc);
          const cap2=myMoves2.filter(m=>state.board[m.tr][m.tc]&&state.board[m.tr][m.tc].player===oc);
          if(cap2.length>0){
            cap2.sort((a,b)=>PIECE_VALUE[state.board[b.tr][b.tc].type]-PIECE_VALUE[state.board[a.tr][a.tc].type]);
            const second=cap2[0];
            doMove({r:second.fr,c:second.fc},{r:second.tr,c:second.tc});
            /* v10 弱角色增强：连击成功后给攻击方挂 attackBoost（+20%，1回合） */
            const attacker=state.board[second.tr][second.tc];
            if(attacker){
              addBuff(attacker, 'attackBoost', Math.floor((attacker.atk||0)*0.2), 1);
            }
            speakTaunt('连环斩！双杀！攻势再起！','self');
          }
        },600);
      }
      addBattleLog('skill', '<b>连环斩</b> 连续吃2子+连击后攻击+20%');
      break;
    /* ===== v10: 补全替代主动技能（actives[1]/actives[2]）===== */

    /* 侯智博·暗度陈仓：沉默对方2回合+对方下回合攻击-30% */
    case 'flank':
      state.silenceTurns=2;
      addTeamBuff(state.board, oppColor(), 'weakness', 0.2, 1); /* v22 修复 Bug 5：描述-20% 实际-30%，改为 0.2 */
      blockOppSkill(); /* v17: 统一封锁对方技能 */
      speakTaunt('暗度陈仓！沉默两回合，攻势亦减！','self');
      addBattleLog('skill', '<b>暗度陈仓</b> 沉默对方2回合+攻击-20%');
      break;
    /* 侯智博·奇兵破阵：全场禁锢对方1回合+己方连走2步 */
    case 'ambush':
      state.aoeLockdownTurns=1;
      state.extraMove=1;
      speakTaunt('奇兵破阵！全军禁锢！我连走两步！','self');
      addBattleLog('skill', '<b>奇兵破阵</b> 全场禁锢1回合+连走2步');
      break;

    /* 王昕·妙语嘲讽：对方下回合移动力-50%+攻击-25% */
    case 'mock':
      state.oppSlowTurns=1;
      addTeamBuff(state.board, oppColor(), 'weakness', 0.15, 1); /* v22 修复 Bug 5：描述-15% 实际-25%，改为 0.15 */
      speakTaunt('妙语嘲讽！慢慢来，攻击也弱了！','self');
      addBattleLog('skill', '<b>妙语嘲讽</b> 对方移动力-50%+攻击-15%');
      break;
    /* 王昕·考试突击：己方全体护盾(100)+连走2步 */
    case 'quiz':
      /* v19: 改用 buff 系统使护盾生效（原 state.teamShield 只写不读）
         v10 弱角色增强：护盾 80→100 */
      addTeamBuff(state.board, myColor(), 'shield', 100, 3);
      state.extraMove=1;
      speakTaunt('考试突击！全员护盾，再走两步！','self');
      addBattleLog('skill', '<b>考试突击</b> 己方全体护盾100+连走2步');
      break;

    /* 周子翰·优雅闪烁：己方棋子瞬移+下回合攻击+30% */
    case 'elegant':
      /* v13: 瞬移后由 selectPiece 处理，瞬移完成时挂 attackBoost buff */
      state.teleportMode=true;
      state.teleportBuff=0.3; /* 保留兼容：瞬移完成后挂 buff */
      speakTaunt('优雅闪烁！选一颗棋子瞬移！','self');
      addBattleLog('skill', '<b>优雅闪烁</b> 选己方棋子瞬移+下回合攻击+30%');
      break;
    /* 周子翰·乾坤大挪移：互换双方各1子+己方连走2步
       v19：改为两阶段选棋（先敌方一子→再己方一子），修复互换方向错误等恶性 Bug */
    case 'grandshift':
      state.swapMode=true;
      state.swapPhase='enemy';
      state.swapTargetA=null;
      state.extraMove=1;
      speakTaunt('乾坤大挪移！先选敌方一颗棋子！','self');
      addBattleLog('skill', '<b>乾坤大挪移</b> 互换双方各1子+连走2步');
      break;

    /* 三金·嗜血斩杀（v20: 改为玩家选己方棋子挂 executeMark buff，不再自动选最高价值） */
    case 'execute':
      state.skillActive='execute-mark';
      speakTaunt('嗜血斩杀！选一颗己方棋子激发杀意！','self');
      addBattleLog('skill', '<b>嗜血斩杀</b> 选己方棋子挂斩杀标记');
      break;
    /* 三金·兄弟连斩（v13: 挂 attackBoost buff 到己方全体，2回合；吃子后可再走） */
    case 'barrage':
      addTeamBuff(state.board, myColor(), 'attackBoost', 24, 2); /* +40% 基础攻击约等于 +24 */
      state.barrageActive=true; /* 吃子后可再走 */
      speakTaunt('兄弟连斩！全军攻击+40%，持续2回合！','self');
      addBattleLog('skill', '<b>兄弟连斩</b> 己方全体攻击+40% 2回合+吃子再走');
      break;

    /* 鸡哥·分身幻象：召唤1个己方兵（HP150）到空位
       v10 弱角色增强：幻象 HP 100→150 */
    case 'illusion':
      summonPawnForColor(myColor(), 150);
      speakTaunt('分身幻象！新的棋子登场！','self');
      addBattleLog('skill', '<b>分身幻象</b> 召唤1个己方兵HP150');
      break;
    /* 鸡哥·虚晃一枪：对方下回合攻击打偏+全体无法移动 */
    case 'feint':
      /* v22 修复 Bug 2：移除 aoeLockdownTurns=1（与"打偏"语义冲突——
         aoeLockdownTurns 让对方直接跳过回合，oppMissNext 即使存活也无效）。
         仅保留 oppMissNext，由对方回合结束时清除（原在技能方回合末清除导致失效）。 */
      state.oppMissNext=true;
      speakTaunt('虚晃一枪！全军打偏！','self');
      addBattleLog('skill', '<b>虚晃一枪</b> 对方下回合攻击打偏');
      break;

    /* ikun·节奏掌控：对方下回合移动力-50%+沉默1回合+攻击-20%
       v10 弱角色增强：新增对方全体攻击-20%（1回合） */
    case 'rhythm':
      state.oppSlowTurns=1;
      state.silenceTurns=1;
      addTeamBuff(state.board, oppColor(), 'weakness', 0.2, 1);
      blockOppSkill(); /* v17: 统一封锁对方技能 */
      speakTaunt('节奏掌控！跟不上我的节奏吧！','self');
      addBattleLog('skill', '<b>节奏掌控</b> 对方移动力-50%+沉默1回合+攻击-20%');
      break;
    /* ikun·全给你（v13: 挂 reflect buff 到己方全体，3回合） */
    case 'allyours':
      addTeamBuff(state.board, myColor(), 'reflect', 0.5, 3);
      state.extraMove=1;
      speakTaunt('全给你！反弹五成，连走两步！','self');
      addBattleLog('skill', '<b>全给你</b> 己方反弹50% 3回合+连走2步');
      break;

    /* 胡浩·正道护体（v13: 挂 shield+defenseBoost buff 到选中棋子） */
    case 'shield':
      state.shieldMode=true; /* 进入选择棋子模式 */
      state.shieldAmount=100;
      state.shieldDefBuff=0.3;
      speakTaunt('正道护体！选一颗棋子加护盾！','self');
      addBattleLog('skill', '<b>正道护体</b> 选子加护盾100+防御+30%');
      break;
    /* 胡浩·万法归一（v13: 复活+挂 attackBoost buff 到己方全体，2回合） */
    case 'unity':
      {
        const cap=myCaptured();
        let revived=0;
        while(cap.length>0&&revived<3){
          const piece=cap.pop();
          /* v22 修复 Bug 8：跳过被献祭的棋子（sacrifice 不应被复活） */
          if(state.sacrificedList && state.sacrificedList.some(sp=>sp===piece)) continue;
          const rs=myColor()===RED?ROWS-1:0;
          const re=myColor()===RED?-1:ROWS;
          const st=myColor()===RED?-1:1;
          let placed=false;
          for(let r=rs;r!==re&&!placed;r+=st) for(let c=0;c<COLS&&!placed;c++)
            /* v22 修复 Bug 4：复活时重置 HP 至满血（原未重置，复活棋子带残血上场） */
            if(!state.board[r][c]){ state.board[r][c]={...piece,player:myColor(),hp:piece.maxHp||piece.hp,maxHp:piece.maxHp||piece.hp,buffs:[]}; placed=true; }
          revived++;
        }
        addTeamBuff(state.board, myColor(), 'attackBoost', 12, 2); /* +20% 约等于 +12 */
        speakTaunt('万法归一！复活+全军攻击+20%，持续2回合！','self');
        addBattleLog('skill', '<b>万法归一</b> 复活3子+己方全体攻击+20% 2回合');
        renderAll();
      }
      break;

    /* 解宇轩·逻辑沉默（id=silence 共用刘雪沛的 case，增强：+对方下回合不能吃子）*/
    /* silence case 已存在，此处通过通用逻辑处理（见下） */

    /* 解宇轩·逻辑爆破：全场禁锢1回合+对方下回合不能用技能 */
    case 'logicblast':
      state.aoeLockdownTurns=1;
      state.silenceTurns=1;
      blockOppSkill(); /* v17: 统一封锁对方技能 */
      speakTaunt('逻辑爆破！全场禁锢，技能封锁！','self');
      addBattleLog('skill', '<b>逻辑爆破</b> 全场禁锢1回合+沉默1回合');
      break;

    /* 陆星辰·Debug扫描（v20: 改为玩家选己方棋子挂 executeMark buff，不再自动选最高价值） */
    case 'debug':
      state.skillActive='debug-mark';
      speakTaunt('Debug扫描！选一颗己方棋子扫描Bug！','self');
      addBattleLog('skill', '<b>Debug扫描</b> 选己方棋子挂扫描标记');
      break;
    /* 陆星辰·系统崩溃：对方全体沉默2回合+下回合不能移动 */
    case 'crash':
      state.silenceTurns=2;
      blockOppSkill(); /* v17: 统一封锁对方技能 */
      state.aoeLockdownTurns=1;
      speakTaunt('系统崩溃！全员沉默+禁锢！','self');
      addBattleLog('skill', '<b>系统崩溃</b> 对方沉默2回合+下回合禁锢');
      break;

    /* 唐昊博涵·翻书作弊（v20: 看穿改为只显示不强制，避免与 exam 语义重叠）
       v10 弱角色增强：护盾 72→80，新增己方全体攻击+20%（2回合） */
    case 'cheat':
      {
        const mc=myColor();
        const plan=buildAIRoutePlan(2);
        if(plan.length>0) displayRoutePlan(plan,'#8a6b3a','唐');
        addTeamBuff(state.board, mc, 'shield', 80, 3); /* v23 P1: 护盾80，3回合 */
        addTeamBuff(state.board, mc, 'attackBoost', 12, 2); /* v10: +20% 约 +12，2回合 */
        /* v23 P1: 补全"仕、相防御+20（3回合）" */
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && (p.type===T.ADVISOR || p.type===T.ELEPHANT)){
            addBuff(p, 'defenseBoost', 20, 3);
          }
        }
        speakTaunt('翻书作弊！答案我都看到了，全军护盾+攻击+仕相防御！','self');
        addBattleLog('skill', '<b>翻书作弊</b> 展示B王2步+己方全体护盾80（3回合）+攻击+20%（2回合）+仕相防御+20（3回合）');
      }
      break;
    /* 唐昊博涵·考试突击：操控对方下2步+对方下回合不能吃子 */
    case 'exam':
      {
        const plan=buildAIRoutePlan(2);
        if(plan.length>0){
          state.aiRoutePlan=plan.slice(0,2);
          state.aiRouteTurns=2;
          showRoutePlan(plan,'#8a6b3a','唐');
        }
        state.skillActive='shield'; /* 对方下回合不能吃子 */
        speakTaunt('考试突击！这2步我替你定了！','self');
        addBattleLog('skill', '<b>考试突击</b> 操控对方下2步+对方下回合禁吃');
      }
      break;

    /* 仙帝Alice·仙帝降临：禁锢对方1子2回合+可被吃 */
    case 'descent':
      {
        const oc=oppColor();
        const cand=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING){
            const mv=getLegalAIMoves(state.board,oc).filter(m=>m.fr===r&&m.fc===c);
            if(mv.length>0) cand.push({r,c,type:p.type});
          }
        }
        if(cand.length===0){ speakTaunt('无目标可禁锢！','self'); break; } /* v22: return->break 重置CD */
        cand.sort((a,b)=>PIECE_VALUE[b.type]-PIECE_VALUE[a.type]);
        const t=cand[0];
        state.lockedPiece={r:t.r,c:t.c};
        state.lockTurns=2;
        speakTaunt('仙帝降临！尔等禁锢2回合！','self');
        /* v22 P2 Bug 9: 补全战报 */
        addBattleLog('skill', '<b>仙帝降临</b> 锁定对方最强子2回合');
      }
      break;
    /* 仙帝Alice·仙帝审判：全场真实伤害40+对方被动失效2回合（v36: 60→40, 3回合→2回合）*/
    case 'judgment':
      {
        const oc=oppColor();
        let killed=0;
        /* v10: 谋属性贯通 — 真实伤害受 int 加成 */
        const trueDmg=applyIntToSkillDamage(getCurrentCharId(), 40);
        /* v22 修复 Bug 21（主动技能）：审判击杀的棋子应触发被动链（p_chain/p_attack 等），
           原直接 null+pushCaptured 不调用 passivesOnCapture/passivesOnCaptured。 */
        const killedPieces=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc){
            p.hp-=trueDmg; /* 真实伤害40（谋属性加成） */
            if(p.hp<=0){
              state.board[r][c]=null;
              pushCaptured(p);
              killed++;
              killedPieces.push({piece:p, r, c});
            }
          }
        }
        /* 触发被动链：审判方为技能释放方，被审判方为 victim */
        const capturerChar = state.gameMode==='pvp' ? (state.currentPlayer===RED?state.pvpRedChar:state.pvpBlackChar) : state.character;
        const victimChar = state.gameMode==='pvp' ? (state.currentPlayer===RED?state.pvpBlackChar:state.pvpRedChar) : 'bking';
        if(typeof passivesOnCapture==='function'){
          for(const kp of killedPieces){
            passivesOnCapture(capturerChar, kp.piece, kp.r, kp.c, kp.r, kp.c);
          }
        }
        if(typeof passivesOnCaptured==='function'){
          for(const kp of killedPieces){
            passivesOnCaptured(victimChar, capturerChar, kp.piece, null);
          }
        }
        state.oppPassiveDisabled=2; /* 对方被动失效2回合（v36: 3→2）*/
        speakTaunt(`仙帝审判！真实伤害${trueDmg}，被动封锁2回合！斩杀${killed}子！`,'self');
        addBattleLog('skill', `<b>仙帝审判</b> 全场真实伤害${trueDmg}+对方被动失效2回合`);
        renderAll();
      }
      break;

    /* 刘雪沛·洞察标记（v20: 改为玩家选敌方棋子挂 vulnerability buff，让敌方被攻击时受伤+50%）
       原实现给敌方挂 executeMark 完全无效（executeMark 只对攻击方生效），属严重业务逻辑bug */
    case 'mark':
      state.skillActive='mark-target';
      speakTaunt('洞察标记！选一颗敌方棋子锁定！','self');
      addBattleLog('skill', '<b>洞察标记</b> 选敌方棋子挂易伤标记');
      break;
    /* 刘雪沛·克星之刃：全场沉默B王2回合+B王防御-30% */
    case 'nemesis':
      state.silenceTurns=2;
      blockOppSkill(); /* v17: 统一封锁对方技能 */
      addTeamBuff(state.board, oppColor(), 'defReduce', 0.3, 2); /* v22 P2 Bug 6: 持续 2 回合，与 2 回合沉默对齐 */
      speakTaunt('克星之刃！全员沉默，防御崩塌！','self');
      addBattleLog('skill', '<b>克星之刃</b> 沉默2回合+对方防御-30%');
      break;

    /* 大汉棋圣·豪迈冲撞：减速B王全体+攻击-15% */
    case 'charge':
      state.oppSlowTurns=1;
      addTeamBuff(state.board, oppColor(), 'weakness', 0.15, 1); /* v17: 对方全体攻击-15%（buff系统） */
      speakTaunt('豪迈冲撞！全军减速，攻势亦减！','self');
      addBattleLog('skill', '<b>豪迈冲撞</b> 对方移动力-50%+攻击-15%');
      break;
    /* 大汉棋圣·棋圣降临：回溯5步+B王下回合不能吃子+额外回合 */
    case 'saint':
      {
        const steps=Math.min(5, state.boardSnapshots.length);
        if(steps>0){
          /* v22 修复 Bug 12/13（主动技能）：同 flip，先保存目标快照再截断，并恢复技能状态 */
          const targetIdx = Math.max(0, state.boardSnapshots.length - steps - 1);
          const target = state.boardSnapshots[targetIdx];
          state.board = cloneBoard(target || state.board);
          state.boardSnapshots = state.boardSnapshots.slice(0, targetIdx + 1);
          for(let i=0;i<steps;i++){
            if(state.history.length>0){
              const last=state.history.pop();
              state.moveCount=Math.max(0,state.moveCount-1);
              if(last.skillSnap){
                state.roundsSincePlayerSkill=last.skillSnap.rsps;
                state.roundsSinceAISkill=last.skillSnap.rsas;
                state.roundsSinceP2Skill=last.skillSnap.rp2s;
                state.playerSkillLock=last.skillSnap.psl;
                state.p2SkillLock=last.skillSnap.p2sl;
                state.aiSkillLock=last.skillSnap.asl;
                state.weakenedAITurns=last.skillSnap.wat;
                state.ironwallTurns=last.skillSnap.iwt;
                state.lockTurns=last.skillSnap.lt;
                state.silenceTurns=last.skillSnap.st;
                state.skillActive=last.skillSnap.sa;
                state.aiSkillBlocked=last.skillSnap.asb;
                state.oppSkillBlockedColor=last.skillSnap.osbc;
              }
            }
          }
          state.redCaptured=[]; state.blackCaptured=[];
          for(const h of state.history){
            /* v19: 用 actualCaptured 而非 captured，避免虚增存活棋子 */
            const killed = h.actualCaptured || null;
            if(killed){
              if(killed.player===RED) state.redCaptured.push(killed);
              else state.blackCaptured.push(killed);
            }
          }
        }
        state.skillActive='shield'; /* B王下回合不能吃子 */
        state.extraMove=1;
        state.currentPlayer=myColor();
        state.selected=null; state.validMoves=[];
        state.lastMove=null; state.revealedMoves=null;
        speakTaunt('棋圣降临！回溯五步，再走一步！','self');
        addBattleLog('skill', '<b>棋圣降临</b> 回溯5步+对方禁吃+额外回合');
        renderAll(); updateCapturedDisplay();
      }
      break;

    /* 刘佳伟·稳如泰山：己方1子护盾+防御+25% */
    case 'steadfast':
      state.shieldMode=true;
      state.shieldAmount=80;
      state.shieldDefBuff=0.25;
      speakTaunt('稳如泰山！选一颗棋子加护盾！','self');
      addBattleLog('skill', '<b>稳如泰山</b> 选子加护盾80+防御+25%');
      break;
    /* 刘佳伟·后发制人（v13: 挂 reflect buff 到己方全体，3回合）
       v22 修复 Bug 6：原 addTeamBuff weakness 0.1 3回合 恒 -10% 不叠加（addBuff 取 max）。
       改为 counterActiveTurns=3 + counterStacks=0，由 passivesOnTurnStart 每回合
       重新施加 weakness（stacks*0.1）1回合，实现"每回合-10%"累积叠加（-10%/-20%/-30%）。
       v10 弱角色增强：反弹 40%→50%，每回合 weakness 0.1→0.15（见 skills.js）。 */
    case 'counter':
      addTeamBuff(state.board, myColor(), 'reflect', 0.5, 3);
      state.counterActiveTurns=3;
      state.counterStacks=0;
      speakTaunt('后发制人！反弹五成，攻势渐衰！','self');
      addBattleLog('skill', '<b>后发制人</b> 己方反弹50% 3回合+对方攻击逐回合-15%');
      break;

    /* 袁清山·隐遁闪烁：己方1子瞬移到空位+下回合免疫（原 teleportUntrackable 死代码改为 immune buff） */
    case 'blink':
      state.teleportMode=true;
      state.blinkActive=true; /* v22 修复 Bug 3：teleportUntrackable 全文件无读取点，
         改为瞬移完成后给棋子挂 immune buff 1 回合（由 tryMove 瞬移落点逻辑处理） */
      speakTaunt('隐遁闪烁！选一颗棋子瞬移！','self');
      addBattleLog('skill', '<b>隐遁闪烁</b> 选己方棋子瞬移+下回合免疫');
      break;
    /* 袁清山·龙跃九天（v13: 挂 attackBoost buff 到己方全体，2回合）
       v10 弱角色增强：己方帅获得 50 点护盾 */
    case 'leap':
      {
        const mc=myColor();
        addTeamBuff(state.board, mc, 'attackBoost', 24, 2); /* +40% 约 +24 */
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && p.type===T.KING){
            addBuff(p, 'shield', 50, 3);
          }
        }
        state.skillActive='shield'; /* B王下回合不能吃子 */
        speakTaunt('龙跃九天！全军攻击+40%，帅获护盾！','self');
        addBattleLog('skill', '<b>龙跃九天</b> 己方全体攻击+40% 2回合+对方禁吃+帅护盾50');
      }
      break;

    /* 罗伦杰·破甲突袭（v20: 改为玩家选敌方棋子挂 vulnerability + defReduce buff）
       原自动选最高价值棋子+挂 executeMark（无效）改为玩家自选目标+正确 buff */
    case 'pierce':
      state.skillActive='pierce-target';
      speakTaunt('破甲突袭！选一颗敌方棋子破防！','self');
      addBattleLog('skill', '<b>破甲突袭</b> 选敌方棋子挂易伤+破防');
      break;
    /* 罗伦杰·无尽连斩（v13: 挂 attackBoost buff 到己方全体+连击机制）
       v10 弱角色增强：攻击 +30%→+40%（2回合） */
    case 'storm':
      addTeamBuff(state.board, myColor(), 'attackBoost', 24, 2); /* +40% 约 +24 */
      state.stormActive=3; /* 最多3步额外 */
      speakTaunt('无尽连斩！全军攻击+40%，吃一子再走一步！','self');
      addBattleLog('skill', '<b>无尽连斩</b> 己方攻击+40% 2回合+吃子再走最多3步');
      break;

    /* 大爱仙尊（古月方源）·噬蛊祭道：献祭己方最弱子，对敌方最强子造成真实伤害 */
    case 'sacrifice':
      {
        const mc=myColor(), oc=oppColor();
        let weakest=null, strongest=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(!p) continue;
          if(p.player===mc&&p.type!==T.KING){
            if(!weakest||PIECE_VALUE[p.type]<PIECE_VALUE[weakest.p.type]) weakest={r,c,p};
          }
          if(p.player===oc&&p.type!==T.KING){
            if(!strongest||PIECE_VALUE[p.type]>PIECE_VALUE[strongest.p.type]) strongest={r,c,p};
          }
        }
        if(!weakest){ speakTaunt('无可献祭之子！','self'); break; } /* v22: return->break 重置CD */
        if(!strongest){ speakTaunt('敌方无子可诛！','self'); break; } /* v22: return->break 重置CD */
        /* v10: 谋属性贯通 — 献祭伤害受 int 加成 */
        const baseDmg=Math.max(1, (weakest.p.maxHp||weakest.p.hp||100));
        const dmg=applyIntToSkillDamage(getCurrentCharId(), baseDmg);
        const sac=state.board[weakest.r][weakest.c];
        state.board[weakest.r][weakest.c]=null;
        /* v22 修复 Bug 8：献祭子不应进 captured 列表（否则可被 revive/unity 复活）。
           改用 sacrificedList 跟踪，revive/unity 复活时检查并跳过。 */
        if(!state.sacrificedList) state.sacrificedList=[];
        state.sacrificedList.push(sac);
        const tgt=state.board[strongest.r][strongest.c];
        tgt.hp -= dmg;
        speakTaunt('噬蛊祭道！以'+PIECE_CHAR[mc===RED?'red':'black'][sac.type]+'献祭，敌'+PIECE_CHAR[oc===RED?'red':'black'][tgt.type]+'受'+dmg+'真实伤害！','self');
        /* v22 P2 Bug 9: 补全战报 */
        addBattleLog('skill', '<b>噬蛊祭道</b> 献祭己方棋子，对对方造成'+dmg+'伤害，己方全体回血40');
        if(tgt.hp<=0){
          tgt.hp=0;
          state.board[strongest.r][strongest.c]=null;
          pushCaptured(tgt);
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            const p=state.board[r][c];
            if(p&&p.player===mc&&p.maxHp) p.hp=Math.min(p.maxHp,p.hp+40);
          }
          speakTaunt('猎物已诛，残血回收...','self');
        }
        updateCapturedDisplay(); renderAll();
      }
      break;
    /* 大爱仙尊·算计连环：标记敌方最强子为猎物（防御归零+击杀回血） */
    case 'prey':
      {
        const oc=oppColor();
        let strongest=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING){
            if(!strongest||PIECE_VALUE[p.type]>PIECE_VALUE[strongest.p.type]) strongest={r,c,p};
          }
        }
        if(!strongest){ speakTaunt('无可标记之猎物！','self'); break; } /* v22: return->break 重置CD */
        addBuff(strongest.p, 'defReduce', 1.0, 3); /* 防御归零（无视防御） */
        addBuff(strongest.p, 'preyMark', 1, 3); /* 猎物标记：被吃时触发回血 */
        speakTaunt('算计连环！'+PIECE_CHAR[oc===RED?'red':'black'][strongest.p.type]+'已成猎物，三回合内必诛！','self');
        /* v22 P2 Bug 9: 补全战报 */
        addBattleLog('skill', '<b>算计连环</b> 标记对方棋子');
      }
      break;
    /* 大爱仙尊·大爱无疆：将敌方攻击力最高的非王棋子感化为己方 */
    case 'conversion':
      {
        const mc=myColor(), oc=oppColor();
        let target=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING){
            if(!target||(p.atk||0)>(target.p.atk||0)) target={r,c,p};
          }
        }
        if(!target){ speakTaunt('无可感化之敌！','self'); break; } /* v22: return->break 重置CD */
        const t=state.board[target.r][target.c];
        t.player=mc; /* 阵营反转，万物皆为我用 */
        t.buffs=[]; /* 清除原阵营所有 buff */
        /* v22 修复 Bug 22（主动技能）：感化后重算角色属性加成，
           避免棋子仍带原阵营的 charAtk/charDef 加成。 */
        const myCharId = state.gameMode==='pvp'
          ? (mc===RED?state.pvpRedChar:state.pvpBlackChar)
          : state.character;
        if(myCharId){
          const bonus = getCharBonus(myCharId);
          t.charAtk = bonus.charAtk;
          t.charDef = bonus.charDef;
          t.charInt = bonus.charInt;
        }
        speakTaunt('大爱无疆...你的'+PIECE_CHAR[oc===RED?'red':'black'][t.type]+'，归我了。','self');
        /* v22 P2 Bug 9: 补全战报 */
        addBattleLog('skill', '<b>大爱无疆</b> 感化对方棋子');
        updateCapturedDisplay(); renderAll();
      }
      break;

    /* === empire（帝国元首）3 个主动 === */
    /* v23 P0-3: 闪电战 — 原设置 extraMoveRange buff 但 engine.js 的 getRookMoves/getHorseMoves
       从不读取该 buff，导致"移动+1"效果完全失效。改为 attackBoost + 全军连走2步（已有 extraMove
       读取点），与描述对齐且实际生效。 */
    case 'blitz': // 闪电战：己方车马攻击+30%（2回合），全军连走2步
      {
        const mc = myColor();
        let count = 0;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p && p.player===mc && (p.type===T.ROOK || p.type===T.HORSE)){
            addBuff(p, 'attackBoost', Math.floor(p.atk * 0.3), 2);
            count++;
          }
        }
        /* 全军连走2步（替代原 extraMoveRange，extraMove 在 doMove 末尾已有读取点） */
        state.extraMove = Math.max(state.extraMove||0, 1);
        speakTaunt(`闪电战！${count}颗车马攻击+30%，全军连走2步！`,'self');
        addBattleLog('skill', '<b>闪电战</b> 己方车马攻击+30%（2回合）+全军连走2步');
        renderAll();
      }
      break;

    case 'lebensraum': // 生存空间：己方<12子时召唤2兵+全体攻击+25%（2回合）
      {
        const mc = myColor();
        let count = 0;
        // 己方棋子数<12时，召唤2个兵到空位
        let myCount = 0;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          if(state.board[r][c] && state.board[r][c].player===mc) myCount++;
        }
        if(myCount < 12){
          const emptyCells = [];
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            if(!state.board[r][c]) emptyCells.push({r,c});
          }
          // 召唤2个兵到空位（优先靠近己方阵地）
          for(let i=0; i<2 && emptyCells.length>0; i++){
            const idx = Math.floor(Math.random() * emptyCells.length);
            const pos = emptyCells.splice(idx, 1)[0];
            const stats = PIECE_STATS[T.PAWN];
            const charBonus = getCharBonus(state.character) || {charAtk:0, charDef:0, charInt:0};
            state.board[pos.r][pos.c] = {
              type: T.PAWN,
              player: mc,
              charAtk: charBonus.charAtk,
              charDef: charBonus.charDef,
              charInt: charBonus.charInt,
              ptype: PIECE_TYPE[T.PAWN],
              hp: stats.hp,
              maxHp: stats.hp,
              atk: stats.atk,
              def: stats.def
            };
            count++;
          }
        }
        // 己方全体攻击+25%（2回合）
        addTeamBuff(state.board, mc, 'attackBoost', 20, 2);
        speakTaunt(`生存空间！召唤${count}个兵，全体攻击+25%！`,'self');
        addBattleLog('skill', `<b>生存空间</b> 召唤${count}兵+己方全体攻击+25%（2回合）`);
        renderAll();
      }
      break;

    case 'fuhrer': // 元首令：禁锢对方1回合+本方连走3步+攻击+50%（1回合）
      {
        state.aoeLockdownTurns = 1;
        state.extraMove = 2; // 连走2步（原 decree 是1，强化为2）
        const mc = myColor();
        addTeamBuff(state.board, mc, 'attackBoost', 40, 1);
        speakTaunt('元首令！全军禁锢对方，本方连走3步+攻击+50%！','self');
        addBattleLog('skill', '<b>元首令</b> 禁锢对方1回合+本方连走3步+攻击+50%（1回合）');
        renderAll();
      }
      break;

    /* === broly（布罗利）3 个主动 === */
    case 'rampage': // 暴动冲击：对敌方最强子造成250%伤害+击退至随机空位
      {
        const mc = myColor(), oc = mc===RED?BLACK:RED;
        let target = null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p = state.board[r][c];
          if(p && p.player===oc && p.type!==T.KING){
            if(!target || PIECE_VALUE[p.type] > PIECE_VALUE[target.p.type]) target = {r,c,p};
          }
        }
        if(!target){ speakTaunt('无可冲击之敌！','self'); break; }
        const dmg = Math.floor((target.p.atk + target.p.maxHp) * 2.5); /* v23 P1: 200%→250% 对齐 data.js 描述 */
        target.p.hp -= dmg;
        speakTaunt(`暴动冲击！对${PIECE_CHAR[oc===RED?'red':'black'][target.p.type]}造成${dmg}伤害！`,'self');
        addBattleLog('skill', `<b>暴动冲击</b> 对敌方最强子造成${dmg}伤害`);
        if(target.p.hp <= 0){
          state.board[target.r][target.c] = null;
          pushCaptured(target.p);
          addBattleLog('skill', '<b>暴动冲击</b> 击杀敌方最强子');
        } else {
          /* v23 P1: 补全击退逻辑 — 目标存活则击退至随机空位（参考 eruption） */
          const emptyCells = [];
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            if(!state.board[r][c]) emptyCells.push({r,c});
          }
          if(emptyCells.length > 0){
            const newPos = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            state.board[newPos.r][newPos.c] = target.p;
            state.board[target.r][target.c] = null;
            addBattleLog('skill', `<b>暴动冲击</b> 击退至(${newPos.r},${newPos.c})`);
          }
        }
        updateCapturedDisplay(); renderAll();
      }
      break;

    case 'awaken': // 传说觉醒：己方全体获得溢出的气（永久递增）+立即恢复30%HP
      {
        const mc = myColor();
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p = state.board[r][c];
          if(p && p.player===mc){
            addBuff(p, 'attackBoost', 5, -1, false, true); // permanent
            addBuff(p, 'defenseBoost', 5, -1, false, true);
            /* v23 P1: 补全"立即恢复30%HP" */
            if(p.maxHp) p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.3));
          }
        }
        speakTaunt('传说觉醒！全军获得溢出的气，每回合递增，且恢复30%HP！','self');
        addBattleLog('skill', '<b>传说觉醒</b> 己方全体获得溢出的气（永久递增）+恢复30%HP');
        renderAll();
      }
      break;

    case 'eruption': // 气弹喷发：全场100真实伤害+沉默1回合+击退1子（谋属性加成）
      {
        const mc = myColor(), oc = mc===RED?BLACK:RED;
        const baseDmg = applyIntToSkillDamage(getCurrentCharId(), 100); // 谋属性加成
        let killed = 0;
        const killedPieces = [];
        let pushedPiece = null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p = state.board[r][c];
          if(p && p.player===oc){
            p.hp -= baseDmg;
            if(p.hp <= 0){
              state.board[r][c] = null;
              pushCaptured(p);
              killed++;
              killedPieces.push({piece:p, r, c});
            } else if(!pushedPiece && p.type !== T.KING){
              // 击退1颗敌方子至随机空位（保留HP）
              pushedPiece = {r, c, p};
            }
          }
        }
        // 击退处理
        if(pushedPiece){
          const emptyCells = [];
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            if(!state.board[r][c]) emptyCells.push({r,c});
          }
          if(emptyCells.length > 0){
            const newPos = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            state.board[newPos.r][newPos.c] = pushedPiece.p;
            state.board[pushedPiece.r][pushedPiece.c] = null;
            addBattleLog('skill', `<b>气弹喷发</b> 击退1子至(${newPos.r},${newPos.c})`);
          }
        }
        // 触发被动链
        const capturerChar = getCurrentCharId();
        const victimChar = state.gameMode==='pvp' ? (state.currentPlayer===RED?state.pvpBlackChar:state.pvpRedChar) : 'bking';
        if(typeof passivesOnCapture==='function'){
          for(const kp of killedPieces) passivesOnCapture(capturerChar, kp.piece, kp.r, kp.c, kp.r, kp.c);
        }
        if(typeof passivesOnCaptured==='function'){
          for(const kp of killedPieces) passivesOnCaptured(victimChar, capturerChar, kp.piece, null);
        }
        state.silenceTurns = 1;
        blockOppSkill();
        speakTaunt(`气弹喷发！全场${baseDmg}真实伤害，沉默1回合！斩杀${killed}子！`,'self');
        addBattleLog('skill', `<b>气弹喷发</b> 全场${baseDmg}真实伤害+沉默1回合+击退1子，斩杀${killed}子`);
        updateCapturedDisplay(); renderAll();
      }
      break;

    /* ===== v29: 新增 3 角色（张树灿/张毓芝/刘锋）主动技能 ===== */
    /* 张树灿·沉默气场：沉默B王2回合+B王下次攻击-20% */
    case 'silence_aura':
      state.silenceTurns=2;
      blockOppSkill();
      addTeamBuff(state.board, oppColor(), 'weakness', 0.2, 1); /* B王下次攻击-20% */
      speakTaunt('……沉默是金。','self');
      addBattleLog('skill', '<b>沉默气场</b> 沉默B王2回合+B王下次攻击-20%');
      break;
    /* 张树灿·内敛蓄势：己方攻击最高的非王棋子攻击+80%（3回合） */
    case 'gather_strength':
      {
        const mc=myColor();
        let target=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type!==T.KING){
            if(!target||(p.atk||0)>(target.p.atk||0)) target={r,c,p};
          }
        }
        if(target){
          addBuff(target.p, 'attackBoost', Math.floor((target.p.atk||60)*0.8), 3);
          speakTaunt('少说多做，一击致命。','self');
        } else {
          speakTaunt('无可蓄势之子！','self');
        }
        addBattleLog('skill', '<b>内敛蓄势</b> 己方攻击最高非王棋子攻击+80%（3回合）');
      }
      break;
    /* 张树灿·静水流深：己方全体攻击+20%（3回合）+己方帅护盾90（3回合） */
    case 'still_water':
      {
        const mc=myColor();
        addTeamBuff(state.board, mc, 'attackBoost', 12, 3); /* +20% 约 +12 */
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type===T.KING){
            addBuff(p, 'shield', 90, 3);
            break;
          }
        }
        speakTaunt('静水流深，不动如山。','self');
        addBattleLog('skill', '<b>静水流深</b> 己方全体攻击+20%（3回合）+己方帅护盾90（3回合）');
      }
      break;

    /* 张毓芝·均衡之力：己方全体攻击+15%+防御+15%（2回合） */
    case 'balance':
      addTeamBuff(state.board, myColor(), 'attackBoost', 9, 2); /* +15% 约 +9 */
      addTeamBuff(state.board, myColor(), 'defenseBoost', 6, 2); /* +15% 约 +6 */
      speakTaunt('均衡之道，攻守相宜。','self');
      addBattleLog('skill', '<b>均衡之力</b> 己方全体攻击+15%+防御+15%（2回合）');
      break;
    /* 张毓芝·中庸之道：互换双方强弱子位置+己方连走两步 */
    case 'golden_mean':
      {
        const mc=myColor(), oc=oppColor();
        let pBest=null, aWorst=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(!p) continue;
          if(p.player===mc && p.type!==T.KING){
            if(!pBest || PIECE_VALUE[p.type]>PIECE_VALUE[pBest.p.type]) pBest={r,c,p};
          }
          if(p.player===oc && p.type!==T.KING){
            if(!aWorst || PIECE_VALUE[p.type]<PIECE_VALUE[aWorst.p.type]) aWorst={r,c,p};
          }
        }
        if(pBest && aWorst){
          const tmpB=cloneBoard(state.board);
          const t=tmpB[pBest.r][pBest.c];
          tmpB[pBest.r][pBest.c]=tmpB[aWorst.r][aWorst.c];
          tmpB[aWorst.r][aWorst.c]=t;
          if(kingsFacing(tmpB)||isInCheck(tmpB,mc)){ speakTaunt('中庸之道？时机未到！','self'); break; }
          state.boardSnapshots.push(cloneBoard(state.board));
          if(state.boardSnapshots.length>6) state.boardSnapshots.shift();
          const tmp=state.board[pBest.r][pBest.c];
          state.board[pBest.r][pBest.c]=state.board[aWorst.r][aWorst.c];
          state.board[aWorst.r][aWorst.c]=tmp;
          state.lastMove={from:{r:aWorst.r,c:aWorst.c},to:{r:pBest.r,c:pBest.c}};
          state.moveCount++;
          addHistoryEntry(state.board[pBest.r][pBest.c],{r:aWorst.r,c:aWorst.c},{r:pBest.r,c:pBest.c},null);
          state.extraMove=Math.max(state.extraMove||0, 1); /* 己方连走两步 */
          speakTaunt('不偏不倚，是为中庸。','self');
          addBattleLog('skill', '<b>中庸之道</b> 互换双方强弱子+己方连走两步');
          renderAll();
        } else {
          speakTaunt('无可换之子！','self');
        }
      }
      break;
    /* 张毓芝·稳健布局：己方帅护盾150+己方全体攻击+25%（2回合） */
    case 'steady_layout':
      {
        const mc=myColor();
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type===T.KING){
            addBuff(p, 'shield', 150, 3);
            break;
          }
        }
        addTeamBuff(state.board, mc, 'attackBoost', 15, 2); /* +25% 约 +15 */
        speakTaunt('稳健布局，攻守兼备。','self');
        addBattleLog('skill', '<b>稳健布局</b> 己方帅护盾150+己方全体攻击+25%（2回合）');
      }
      break;

    /* 刘锋·搞子之术：随机交换两颗敌方棋子位置+对方下回合禁吃 */
    case 'trickster':
      {
        const oc=oppColor();
        const cand=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING) cand.push({r,c,p});
        }
        if(cand.length>=2){
          /* 随机选两颗敌方非王棋子互换位置 */
          const i1=Math.floor(Math.random()*cand.length);
          let i2=Math.floor(Math.random()*cand.length);
          while(i2===i1) i2=Math.floor(Math.random()*cand.length);
          const a=cand[i1], b=cand[i2];
          state.boardSnapshots.push(cloneBoard(state.board));
          if(state.boardSnapshots.length>6) state.boardSnapshots.shift();
          const tmp=state.board[a.r][a.c];
          state.board[a.r][a.c]=state.board[b.r][b.c];
          state.board[b.r][b.c]=tmp;
          state.lastMove={from:{r:a.r,c:a.c},to:{r:b.r,c:b.c}};
          state.moveCount++;
          addHistoryEntry(state.board[a.r][a.c],{r:a.r,c:a.c},{r:b.r,c:b.c},null);
          state.oppCannotCapture=true; /* 对方下回合禁吃 */
          speakTaunt('嘿嘿，搞一下子！你的棋子位置本王说了算！','self');
          addBattleLog('skill', '<b>搞子之术</b> 随机交换两颗敌方棋子位置+对方下回合禁吃');
          renderAll();
        } else {
          speakTaunt('敌方棋子不足，搞不了！','self');
        }
      }
      break;
    /* 刘锋·混乱投掷：随机对方一颗非王棋子沉默2回合+该子攻击-30%（1回合） */
    case 'chaos_throw':
      {
        const oc=oppColor();
        const cand=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING) cand.push({r,c,p});
        }
        if(cand.length>0){
          const t=cand[Math.floor(Math.random()*cand.length)];
          addBuff(t.p, 'weakness', 0.3, 1); /* 该子攻击-30%（1回合） */
          speakTaunt('看好了，这叫搞子！','self');
          addBattleLog('skill', '<b>混乱投掷</b> 随机对方棋子攻击-30%（1回合）+沉默2回合');
        } else {
          speakTaunt('无可混乱之敌！','self');
        }
        state.silenceTurns=2; /* 沉默B王2回合 */
        blockOppSkill();
      }
      break;
    /* 刘锋·出其不意：己方一颗棋子瞬移到对方区域任意空位 */
    case 'surprise':
      state.teleportMode=true;
      speakTaunt('出其不意，攻其不备！选一颗己方棋子瞬移！','self');
      addBattleLog('skill', '<b>出其不意</b> 选己方棋子瞬移至空位');
      break;

    /* === v35: 诛仙剑阵·四剑齐出+阵法闭合 === */
    /* 召唤诛仙四剑（诛/戮/陷/绝）占位形成剑阵 + 标记剑下亡魂 + 3回合后闭合引爆
       - 召唤4把剑到空位（突破棋子上限）
       - 剑阵范围内敌方每回合受30真实伤害+禁锢
       - 标记对方价值最高非王棋子为"剑下亡魂"（易伤+50%/禁疗/禁闪/血<50%必斩）
       - 3回合后阵法闭合引爆：造成一次性巨额真实伤害（无视免疫/护盾）*/
    case 'zhuxian':
      {
        const oc=oppColor();
        const mc=myColor();
        const summonCharId=state.gameMode==='pvp'?(state.currentPlayer===RED?state.pvpRedChar:state.pvpBlackChar):state.character;
        /* 1. 召唤诛仙四剑到空位 */
        const swordNames=['诛','戮','陷','绝'];
        const emptyCells=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          if(!state.board[r][c]) emptyCells.push({r,c});
        }
        /* 优先在敌方半区召唤（包围敌方）*/
        const ocHalf = isBottomSide(oc) ? (r=>r>=5) : (r=>r<=4);
        const enemyCells = emptyCells.filter(cell=>ocHalf(cell.r));
        const summonCells = (enemyCells.length>=4 ? enemyCells : emptyCells).slice(0,4);
        const bonus = summonCharId ? getCharBonus(summonCharId) : null;
        const summoned=[];
        for(let i=0;i<summonCells.length;i++){
          const cell=summonCells[i];
          const baseHp=150;
          state.board[cell.r][cell.c]={
            type: T.ROOK, player: mc,  /* 用车作为剑的载体（高价值）*/
            hp: baseHp, maxHp: baseHp,
            atk: 50, def: 30, ptype: 'striker',
            charId: summonCharId,
            heroType: bonus ? bonus.heroType : HERO_TYPE.STRENGTH,
            charAtk: bonus ? bonus.charAtk : 0,
            charDef: bonus ? bonus.charDef : 0,
            charInt: bonus ? bonus.charInt : 0,
            dodgeChance: 0, counterMul: 1.0, atkTrueDmgMul: 0,
            _zhuxianSword: true,          /* 诛仙剑标记 */
            _zhuxianSwordName: swordNames[i],  /* 诛/戮/陷/绝 */
            _zhuxianTurnsLeft: 3,         /* 3回合后闭合引爆 */
            _zhuxianIdx: i
          };
          summoned.push({r:cell.r, c:cell.c, name:swordNames[i]});
        }
        /* 2. 标记对方价值最高非王棋子为"剑下亡魂" */
        let strongest=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING){
            if(!strongest||PIECE_VALUE[p.type]>PIECE_VALUE[strongest.p.type]) strongest={r,c,p};
          }
        }
        if(strongest){
          const tgt=state.board[strongest.r][strongest.c];
          addBuff(tgt, 'zhuxianMark', 0.5, 3);
        }
        /* 3. 敌方全体剑意威压（攻击-20%，1回合）*/
        addTeamBuff(state.board, oc, 'weakness', 0.2, 1);
        /* 4. 注册阵法闭合检查 */
        state.zhuxianFormationActive = true;
        state.zhuxianExecuteCheck = true;
        speakTaunt('诛仙剑阵！四剑齐出！天地色变！尔等已是剑下亡魂！','self');
        let logMsg=`<b>诛仙剑阵·四剑齐出</b> 召唤诛仙四剑（诛/戮/陷/绝）占位形成剑阵`;
        if(strongest){
          logMsg+=`，标记 ${PIECE_CHAR[oc===RED?'red':'black'][strongest.p.type]}（${strongest.r+1}行${strongest.c+1}列）为剑下亡魂`;
        }
        logMsg+=`。剑阵范围内敌方每回合受30真实伤害+禁锢，3回合后阵法闭合引爆`;
        addBattleLog('skill', logMsg);
        if(typeof highlightPieces==='function'){
          const hl=summoned.map(s=>({r:s.r, c:s.c, label:`诛仙·${s.name}剑`, color:'#1a1a2e'}));
          if(strongest) hl.push({r:strongest.r, c:strongest.c, label:'剑下亡魂', color:'#8b0000'});
          highlightPieces(hl, 4000);
        }
        updateCapturedDisplay(); renderAll();
      }
      break;
    /* 万仙阵：召唤4颗"仙兵"棋子到空位（突破规则）+ 己方全体万仙加持
       仙兵被吃时，吃子方受反噬（攻击-30% 1回合）*/
    case 'wanxian':
      {
        const mc=myColor();
        const summonCharId=state.gameMode==='pvp'?(state.currentPlayer===RED?state.pvpRedChar:state.pvpBlackChar):state.character;
        /* 统计空位 */
        const emptyCells=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          if(!state.board[r][c]) emptyCells.push({r,c});
        }
        /* 在己方半区+对方半区交界处优先召唤（接近战场）*/
        emptyCells.sort((a,b)=>{
          const aDist=Math.abs(a.r-5)+Math.abs(a.c-4);
          const bDist=Math.abs(b.r-5)+Math.abs(b.c-4);
          return aDist-bDist;
        });
        const summonCount=Math.min(4, emptyCells.length);
        if(summonCount===0){
          speakTaunt('万仙阵...然棋盘已满，仙兵无处落脚！','self');
          addTeamBuff(state.board, mc, 'wanxianBlessing', 1, 2);
          addBattleLog('skill', '<b>万仙阵</b> 棋盘已满，仅施加万仙加持（攻击+25%·每回合回10%血）');
          renderAll();
          break;
        }
        /* 召唤4颗仙兵（突破棋子上限）*/
        const bonus = summonCharId ? getCharBonus(summonCharId) : null;
        const charAtk = bonus ? bonus.charAtk : 0;
        const charDef = bonus ? bonus.charDef : 0;
        const charInt = bonus ? bonus.charInt : 0;
        const heroType = bonus ? bonus.heroType : HERO_TYPE.STRENGTH;
        const hpMul = bonus ? (bonus.hpMul||1.0) : 1.0;
        for(let i=0;i<summonCount;i++){
          const cell=emptyCells[i];
          const baseHp=Math.floor(80*hpMul);
          state.board[cell.r][cell.c]={
            type: T.PAWN, player: mc,
            hp: baseHp, maxHp: baseHp,
            atk: 40, def: 20, ptype: 'special',
            charId: summonCharId, heroType: heroType,
            charAtk: charAtk, charDef: charDef, charInt: charInt,
            dodgeChance: bonus ? (bonus.dodgeChance||0) : 0,
            counterMul: bonus ? (bonus.counterMul||1.0) : 1.0,
            atkTrueDmgMul: bonus ? (bonus.atkTrueDmgMul||0) : 0,
            /* v34 仙兵专属标识 */
            _immortalSoldier: true,
            _immortalTurnsLeft: 3  /* 3 回合后消散 */
          };
        }
        /* 己方全体万仙加持（攻击+25% + 每回合回10%血，2回合）*/
        addTeamBuff(state.board, mc, 'wanxianBlessing', 1, 2);
        speakTaunt(`万仙阵成！${summonCount} 仙兵降临，群仙共斩！`,'self');
        addBattleLog('skill', `<b>万仙阵</b> 召唤 ${summonCount} 颗仙兵（突破规则）+ 己方全体万仙加持（攻击+25%·每回合回10%血，2回合）。仙兵被吃时吃子方受反噬`);
        /* 棋盘高亮所有召唤位置 */
        if(typeof highlightPieces==='function'){
          const hl=[];
          for(let i=0;i<summonCount;i++){
            const cell=emptyCells[i];
            hl.push({r:cell.r, c:cell.c, label:'仙兵', color:'#1a1a2e'});
          }
          highlightPieces(hl, 4000);
        }
        updateCapturedDisplay(); renderAll();
      }
      break;
    /* 紫霄神威：敌方全体禁锢2回合+防御-50%（2回合）+被动失效2回合+己方连走3步 */
    case 'tongtian':
      {
        const oc=oppColor();
        /* 敌方全体禁锢2回合 + 防御-50%（2回合）*/
        addTeamBuff(state.board, oc, 'lock', 1, 2);
        addTeamBuff(state.board, oc, 'defReduce', 0.5, 2);
        /* 敌方被动失效2回合 */
        state.oppPassiveDisabled=2;
        /* 己方下回合连走3步 = 1正常 + 2额外（v39 修复 P1 bug: 原 extraMove=3 实际给4步）*/
        state.extraMove=2;
        speakTaunt('紫霄神威！镇压万古！禁锢！夺势！三步连行！','self');
        addBattleLog('skill', '<b>紫霄神威</b> 敌方全体禁锢2回合+防御-50%（2回合）+被动失效2回合+己方连走3步');
        renderAll();
      }
      break;

    default:
      /* 未知技能 ID：提示并安全退出 */
      speakTaunt('技能未实现：'+(activeSkill?activeSkill.name:sid),'self');
      break;
  }

  // 技能冷却：重置计数并锁定生效回合（生效回合不解冷却）
  /* v22 修复 Bug 1：提取为 resetSkillCooldown()，case 内 return 改为 break 后
     此处统一重置 CD；retreat/selfreverse 的"无步可退"return 跳过此处（免费重试）。 */
  resetSkillCooldown();
  updateSkillDisplay(); updateCapturedDisplay(); renderAll();

  // 偷天换日：撤销B王后B王重走
  /* v22 修复：PVP 下黑方用 rewind 时 currentPlayer===aiColor（BLACK===BLACK）为 true，
     会错误触发 aiMove 替黑方走棋。PVP 下不应调用 aiMove，仅 PVE/三英模式下需要。 */
  if(sid==='rewind'&&state.currentPlayer===state.aiColor&&!state.gameOver
     &&(state.gameMode==='pve'||state.gameMode==='three')){
    setTimeout(()=>aiMove(),500);
  }
  // 仙帝威压：显示走法后轮到B王弃子
  if(sid==='awe'&&!state.gameOver){
    updateTurnIndicator();
  }
}

function maybeAISkill(){
  const diff=DIFFICULTIES[state.difficulty];
  // 被破妄之眼沉默时无法释放技能
  if(state.aiSkillBlocked||state.silenceTurns>0){ return false; }
  // v28: 故事模式 — 从 BKING_LAYERS 读取 skillChance 和可用主动技能池
  let chance, pool;
  if(state.storyChapterId && state.bkingLayer && typeof BKING_LAYERS!=='undefined'){
    const layer=BKING_LAYERS[state.bkingLayer];
    if(layer){
      chance=layer.skillChance;
      pool=layer.actives.slice();
    }
  }
  /* v31-fix P1: 三英战B王 — 读取 THREE_HEROES_BKING.skillChance（原为死代码，0.85 实际未生效） */
  if(state.gameMode==='three' && typeof THREE_HEROES_BKING!=='undefined'){
    chance = THREE_HEROES_BKING.skillChance;
    pool = (THREE_HEROES_BKING.actives && THREE_HEROES_BKING.actives.slice()) || pool;
  }
  // 概率：优先用 data.js 中的 skillChance，回退到旧逻辑
  /* v16: 应用仙帝威压/三英B王光环对释放概率的修正 */
  if(chance===undefined) chance=diff.skillChance!==undefined?diff.skillChance:(state.difficulty==='easy'?0.4:state.difficulty==='medium'?0.5:0.6);
  chance -= (state.bkingSkillChanceReduce||0);
  chance = Math.max(0.05, Math.min(0.95, chance));
  if(Math.random()>=chance){ return false; }
  speakTaunt(pick(diff.skillLines));
  // 轮换技能：若 data.js 定义了 skills 数组则轮换，否则用单一 skill
  /* v30-fix: 故事模式从 BKING_LAYERS 拿到的是 actives（含完整 name/desc 的对象数组），
     而非 ID 数组。统一兼容两种格式：字符串( ID ) 或对象(含 id/name/desc )。
     战报查找 _skillInfo 时优先在 diff.skills/BKING_LAYERS 池/CHARACTERS.bking.skills 中查找，
     避免回退到英文 skillId（导致界面显示"莫名其妙的英文"）。 */
  let skillId, _skillInfo=null;
  if(pool && pool.length>0){
    const pickItem = pool[Math.floor(Math.random()*pool.length)];
    if(typeof pickItem === 'string'){
      skillId = pickItem;
    } else {
      skillId = pickItem.id;
      _skillInfo = pickItem;
    }
  } else {
    /* 兜底：diff.skills / diff.skill */
    if(diff.skills && diff.skills.length>0){
      _skillInfo = diff.skills[Math.floor(Math.random()*diff.skills.length)];
      skillId = _skillInfo.id;
    } else {
      skillId = diff.skill.id;
      _skillInfo = diff.skill;
    }
  }
  /* 若仍未找到 _skillInfo（pool 是 ID 数组的情况），在 diff.skills / CHARACTERS.bking.skills 中查找 */
  if(!_skillInfo){
    if(diff.skills && diff.skills.length>0){
      _skillInfo = diff.skills.find(s=>s.id===skillId);
    }
    if(!_skillInfo && typeof CHARACTERS!=='undefined' && CHARACTERS.bking){
      _skillInfo = (CHARACTERS.bking.skills||CHARACTERS.bking.actives||[]).find(s=>s.id===skillId);
    }
  }
  const _skillLabel = _skillInfo ? (_skillInfo.name || skillId) : skillId;
  addBattleLog('skill', `<b>B王</b>(${diff.name}) 释放 <b>${_skillLabel}</b>`);
  switch(skillId){
    /* ===== v30: B王七宗罪技能 AI 释放（AI 自动选目标） =====
       注：mock/reverse/confuse/foresight/seize/swap/domain/selfreverse
       均为 v30 前的旧 B王技能，已统一替换为七宗罪体系（arrogance/greedy/sloth/envy/wrath/gluttony/lust）。 */
    case 'arrogance': {
      /* 傲慢：对方全体棋子攻击-25%（1回合）+ B王攻击最高棋子下次攻击+30% */
      const oc=state.playerColor, ac=state.aiColor;
      addTeamBuff(state.board, oc, 'weakness', 0.25, 1);
      let target=null, maxAtk=-1;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const p=state.board[r][c];
        if(p&&p.player===ac&&p.type!==T.KING){
          const atk=(p.atk||0)+Math.floor((p.charAtk||0)/10);
          if(atk>maxAtk){ maxAtk=atk; target=p; }
        }
      }
      if(target) addBuff(target, 'attackBoost', Math.floor(maxAtk*0.3), 2);
      speakTaunt('傲慢！本王就是天！你们这群凡人不配直视！','opp');
      addBattleLog('skill', '<b>傲慢·目中无人</b> 对方全体棋子攻击-25% + B王强子下次攻击+30%');
      renderAll();
      break;
    }
    case 'envy': {
      /* 嫉妒：复制对方被动技能给己方全体棋子（3回合）+ 让对方失去该被动 */
      /* v30-fix: 使用 getPassiveForColor 获取对方实际选中的被动技能 */
      let oppPassiveId = null;
      if(typeof getPassiveForColor === 'function'){
        const oppPassive = getPassiveForColor(state.playerColor);
        if(oppPassive && oppPassive.id) oppPassiveId = oppPassive.id;
      }
      if(!oppPassiveId && state.playerPassiveSkill) oppPassiveId = state.playerPassiveSkill.id;
      if(!oppPassiveId && (state.gameMode==='pvp'||state.gameMode==='online')){
        if(state.playerColor===RED && state.pvpRedPassive) oppPassiveId = state.pvpRedPassive.id;
        else if(state.playerColor===BLACK && state.pvpBlackPassive) oppPassiveId = state.pvpBlackPassive.id;
      }
      if(oppPassiveId){
        if(!state.envyStolenPassives) state.envyStolenPassives=[];
        state.envyStolenPassives.push({ id: oppPassiveId, remainingTurns: 3, stolenFrom: state.playerColor });
        state.oppPassiveDisabled=3;
        speakTaunt('嫉妒？本王只是借来用用！你的本事？现在是我的了！','opp');
        addBattleLog('skill', '<b>嫉妒·东施效颦</b> 复制对方被动（3回合）+对方失去该被动');
        if(typeof showProcNotice==='function') showProcNotice('嫉妒·东施效颦！', 'B王复制了对方被动技能', 'proc');
      } else {
        addTeamBuff(state.board, state.aiColor, 'attackBoost', 20, 3);
        speakTaunt('嫉妒？本王只是借来用用！','opp');
        addBattleLog('skill', '<b>嫉妒·东施效颦</b> 无对方被动可偷，退化为己方全体棋子攻击+20（3回合）');
      }
      break;
    }
    case 'wrath': {
      /* 暴怒：B王全体棋子攻击+50% + 防御-30% + 攻击附带20真伤（3回合） */
      const ac=state.aiColor;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const p=state.board[r][c];
        if(p&&p.player===ac){
          addBuff(p, 'attackBoost', Math.floor((p.atk||0)*0.5), 3);
          addBuff(p, 'defReduce', 0.3, 3);
          addBuff(p, 'trueDmgBoost', 20, 3);
        }
      }
      speakTaunt('暴怒！本王要毁了一切！怒火中烧，你承受不住！','opp');
      addBattleLog('skill', '<b>暴怒·怒火中烧</b> B王全体棋子攻击+50%+防御-30%+20真伤（3回合）');
      renderAll();
      break;
    }
    case 'sloth': {
      /* 懒惰：对方全体棋子2回合内移动距离≤1格 + 攻击-20%（1回合） */
      addTeamBuff(state.board, state.playerColor, 'weakness', 0.2, 1);
      state.oppSlowTurns=2;
      speakTaunt('懒惰？这叫以逸待劳！急什么？慢慢来！','opp');
      addBattleLog('skill', '<b>懒惰·拖泥带水</b> 对方全体棋子移动≤1格（2回合）+攻击-20%（1回合）');
      break;
    }
    case 'greedy': {
      /* 贪婪：窃取对方一颗棋子的永久buff给己方对应棋子 + B王的帅回复30%最大HP */
      const oc=state.playerColor, ac=state.aiColor;
      let stolen=false;
      for(let r=0;r<ROWS && !stolen;r++) for(let c=0;c<COLS && !stolen;c++){
        const p=state.board[r][c];
        if(p&&p.player===oc&&p.buffs&&p.buffs.length>0){
          /* 找永久buff */
          const permIdx = p.buffs.findIndex(b => b.duration<0 || b.duration>=99);
          if(permIdx>=0){
            const buff=p.buffs.splice(permIdx,1)[0];
            /* 给己方对应位置的棋子 */
            const mirrorR = ROWS-1-r, mirrorC = COLS-1-c;
            const target = state.board[mirrorR] && state.board[mirrorR][mirrorC];
            if(target && target.player===ac){
              if(!target.buffs) target.buffs=[];
              target.buffs.push({...buff});
            }
            stolen=true;
          }
        }
      }
      /* B王的帅回复30%HP */
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const p=state.board[r][c];
        if(p&&p.player===ac&&p.type===T.KING){
          p.hp = Math.min(p.maxHp||p.hp, p.hp + Math.floor((p.maxHp||p.hp)*0.3));
          break;
        }
      }
      speakTaunt('贪婪！这子归本王了！你的buff？现在是我的了！','opp');
      addBattleLog('skill', '<b>贪婪·夺人所爱</b> 窃取对方永久buff+B王的帅回血30%');
      renderAll();
      break;
    }
    case 'gluttony': {
      /* 暴食：吞噬己方一颗非王棋子，B王的帅获得其50%HP和攻击 + 下次攻击+40% */
      const ac=state.aiColor;
      let target=null, maxAtk=-1;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const p=state.board[r][c];
        if(p&&p.player===ac&&p.type!==T.KING){
          const atk=(p.atk||0)+Math.floor((p.charAtk||0)/10);
          if(atk>maxAtk){ maxAtk=atk; target={r,c,p}; }
        }
      }
      if(target){
        const eaten=target.p;
        const hpGain=Math.floor((eaten.maxHp||0)*0.5);
        const atkGain=Math.floor(((eaten.atk||0)+Math.floor((eaten.charAtk||0)/10))*0.5);
        state.board[target.r][target.c]=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===ac&&p.type===T.KING){
            p.maxHp=(p.maxHp||p.hp)+hpGain;
            p.hp=Math.min(p.maxHp, p.hp+hpGain);
            addBuff(p, 'attackBoost', atkGain+Math.floor((p.atk||0)*0.4), 2);
            break;
          }
        }
        if(ac===RED&&state.redCaptured) state.redCaptured.push(eaten);
        else if(ac===BLACK&&state.blackCaptured) state.blackCaptured.push(eaten);
        speakTaunt('暴食！吞噬一切！你的力量，本王收下了！','opp');
        addBattleLog('skill', '<b>暴食·吞噬同袍</b> 吞噬己方1子+帅获得其50%属性+下次攻击+40%');
        if(typeof showProcNotice==='function') showProcNotice('暴食·吞噬同袍！', 'B王吞噬己方棋子获得属性', 'proc');
        renderAll(); updateCapturedDisplay();
      } else {
        addBattleLog('skill', '<b>暴食·吞噬同袍</b> 无可吞噬棋子，技能失效');
      }
      break;
    }
    case 'lust': {
      /* 色欲：诱惑对方一颗非王棋子倒戈1回合 + 该子攻击-30% */
      const oc=state.playerColor, ac=state.aiColor;
      let target=null, maxAtk=-1;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const p=state.board[r][c];
        if(p&&p.player===oc&&p.type!==T.KING){
          const atk=(p.atk||0)+Math.floor((p.charAtk||0)/10);
          if(atk>maxAtk){ maxAtk=atk; target={r,c,p}; }
        }
      }
      if(target){
        target.p._originalPlayer=target.p.player;
        target.p.player=ac;
        target.p._lustControlled=true;
        target.p._lustControlTurns=2;
        addBuff(target.p, 'weakness', 0.3, 2);
        if(!state.lustControlledPieces) state.lustControlledPieces=[];
        state.lustControlledPieces.push({r:target.r,c:target.c,piece:target.p});
        speakTaunt('色欲！让本王看看你的忠心！倒戈吧！','opp');
        addBattleLog('skill', '<b>色欲·魅惑人心</b> 诱惑对方1子倒戈1回合+该子攻击-30%');
        if(typeof showProcNotice==='function') showProcNotice('色欲·魅惑人心！', '对方棋子倒戈1回合', 'proc');
        renderAll();
      } else {
        addBattleLog('skill', '<b>色欲·魅惑人心</b> 无可诱惑棋子，技能失效');
      }
      break;
    }
    /* v30-fix P1-3: 默认分支 — 旧 B王技能 ID（mock/reverse/confuse/foresight/seize/swap/domain/selfreverse）
       在 v30 重构中已被替换为七宗罪体系。若配置数据未完全迁移或自定义层引入了未知 ID，
       原代码静默 fall-through 会让 B王 永不释放技能且无报错日志。
       现记录警告，便于排查。 */
    default:
      addBattleLog('skill', `<b>B王</b> 未知技能 ID: ${skillId}（请检查 BKING_LAYERS 配置）`);
      console.warn('[maybeAISkill] 未知 B王技能 ID:', skillId);
      break;
  }
  state.roundsSinceAISkill=0; state.aiSkillLock=true;
  updateSkillDisplay();
  return false;
}

/* ===== UI ===== */
function updateTurnIndicator(){
  /* v22 修复：原 #turn-indicator 在状态栏重构时被改名为 #top-turn-indicator，
     旧代码 ti.querySelector 在 null 上抛 TypeError，导致 startNewGame 中断无法进入对局。
     现兼容两个 ID（优先旧，回退新），并对 null 安全处理。
     v10: 与 renderHUD 顶部栏一致，显示回合数 + 角色，保持两处调用结果统一。 */
  const ti=document.getElementById('turn-indicator')||document.getElementById('top-turn-indicator');
  if(!ti) return;
  const t=ti.querySelector('.turn-text');
  if(!t) return;
  if(state.gameOver){ t.textContent='对局结束'; return; }
  if(state.aiThinking){ t.textContent='B王思考中'; return; }
  const round = state.moveCount || 0;
  const roundLabel = `第${Math.ceil(round/2)+1}回合`;
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    const char=getCurrentChar();
    if(state.currentPlayer===RED){ ti.classList.remove('black'); t.textContent=`${roundLabel} · 红方·${char?char.name:'?'}行棋`; }
    else{ ti.classList.add('black'); t.textContent=`${roundLabel} · 黑方·${char?char.name:'?'}行棋`; }
  } else if(state.gameMode==='faction'||state.gameMode==='4v4'){
    /* v5.0 多阵营：显示"颜色·角色名 行棋" */
    const char=getCurrentChar();
    const colorLabel=colorDisplayName(state.currentPlayer);
    ti.classList.toggle('black', state.currentPlayer===BLACK||state.currentPlayer===GREEN);
    t.textContent=`${roundLabel} · ${colorLabel}·${char?char.name:'?'}行棋`;
  } else {
    if(state.currentPlayer===state.playerColor){ ti.classList.remove('black'); t.textContent=`${roundLabel} · 你的回合`; }
    else{ ti.classList.add('black'); t.textContent=`${roundLabel} · B王回合`; }
  }
}
/* 颜色 → 中文显示名（多阵营UI用） */
function colorDisplayName(c){
  return c===RED?'红方':c===BLACK?'黑方':c===BLUE?'蓝方':c===GREEN?'绿方':'?方';
}
/* v5.0 多阵营：把被吃的棋子放入对应"半区"的被吃列表
   red/blue 都放 redCaptured；black/green 都放 blackCaptured
   这样既兼容旧 2 玩家渲染逻辑，又让多阵营共用一套显示容器。 */
function pushCaptured(piece){
  if(!piece) return;
  /* v35-fix P2-Bug5: 临时召唤棋子（诛仙剑/仙兵）不入阵亡名单，避免误导玩家 */
  if(piece._zhuxianSword || piece._immortalSoldier) return;
  if(isBottomSide(piece.player)) state.redCaptured.push(piece);
  else state.blackCaptured.push(piece);
}
function updateCapturedDisplay(){
  /* v5.0 多阵营：按棋子 player 颜色取对应配色与字符 */
  const capHtml=arr=>arr.map(p=>{
    const color=COLOR_PIECE_COLOR[p.player]||'#888';
    const chars=PIECE_CHAR[p.player]||PIECE_CHAR.red;
    return `<span class="cap-piece" style="color:${color}">${chars[p.type]}</span>`;
  }).join('');
  document.getElementById('red-captured').innerHTML=capHtml(state.redCaptured);
  document.getElementById('black-captured').innerHTML=capHtml(state.blackCaptured);
}
function updateSkillDisplay(){
  const char=getCurrentChar();
  /* v10: 显示选将面板选中的技能，而非默认技能 */
  const activeSkill=getActiveSkillForCurrentPlayer();
  const sk=activeSkill||char.skill;
  document.getElementById('skill-name').textContent=sk.name;
  document.getElementById('skill-desc').textContent=sk.desc;
  const btn=document.getElementById('btn-skill');
  const cdText=document.getElementById('skill-cd-text');
  /* v5.0 多阵营/4v4：禁用主动技能 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    btn.disabled=true;
    cdText.textContent='多阵营模式禁用';
    btn.classList.remove('active');
    renderThreeHeroesPanel();
    return;
  }
  let cdLeft;
  let threshold; /* v10: 提升到外层，供 CD 进度条计算使用 */
  if(state.gameMode==='three'){
    /* v19: 读取选中技能实际 CD，不再硬编码 3 */
    const baseCd=(sk&&sk.cd)||3;
    /* v10: 谋属性 CD 减少 */
    const intCdReduce=getIntCdReduction(getCurrentCharId());
    /* v30-fix P2-3: 补减 heroCdReduce（canUseSkill line 2481 已包含，
       updateSkillDisplay 漏减导致三英模式 CD 显示比实际多 1 回合） */
    const heroCdReduce=(getCharBonus(getCurrentCharId()).cdReduce)||0;
    threshold=Math.max(1, baseCd + (state.bkingCdIncrease||0) - (state.skillCdReduce||0) - intCdReduce - heroCdReduce);
    cdLeft=Math.max(0,threshold-(state.threeHeroCDs[state.threeHeroIndex]||0));
  } else {
    /* v16: CD 与 canUseSkill 同步，按选中技能 cd 计算
       v22 修复：PVP/online 下 bkingCdIncrease 不影响 CD（无 B王） */
    const baseCd=(sk&&sk.cd)||3;
    const bkingAdj = (state.gameMode==='pvp'||state.gameMode==='online') ? 0 : (state.bkingCdIncrease||0);
    /* v10: 谋属性 CD 减少 */
    const intCdReduce=getIntCdReduction(getCurrentCharId());
    /* v30-fix P2-3: 补减 heroCdReduce，与 canUseSkill 保持一致 */
    const heroCdReduce=(getCharBonus(getCurrentCharId()).cdReduce)||0;
    threshold=Math.max(1, baseCd + bkingAdj - (state.skillCdReduce||0) - intCdReduce - heroCdReduce);
    const counter = (state.gameMode==='pvp'||state.gameMode==='online')
      ? (state.currentPlayer===RED?state.roundsSincePlayerSkill:state.roundsSinceP2Skill)
      : state.roundsSincePlayerSkill;
    cdLeft=Math.max(0, threshold-counter);
  }
  if(cdLeft===0){ btn.disabled=false; cdText.textContent='就绪'; }
  else{ btn.disabled=true; cdText.textContent=`冷却 ${cdLeft}`; }
  /* v10: 技能 CD 可视化进度条（底部细条，已冷却比例填充） */
  let progBar = btn.querySelector('.skill-btn-cd-progress');
  if(!progBar){
    progBar = document.createElement('span');
    progBar.className = 'skill-btn-cd-progress';
    btn.appendChild(progBar);
  }
  const cdPercent = cdLeft===0 ? 100 : Math.max(0, (1 - cdLeft/threshold) * 100);
  progBar.style.width = cdPercent + '%';
  /* v17: PVP 被封锁（沉默）时禁用技能按钮并提示 */
  if((state.gameMode==='pvp'||state.gameMode==='online')
     &&state.oppSkillBlockedColor===state.currentPlayer&&state.silenceTurns>0){
    btn.disabled=true;
    cdText.textContent=`沉默 ${state.silenceTurns}回`;
  }
  if(state.swapMode||state.skillActive==='ironwall'||state.skillActive==='debug-mark'||state.skillActive==='execute-mark'||state.skillActive==='mark-target'||state.skillActive==='pierce-target'||state.teleportMode||state.disguiseMode){ btn.disabled=false; btn.classList.add('active');
    /* v21: 区分目标方向（己方/敌方），玩家一眼看清该选谁 */
    if(state.skillActive==='debug-mark'||state.skillActive==='execute-mark') cdText.textContent='选己方';
    else if(state.skillActive==='mark-target'||state.skillActive==='pierce-target') cdText.textContent='选敌方';
    else cdText.textContent='选棋子';
  }
  else btn.classList.remove('active');
  // 三英战B王：渲染武将面板
  renderThreeHeroesPanel();

  if(state.gameMode==='pvp'){
    /* v11: 显示对方选中的主动技能（非默认 skill） */
    const oppActiveSkill = state.currentPlayer===RED ? state.pvpBlackActiveSkill : state.pvpRedActiveSkill;
    const p2Char=state.currentPlayer===RED?CHARACTERS[state.pvpBlackChar]:CHARACTERS[state.pvpRedChar];
    const oppSkill = oppActiveSkill || p2Char.skill;
    /* v22 修复：原 #ai-skill-name / #ai-skill-dots 在状态栏重构时被移除
       （由 renderOppSkillPool 渲染左侧 B王技能池替代），null 引用导致 startNewGame 中断。
       现对 null 安全处理，并刷新技能池面板。 */
    const aiSkillNameEl=document.getElementById('ai-skill-name');
    if(aiSkillNameEl) aiSkillNameEl.textContent=oppSkill.name;
    const dotsEl=document.getElementById('ai-skill-dots');
    if(dotsEl){
      /* v16: 圆点数 = 对方技能 cd，与玩家侧 CD 逻辑一致 */
      const oppCd=(oppSkill&&oppSkill.cd)||3;
      const oppCounter = state.currentPlayer===RED ? state.roundsSinceP2Skill : state.roundsSincePlayerSkill;
      const p2CDLeft=Math.max(0, oppCd-oppCounter);
      let html='';
      for(let i=0;i<oppCd;i++) html+=`<div class="scd-dot ${i<(oppCd-p2CDLeft)?'filled':''}"></div>`;
      dotsEl.innerHTML=html;
    }
    /* v22: 刷新左侧 B王技能池面板（renderOppSkillPool 内部已 null 安全） */
    if(typeof renderOppSkillPool==='function') renderOppSkillPool();
  } else {
    const diff=DIFFICULTIES[state.difficulty];
    /* v22: 同上 null 安全处理 */
    const aiSkillNameEl=document.getElementById('ai-skill-name');
    if(aiSkillNameEl && diff && diff.skill) aiSkillNameEl.textContent=diff.skill.name;
    const dotsEl=document.getElementById('ai-skill-dots');
    if(dotsEl){
      const aiCDLeft=Math.max(0,3-state.roundsSinceAISkill);
      let html='';
      for(let i=0;i<3;i++) html+=`<div class="scd-dot ${i<(3-aiCDLeft)?'filled':''}"></div>`;
      dotsEl.innerHTML=html;
    }
    /* v22: 刷新左侧 B王技能池面板 */
    if(typeof renderOppSkillPool==='function') renderOppSkillPool();
  }
  /* v23: 刷新黑方技能释放面板（PVP 模式专用） */
  if(typeof updateOppSkillPanel==='function') updateOppSkillPanel();
}
/* v23: 更新黑方技能释放面板（左侧 sidebar，PVP 模式下显示）
   - PVP/online 模式：显示黑方玩家选中的主动技能 + CD 状态 + 释放按钮
   - 其他模式：隐藏（PVE 下黑方为 AI，技能由 AI 自动释放） */
function updateOppSkillPanel(){
  const panel=document.getElementById('opp-skill-panel');
  if(!panel) return;
  const isPvp = state.gameMode==='pvp'||state.gameMode==='online';
  if(!isPvp){ panel.style.display='none'; return; }
  panel.style.display='block';
  const blackChar = (typeof CHARACTERS!=='undefined' && state.pvpBlackChar && CHARACTERS[state.pvpBlackChar]) ? CHARACTERS[state.pvpBlackChar] : null;
  if(!blackChar){ panel.style.display='none'; return; }
  const sk = state.pvpBlackActiveSkill || blackChar.skill;
  const nameEl=document.getElementById('opp-skill-name');
  const descEl=document.getElementById('opp-skill-desc');
  const btn=document.getElementById('btn-opp-skill');
  const cdText=document.getElementById('opp-skill-cd-text');
  if(nameEl) nameEl.textContent = sk ? sk.name : '奇术';
  if(descEl) descEl.textContent = sk ? sk.desc : '';
  if(!btn||!cdText) return;
  /* CD 计算：始终基于黑方（BLACK）的 counter（roundsSinceP2Skill） */
  const baseCd=(sk&&sk.cd)||3;
  const threshold=Math.max(1, baseCd - (state.skillCdReduce||0));
  const cdLeft=Math.max(0, threshold-(state.roundsSinceP2Skill||0));
  /* 沉默检查：黑方被封锁时禁用 */
  const silenced = state.oppSkillBlockedColor===BLACK && (state.silenceTurns||0)>0;
  /* 仅黑方回合且非动画/思考/技能激活中可点击 */
  const isBlackTurn = state.currentPlayer===BLACK;
  const busy = state.aiThinking||state.animating||state.swapMode||state.disguiseMode||state.teleportMode||state.forcedMovePending||state.skillActive==='ironwall';
  if(silenced){
    btn.disabled=true;
    cdText.textContent=`沉默 ${state.silenceTurns}回`;
    btn.classList.remove('active');
  } else if(cdLeft>0){
    btn.disabled=true;
    cdText.textContent=`冷却 ${cdLeft}`;
    btn.classList.remove('active');
  } else if(!isBlackTurn||busy){
    btn.disabled=true;
    cdText.textContent = isBlackTurn ? '选棋子' : '非黑方回合';
    /* 技能激活态：黑方回合且正在选目标时，按钮高亮 */
    if(isBlackTurn && (state.skillActive==='ironwall'||state.skillActive==='debug-mark'||state.skillActive==='execute-mark'||state.skillActive==='mark-target'||state.skillActive==='pierce-target'||state.teleportMode||state.disguiseMode)){
      btn.classList.add('active');
      if(state.skillActive==='debug-mark'||state.skillActive==='execute-mark') cdText.textContent='选己方';
      else if(state.skillActive==='mark-target'||state.skillActive==='pierce-target') cdText.textContent='选敌方';
      else cdText.textContent='选棋子';
    } else {
      btn.classList.remove('active');
    }
  } else {
    btn.disabled=false;
    cdText.textContent='就绪';
    btn.classList.remove('active');
  }
}
/* 三英战B王：渲染武将轮换面板 */
function renderThreeHeroesPanel(){
  const panel=document.getElementById('three-heroes-panel');
  if(!panel) return;
  if(state.gameMode!=='three'){ panel.style.display='none'; return; }
  panel.style.display='block';
  const heroes=state.threeHeroes;
  if(heroes.length===0){ panel.style.display='none'; return; }
  const activeIdx=state.threeHeroIndex;
  const activeChar=CHARACTERS[heroes[activeIdx]];
  document.getElementById('th-active-name').textContent=activeChar?activeChar.name:'—';
  const wrap=document.getElementById('th-heroes');
  wrap.innerHTML=heroes.map((id,i)=>{
    const ch=CHARACTERS[id]; if(!ch) return '';
    const isActive=i===activeIdx;
    const cd=state.threeHeroCDs[i]||0;
    const ready=cd>=3;
    return `<div class="th-hero ${isActive?'active':''}" data-idx="${i}" title="${ch.skill.name}">
      <div class="th-hero-char" style="background:${ch.color}">${ch.char}</div>
      <div class="th-hero-name">${ch.name}</div>
      <div class="th-hero-cd ${ready?'ready':'cd'}">${ready?'就绪':'冷'+(3-cd)}</div>
    </div>`;
  }).join('');
  /* v18: 三英模式改为自动轮换 — 武将卡片仅展示，不再允许手动点击切换
     顺序提示：下一位将出场 */
  const switchBtn=document.getElementById('btn-th-switch');
  if(switchBtn){
    const nextIdx=(activeIdx+1)%heroes.length;
    const nextCh=CHARACTERS[heroes[nextIdx]];
    switchBtn.textContent='自动轮换 · 下一位：'+(nextCh?nextCh.name:'—');
    switchBtn.disabled=true;
    switchBtn.style.opacity='0.6';
    switchBtn.style.cursor='default';
  }
}
/* 切换三英中的当前武将（不耗回合） */
function switchThreeHero(idx){
  if(state.gameMode!=='three') return;
  if(state.aiThinking||state.animating) return;
  if(state.currentPlayer!==state.playerColor) return;
  if(idx===state.threeHeroIndex) return;
  if(idx<0||idx>=state.threeHeroes.length) return;
  switchThreeHeroAuto(idx);
}
/* v17: 三英自动轮换 — 无条件切换（由 doMove 回合结束触发）
   切换时同步武将的主动/被动技能，buff 随之改变 */
function switchThreeHeroAuto(idx){
  if(state.gameMode!=='three') return;
  if(idx<0||idx>=state.threeHeroes.length) return;
  if(idx===state.threeHeroIndex) return;
  /* v10 修复：切换武将前清理所有 _aura buff，避免旧武将的光环在失效后仍永久保留。
     新武将的 passivesOnTurnStart 会重新施加光环。 */
  if(state.board){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const p = state.board[r][c];
      if(p && p.buffs){
        p.buffs = p.buffs.filter(b => !b._aura);
        if(p.buffs.length === 0) delete p.buffs;
      }
    }
  }
  state.threeHeroIndex=idx;
  state.character=state.threeHeroes[idx];
  /* v11: 切换武将时同步切换选中的主动/被动技能 */
  if(state.threeHeroSkills && state.threeHeroSkills[idx]){
    state.playerActiveSkill=state.threeHeroSkills[idx].active;
    state.playerPassiveSkill=state.threeHeroSkills[idx].passive;
  }
  // 更新玩家头像与技能显示
  const ch=CHARACTERS[state.character];
  document.getElementById('player-avatar-char').textContent=ch.char;
  document.getElementById('player-name').textContent=ch.name;
  document.getElementById('player-style').textContent=ch.title;
  const av=document.getElementById('player-avatar');
  if(av){ av.style.borderColor=ch.color; av.style.boxShadow=`0 0 16px ${ch.glow}`; setAvatarPortrait(av, state.character); }
  updateSkillDisplay();
  renderHUD();
  speakTaunt(pick(ch.skillLines),'self');
}
function showThinking(s){ document.getElementById('thinking-overlay').classList.toggle('show',s); }
function showCheckWarning(){ document.getElementById('check-warning').classList.add('show'); }
function hideCheckWarning(){ document.getElementById('check-warning').classList.remove('show'); }

let speechTimer=null, playerSpeechTimer=null;
/* side: 'opp' 对方说话, 'self' 我方说话 */
/* ===== v22 战斗日志系统 =====
   addBattleLog(type, text, opts)
   type: 'move'|'capture'|'skill'|'passive'|'buff'|'state'|'system'
   text: 显示文本（可含 <b> 标签强调）
   opts: { tag, silent }
     - tag: 自定义标签文本（默认按 type 取中文）
     - silent: true 时不重复调用 speakTaunt（避免双重气泡）
   日志按事件发生顺序追加，最近的事件显示在面板顶部。 */
const BATTLE_LOG_TAG = {
  move:'走子', capture:'吃子', skill:'奇术', passive:'被动',
  buff:'状态', state:'限制', system:'系统'
};
function addBattleLog(type, text, opts){
  if(!state.battleLog) state.battleLog = [];
  const o = opts || {};
  const tag = o.tag || BATTLE_LOG_TAG[type] || type;
  const turn = state.moveCount || 0;
  const side = state.currentPlayer === RED ? '红' : '黑';
  const entry = {
    type, tag, text, turn,
    side,
    time: new Date().toLocaleTimeString('zh-CN', {hour12:false}).slice(3) /* HH:MM:SS 截到分钟 */
  };
  state.battleLog.unshift(entry);
  /* 上限 200 条，避免无限增长 */
  if(state.battleLog.length > 200) state.battleLog.length = 200;
  renderBattleLog();
}
function renderBattleLog(){
  const body = document.getElementById('battle-log-body');
  if(!body) return;
  if(!state.battleLog || state.battleLog.length === 0){
    body.innerHTML = '<div class="battle-log-empty">— 战斗事件将显示于此 —</div>';
    return;
  }
  /* 只渲染最近 50 条，避免 DOM 过重 */
  const items = state.battleLog.slice(0, 50);
  body.innerHTML = items.map(e => `
    <div class="log-entry log-${e.type}">
      <span class="log-time">${e.time}</span>
      <span class="log-tag">${e.tag}</span>
      <span class="log-text">${e.text}</span>
    </div>`).join('');
}
function clearBattleLog(){
  state.battleLog = [];
  renderBattleLog();
}
function toggleBattleLogPanel(){
  const panel = document.getElementById('battle-log-panel');
  const toggle = document.getElementById('btn-battle-log-toggle');
  if(!panel) return;
  panel.classList.toggle('collapsed');
  if(toggle){
    if(panel.classList.contains('collapsed')){
      toggle.classList.add('show');
    } else {
      toggle.classList.remove('show');
    }
  }
}
/* 在屏幕切换时显示/隐藏战报按钮 */
function showBattleLogToggle(show){
  const toggle = document.getElementById('btn-battle-log-toggle');
  if(!toggle) return;
  if(show) toggle.classList.add('show'); else toggle.classList.remove('show');
}

/* v30: 概率触发提示样式（动态注入，避免修改 style.css） */
if(!document.getElementById('proc-notice-style')){
  const __procStyle=document.createElement('style');
  __procStyle.id='proc-notice-style';
  __procStyle.textContent=
    '#proc-notice-container{position:fixed;top:30%;left:50%;transform:translateX(-50%);z-index:9999;pointer-events:none;}'+
    '.proc-notice{padding:12px 24px;border-radius:8px;font-size:16px;font-weight:bold;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:procFadeIn 0.3s ease,procFadeOut 0.3s ease 1.7s forwards;margin-bottom:8px;}'+
    '.proc-notice.dodge{background:linear-gradient(135deg,#3a6b8a,#5a8caa);color:#fff;border:1px solid #7ab;}'+
    '.proc-notice.proc{background:linear-gradient(135deg,#c4a44a,#e4c46a);color:#2a2520;border:1px solid #ffd;}'+
    '.proc-notice.counter{background:linear-gradient(135deg,#b8302a,#d85040);color:#fff;border:1px solid #f88;}'+
    '@keyframes procFadeIn{from{opacity:0;transform:translateY(-20px);}to{opacity:1;transform:translateY(0);}}'+
    '@keyframes procFadeOut{from{opacity:1;}to{opacity:0;transform:translateY(-20px);}}';
  document.head.appendChild(__procStyle);
}

/* v30: 统一的概率触发提示函数
   - title: 提示标题（如"骑兵闪避！"）
   - desc: 详细描述（如"马躲避了炮的攻击"）
   - type: 'dodge'(蓝色)/'proc'(金色)/'counter'(红色)
   全局函数，供 skills.js 调用 */
function showProcNotice(title, desc, type){
  type = type || 'proc';
  /* 确保 container 存在 */
  let container = document.getElementById('proc-notice-container');
  if(!container){
    container = document.createElement('div');
    container.id = 'proc-notice-container';
    document.body.appendChild(container);
  }
  /* 创建提示元素 */
  const notice = document.createElement('div');
  notice.className = 'proc-notice ' + type;
  notice.innerHTML = '<div class="proc-title">' + title + '</div><div class="proc-desc" style="font-size:13px;font-weight:normal;opacity:0.9;">' + desc + '</div>';
  container.appendChild(notice);
  /* 2秒后移除 */
  setTimeout(()=>{ if(notice.parentNode) notice.parentNode.removeChild(notice); }, 2000);
  /* 同时写入战报 */
  if(typeof addBattleLog === 'function'){
    addBattleLog('passive', '<b>' + title + '</b> ' + desc);
  }
}

function speakTaunt(text, side='opp'){
  if(side==='self'){
    const bubble=document.getElementById('player-speech');
    document.getElementById('player-speech-text').textContent=text;
    bubble.classList.add('show');
    if(playerSpeechTimer) clearTimeout(playerSpeechTimer);
    playerSpeechTimer=setTimeout(()=>bubble.classList.remove('show'),3500);
    /* 语音播报：我方角色说话 */
    const speakChar = state.gameMode==='three' ? state.character : state.character;
    speakText(text, speakChar);
  } else {
    const bubble=document.getElementById('ai-speech');
    document.getElementById('ai-speech-text').textContent=text;
    bubble.classList.add('show');
    if(speechTimer) clearTimeout(speechTimer);
    speechTimer=setTimeout(()=>bubble.classList.remove('show'),3500);
    /* 语音播报：对方角色说话 */
    let oppChar = 'bking';
    if(state.gameMode==='pve') oppChar = 'bking';
    else if(state.gameMode==='pvp') oppChar = state.currentPlayer===RED ? state.pvpBlackChar : state.pvpRedChar;
    speakText(text, oppChar);
  }
}
/* 双方对话：我方先说，对方随后反应 */
function dialogue(myLine, oppLine, delay=1200){
  speakTaunt(myLine,'self');
  if(oppLine) setTimeout(()=>speakTaunt(oppLine,'opp'),delay);
}

const NUM_CN=['零','一','二','三','四','五','六','七','八','九'];
const RED_COLS=['九','八','七','六','五','四','三','二','一'];
const BLK_COLS=['1','2','3','4','5','6','7','8','9'];
function addHistoryEntry(piece,from,to,captured){
  const list=document.getElementById('history-list');
  const e=document.createElement('div');
  e.className='history-entry';
  const p=piece.player, pc=PIECE_CHAR[p][piece.type];
  const cols=p===RED?RED_COLS:BLK_COLS;
  const fromCol=cols[from.c], toCol=cols[to.c];
  const dr=to.r-from.r, fwd=p===RED?dr<0:dr>0;
  const dir=from.c===to.c&&from.r!==to.r?(fwd?'进':'退'):(from.r===to.r?'平':(fwd?'进':'退'));
  const target=from.c===to.c&&from.r!==to.r?NUM_CN[Math.abs(dr)]:toCol;
  e.innerHTML=`<span class="h-num">${state.moveCount}.</span><span class="h-move ${p}">${pc}${fromCol}${dir}${target}</span>`;
  list.appendChild(e); list.scrollTop=list.scrollHeight;
}
function removeLastHistoryEntry(){
  const list=document.getElementById('history-list');
  if(list.lastChild) list.removeChild(list.lastChild);
}
/* ===== 胜负场统计 ===== */
function getStatsRecord(){
  try{
    const raw=localStorage.getItem('bky_stats');
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return { wins:0, losses:0, pvpRed:0, pvpBlack:0, onlineWins:0, onlineLosses:0, total:0 };
}
function saveStatsRecord(rec){
  try{ localStorage.setItem('bky_stats',JSON.stringify(rec)); }catch(e){}
}
function recordResult(playerWins){
  const rec=getStatsRecord();
  rec.total++;
  if(state.gameMode==='pvp'){
    if(playerWins) rec.pvpRed++; else rec.pvpBlack++;
  } else if(state.gameMode==='online'){
    if(playerWins) rec.onlineWins++; else rec.onlineLosses++;
  } else {
    if(playerWins) rec.wins++; else rec.losses++;
  }
  saveStatsRecord(rec);
  return rec;
}

function showResult(playerWins,reason){
  // 统计胜负场（绝杀/认输/困毙均记录）
  const rec=recordResult(playerWins);
  showScreen('screen-result');
  const seal=document.getElementById('result-seal');
  const title=document.getElementById('result-title');
  const desc=document.getElementById('result-desc');
  const splash=document.getElementById('result-splash');
  const stats=document.getElementById('result-stats');
  const quote=document.getElementById('result-quote');
  if(state.gameMode==='pvp'){
    const winChar=playerWins?CHARACTERS[state.pvpRedChar]:CHARACTERS[state.pvpBlackChar];
    const loseChar=playerWins?CHARACTERS[state.pvpBlackChar]:CHARACTERS[state.pvpRedChar];
    seal.textContent='胜'; seal.classList.remove('lose');
    title.textContent=winChar.name+' 胜';
    splash.classList.remove('lose');
    desc.textContent=playerWins?'红方运筹帷幄，黑方认负':'黑方后发制人，红方认负';
    quote.textContent='"'+pick(loseChar.loseLines)+'"';
    setTimeout(()=>speakTaunt(pick(winChar.skillLines)),600);
  } else {
    const diff=DIFFICULTIES[state.difficulty];
    const char=CHARACTERS[state.character];
    if(playerWins){
      seal.textContent='胜'; seal.classList.remove('lose');
      title.textContent='胜'; splash.classList.remove('lose');
      desc.textContent='运筹帷幄之中，决胜千里之外';
      quote.textContent='"'+pick(diff.loseLines)+'"';
      setTimeout(()=>speakTaunt(pick(diff.loseLines)),600);
    } else {
      seal.textContent='负'; seal.classList.add('lose');
      title.textContent='负'; splash.classList.add('lose');
      desc.textContent='B王棋艺精湛，来日再战';
      quote.textContent='"'+pick(char.loseLines)+'"';
      setTimeout(()=>speakTaunt(pick(diff.winLines)),600);
    }
  }
  // 显示本局数据 + 累计胜负场
  const wr=rec.total>0?Math.round((rec.wins+rec.onlineWins)/(rec.wins+rec.losses+rec.onlineWins+rec.onlineLosses)*100):0;
  stats.innerHTML=`
    <div class="result-stat"><div class="rs-value">${state.moveCount}</div><div class="rs-label">回合数</div></div>
    <div class="result-stat"><div class="rs-value">${state.redCaptured.length}</div><div class="rs-label">损子</div></div>
    <div class="result-stat"><div class="rs-value">${state.blackCaptured.length}</div><div class="rs-label">取子</div></div>
    <div class="result-stat"><div class="rs-value">${rec.wins}</div><div class="rs-label">胜场</div></div>
    <div class="result-stat"><div class="rs-value">${rec.losses}</div><div class="rs-label">负场</div></div>
    <div class="result-stat"><div class="rs-value">${wr}%</div><div class="rs-label">胜率</div></div>
  `;
  /* v31: 故事模式胜利后显示 winDialog 多角色剧情对话 */
  const storyDialogEl = document.getElementById('result-story-dialog');
  if(storyDialogEl){
    if(state.storyChapterId && playerWins){
      const ch = STORY_CHAPTERS.find(c=>c.id===state.storyChapterId);
      if(ch && ch.winDialog && ch.winDialog.length>0){
        let dialogHtml = '<div class="story-dialog-container">';
        ch.winDialog.forEach(d=>{
          const isBking = d.speaker==='B王';
          const spkClass = isBking ? 'story-speaker-bking' : 'story-speaker-self';
          dialogHtml += `<div class="story-dialog ${spkClass}">
            <span class="story-speaker">${d.speaker}：</span>
            <span class="story-text">${d.text}</span>
          </div>`;
        });
        dialogHtml += '</div>';
        storyDialogEl.innerHTML = dialogHtml;
        storyDialogEl.style.display = 'block';
      } else {
        storyDialogEl.innerHTML = '';
        storyDialogEl.style.display = 'none';
      }
    } else {
      storyDialogEl.innerHTML = '';
      storyDialogEl.style.display = 'none';
    }
  }
  // 记录本局结果，供手动保存按钮使用
  state.lastResult = playerWins ? 'win' : 'lose';
  state.lastResultReason = reason;
  // 保存复盘
  saveReplay(playerWins, reason);
  /* v10: 故事模式进度推进 + 「下一章」便捷按钮
     - 调用统一的 onStoryChapterComplete 处理解锁与存档
     - 胜利后渲染「下一章 / 完成故事 / 重玩此章」按钮（文案动态从 STORY_CHAPTERS 读取） */
  const storyNextBtn = document.getElementById('btn-result-next-chapter');
  const storyReplayBtn = document.getElementById('btn-result-replay-chapter');
  if(storyNextBtn) storyNextBtn.style.display = 'none';
  if(storyReplayBtn) storyReplayBtn.style.display = 'none';
  if(state.storyChapterId && playerWins){
    /* 在 onStoryChapterComplete 更新 storyProgress 之前，判定本次是否为「重玩已通关章节」：
       storyProgress = 已通关最大章节 id + 1，故 chapterId < storyProgress 表示该章早已通关。 */
    const wasReplay = state.storyChapterId < storyProgress;
    onStoryChapterComplete(state.storyChapterId);
    if(storyNextBtn){
      const currentId = state.storyChapterId;
      if(currentId >= STORY_CHAPTERS.length){
        /* 终章通关：onStoryChapterComplete 已将 storyProgress 置为 STORY_CHAPTERS.length+1，
           getUnlockedChars 会据此解锁全部隐藏角色，此处仅做界面跳转。 */
        storyNextBtn.textContent = '完成故事 · 开放所有角色';
        storyNextBtn.onclick = function(){ showScreen('screen-welcome'); };
      } else {
        const nextCh = STORY_CHAPTERS.find(function(c){ return c.id === currentId + 1; });
        if(nextCh){
          storyNextBtn.textContent = '下一章 · ' + nextCh.title;
          storyNextBtn.onclick = function(){ startStoryChapter(currentId + 1); };
        }
      }
      storyNextBtn.style.display = '';
    }
    /* 重玩已通关章节胜利后，额外提供「重玩此章」按钮（与「下一章」二选一） */
    if(storyReplayBtn && wasReplay){
      storyReplayBtn.textContent = '重玩此章';
      storyReplayBtn.onclick = function(){ startStoryChapter(state.storyChapterId); };
      storyReplayBtn.style.display = '';
    }
  }
}
/* v10: 故事模式通关章节处理
   - 推进 storyProgress（含通关终章标记）
   - 进度存档到 localStorage
   - 第14章通关后额外解锁隐藏角色（由 getUnlockedChars 读取 progress 计算，
     无需单独维护 unlockedChars 列表，保持单一数据源） */
function onStoryChapterComplete(chapterId){
  const chapter = STORY_CHAPTERS.find(c=>c.id===chapterId);
  if(!chapter) return;
  const nextCh = chapterId + 1;
  if(nextCh > storyProgress){
    if(nextCh <= STORY_CHAPTERS.length){
      storyProgress = nextCh;
    } else {
      /* 通关终章：标记故事模式完成（progress > 章节数） */
      storyProgress = STORY_CHAPTERS.length + 1;
    }
    localStorage.setItem('bky_story_progress', String(storyProgress));
  }
}

/* ===== 复盘系统 ===== */
let replayState = {
  data: null,       // 当前复盘数据
  step: 0,          // 当前步数
  playing: false,
  timer: null
};
function saveReplay(playerWins, reason){
  try{
    const replay = {
      id: Date.now(),
      time: new Date().toLocaleString('zh-CN'),
      mode: state.gameMode,
      result: playerWins?'win':'lose',
      reason: reason || 'normal',
      moveCount: state.moveCount,
      redChar: state.gameMode==='pvp'||state.gameMode==='online'?state.pvpRedChar:state.character,
      blackChar: state.gameMode==='pvp'||state.gameMode==='online'?state.pvpBlackChar:'bking',
      difficulty: state.difficulty,
      initialBoard: createInitialBoard(
        state.gameMode==='pvp'||state.gameMode==='online'?state.pvpRedChar:state.character,
        state.gameMode==='pvp'||state.gameMode==='online'?state.pvpBlackChar:'bking'
      ),
      moves: state.history.map(h=>({from:h.from,to:h.to,piece:h.piece,captured:h.captured,player:h.player}))
    };
    let replays = [];
    const raw = localStorage.getItem('bky_replays');
    if(raw) replays = JSON.parse(raw);
    replays.unshift(replay);
    if(replays.length>20) replays = replays.slice(0,20); // 保留最近20局
    localStorage.setItem('bky_replays', JSON.stringify(replays));
  }catch(e){}
}
function getReplayList(){
  try{
    const raw = localStorage.getItem('bky_replays');
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return [];
}
/* 开始复盘 */
function startReplay(replayId){
  const list = getReplayList();
  const rep = list.find(r=>r.id===replayId);
  if(!rep) return;
  replayState.data = rep;
  replayState.step = 0;
  replayState.playing = false;
  // 进入复盘模式
  state.board = cloneBoard(rep.initialBoard);
  state.currentPlayer = RED;
  state.selected = null; state.validMoves = [];
  state.lastMove = null; state.gameOver = false;
  state.redCaptured = []; state.blackCaptured = [];
  state.moveCount = 0;
  switchToReplayCanvas();
  renderAll();
  // 显示复盘信息
  document.getElementById('replay-info').textContent =
    (rep.redChar?CHARACTERS[rep.redChar]?.name:'红方')+' vs '+(rep.blackChar?CHARACTERS[rep.blackChar]?.name:'B王')+' · '+rep.time;
  updateReplayControls();
  showScreen('screen-replay');
}
function replayGoto(step){
  if(!replayState.data) return;
  const rep = replayState.data;
  step = Math.max(0, Math.min(step, rep.moves.length));
  // 从初始局面重放到指定步
  state.board = cloneBoard(rep.initialBoard);
  state.currentPlayer = RED;
  state.redCaptured = []; state.blackCaptured = [];
  state.lastMove = null;
  for(let i=0; i<step; i++){
    const m = rep.moves[i];
    const piece = state.board[m.from.r][m.from.c];
    if(!piece) continue;
    const captured = state.board[m.to.r][m.to.c];
    if(captured){
      if(captured.player===RED) state.redCaptured.push(captured);
      else state.blackCaptured.push(captured);
    }
    state.board[m.to.r][m.to.c] = piece;
    state.board[m.from.r][m.from.c] = null;
    state.lastMove = {from:{...m.from}, to:{...m.to}};
    state.currentPlayer = state.currentPlayer===RED?BLACK:RED;
  }
  replayState.step = step;
  state.moveCount = step;
  state.selected = null; state.validMoves = [];
  renderAll();
  updateReplayControls();
}
function replayStep(dir){
  replayGoto(replayState.step + dir);
}
function replayTogglePlay(){
  if(replayState.playing){
    replayState.playing = false;
    if(replayState.timer){ clearInterval(replayState.timer); replayState.timer = null; }
  } else {
    if(replayState.step >= replayState.data.moves.length) replayGoto(0);
    replayState.playing = true;
    replayState.timer = setInterval(()=>{
      if(replayState.step >= replayState.data.moves.length){
        replayState.playing = false;
        clearInterval(replayState.timer);
        replayState.timer = null;
        updateReplayControls();
        return;
      }
      replayStep(1);
    }, 1000);
  }
  updateReplayControls();
}
function updateReplayControls(){
  const rep = replayState.data;
  if(!rep) return;
  const total = rep.moves.length;
  const cur = replayState.step;
  document.getElementById('replay-progress').textContent = cur+' / '+total;
  document.getElementById('replay-bar').max = total;
  document.getElementById('replay-bar').value = cur;
  const playBtn = document.getElementById('btn-replay-play');
  if(playBtn) playBtn.textContent = replayState.playing?'⏸':'▶';
  document.getElementById('btn-replay-prev').disabled = (cur<=0);
  document.getElementById('btn-replay-next').disabled = (cur>=total);
  document.getElementById('btn-replay-start').disabled = (cur<=0);
  document.getElementById('btn-replay-end').disabled = (cur>=total);
}
function showReplayList(){
  const list = getReplayList();
  const container = document.getElementById('replay-list');
  if(!container) return;
  container.innerHTML = '';
  if(list.length===0){
    container.innerHTML = '<div class="replay-empty">暂无对局记录</div>';
    return;
  }
  list.forEach(r=>{
    const redName = CHARACTERS[r.redChar]?.name || '红方';
    const blkName = CHARACTERS[r.blackChar]?.name || 'B王';
    const item = document.createElement('div');
    item.className = 'replay-item';
    const winTag = r.result==='win'?'<span class="replay-tag win">胜</span>':'<span class="replay-tag lose">负</span>';
    item.innerHTML = `
      <div class="replay-info">
        <div class="replay-vs">${redName} vs ${blkName} ${winTag}</div>
        <div class="replay-meta">${r.time} · ${r.moveCount}回合 · ${r.mode==='pve'?'人机':r.mode==='pvp'?'双人':'联机'}</div>
      </div>
      <button class="replay-view-btn">复盘</button>`;
    item.querySelector('.replay-view-btn').addEventListener('click', ()=>startReplay(r.id));
    container.appendChild(item);
  });
  showScreen('screen-replay-list');
}
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  /* 进入模式选择屏：刷新 PVE 卡片锁定态 */
  if(id==='screen-mode'){ updateModeLockState(); }
  /* 战报面板仅在游戏对局界面可见，其他界面隐藏面板与切换按钮 */
  const _logPanel = document.getElementById('battle-log-panel');
  if(_logPanel){
    if(id==='screen-game'){
      _logPanel.style.display = '';
      /* 进入对局时显示折叠/展开按钮 */
      showBattleLogToggle(true);
    } else {
      _logPanel.style.display = 'none';
      showBattleLogToggle(false);
    }
  }
  /* BGM 切换：菜单页播放菜单音乐 */
  if(id!=='screen-game' && audioState && audioState.enabled && audioState.ctx && audioState.ctx.state==='running'){
    playMenuBGM();
  }
}

/* ===== 角色虚拟形象已移至 js/portrait.js ===== */

/* ===== 选将屏渲染 ===== */
/* ===== 选将屏分页 ===== */
let charPage=0;
const CHAR_PER_PAGE=6;
let charFlipping=false;
let pvpBannedChars=[]; /* v4.0 PVP Ban 列表 */
/* v4.0 故事模式角色解锁系统
   v22 修复：用户反馈"应该下一章多出解锁的角色"。
   原逻辑 i<progress 仅解锁已完成的章节，导致章节 N 进入选将时
   看不到本章新加入的角色。改为 i<=progress：当前章节进入选将时，
   本章 unlockChar 也解锁。
   v10 重设计：14章每章解锁1名角色（unlockChar 单数）。
   默认初始解锁集为空（第1章选将时通过 i<=1 解锁 houzhibo）。 */
function getUnlockedChars(){
  let unlocked = new Set();
  const progress = parseInt(localStorage.getItem('bky_story_progress')||'1');
  // v22: 解锁已完成章节 + 当前章节（i<=progress），保证选将时能看到本章新增角色
  for(let i=1; i<=progress && i<=STORY_CHAPTERS.length; i++){
    const ch = STORY_CHAPTERS.find(c=>c.id===i);
    if(ch && ch.unlockChar){
      unlocked.add(ch.unlockChar);
    }
  }
  // 通关全部章节后解锁隐藏角色（v39 动态化：从 data.js HIDDEN_CHARS 常量读取）
  // 注：broly/empire/alice 已通过 18/19/20 章 unlockChar 解锁，不重复列入 HIDDEN_CHARS
  if(progress > STORY_CHAPTERS.length && typeof HIDDEN_CHARS !== 'undefined'){
    HIDDEN_CHARS.forEach(id => unlocked.add(id));
  }
  return unlocked;
}
function getCharList(){
  /* v5.0 多阵营模式：仅显示当前阵营成员，并过滤已选角色（阵营内/跨阵营去重） */
  if(state.gameMode==='faction' && state.factionSelectMembers){
    const selected = state.factionSelectedChars || [];
    return state.factionSelectMembers
      .filter(id => !selected.includes(id))
      .map(id=>[id,CHARACTERS[id]])
      .filter(([id,ch])=>ch);
  }
  /* 4v4 模式：选将时显示全部可选角色（按 multiPlayers 顺序选） */
  if(state.gameMode==='4v4' && state.multi4SelectMembers){
    return state.multi4SelectMembers.map(id=>[id,CHARACTERS[id]]).filter(([id,ch])=>ch);
  }
  /* 故事模式（state.storyChapterId 存在时）：只显示已解锁角色 */
  const unlocked = state.storyChapterId ? getUnlockedChars() : null;
  return Object.entries(CHARACTERS).filter(([id])=>{
    /* v18: PVE 与三英模式均不可选 B王（B王是对手/AI，加入玩家方会造成逻辑悖论） */
    if(id==='bking'&&(state.gameMode==='pve'||state.gameMode==='three')) return false;
    /* v4.0 PVP Ban：过滤被Ban角色 */
    if(pvpBannedChars&&pvpBannedChars.includes(id)) return false;
    if(unlocked && !unlocked.has(id)) return false; // Story mode: only show unlocked
    return true;
  });
}
/* 将 glow 中的透明度统一降到 0.08，作为卡片底色 tint */
function glowToTint(glow){
  if(!glow) return 'rgba(184,48,42,0.08)';
  return glow.replace(/0?\.\d+\)/, '0.08)');
}
function renderCharacterCards(animate=true){
  const c=document.getElementById('character-cards');
  c.innerHTML='';
  c.classList.remove('flip-out');
  const list=getCharList();
  const start=charPage*CHAR_PER_PAGE;
  const pageItems=list.slice(start,start+CHAR_PER_PAGE);
  pageItems.forEach(([id,ch],i)=>{
    const card=document.createElement('div');
    card.className='character-card'; card.dataset.character=id;
    card.style.setProperty('--char-color',ch.color);
    card.style.setProperty('--char-glow',ch.glow);
    card.style.setProperty('--char-tint',glowToTint(ch.glow));
    card.style.setProperty('--ci',i);
    if(!animate){ card.style.animation='none'; }
    // 三英战B王：标记已选武将
    if(state.gameMode==='three'&&threePicks.includes(id)) card.classList.add('picked');
    // 当前选中的主动/被动索引（默认 0）
    const sel=skillState.selected[id]||{active:0,passive:0};
    const actList=(ch.actives&&ch.actives.length)?ch.actives:[{name:ch.skill.name}];
    const activesHTML=actList.map((a,i)=>`
      <div class="char-active-mini${sel.active===i?' selected':''}" data-act="${i}">${a.name}</div>`).join('');
    const pvList=(ch.passives&&ch.passives.length)?ch.passives:[];
    const passivesHTML=pvList.map((p,i)=>`
      <div class="char-passive-mini${sel.passive===i?' selected':''}" data-pv="${i}">${p.name}</div>`).join('');
    card.innerHTML=`
      <div class="char-portrait"><div class="portrait-ring"></div><div class="portrait-svg">${getPortrait(id,ch.color,ch.glow)}</div></div>
      <h3 class="char-name">${ch.name}</h3>
      <div class="char-title-text">${ch.title}</div>
      <p class="char-desc">${ch.desc}</p>
      <div class="char-actives">${activesHTML}</div>
      <div class="char-passives">${passivesHTML}</div>`;
    c.appendChild(card);
  });
  renderCharPagination();
  updateCharNav();
}
/* 翻页：先播放离场动画，再渲染新页 */
function gotoCharPage(newPage,dir=1){
  if(charFlipping) return;
  const total=Math.ceil(getCharList().length/CHAR_PER_PAGE);
  if(newPage<0||newPage>=total||newPage===charPage) return;
  charFlipping=true;
  const c=document.getElementById('character-cards');
  c.classList.add('flip-out');
  setTimeout(()=>{
    charPage=newPage;
    renderCharacterCards(true);
    charFlipping=false;
  },300);
}
function updateCharNav(){
  const total=Math.max(1,Math.ceil(getCharList().length/CHAR_PER_PAGE));
  const info=document.getElementById('char-page-info');
  if(info) info.textContent=(charPage+1)+' / '+total;
  const prev=document.getElementById('char-prev');
  const next=document.getElementById('char-next');
  if(prev) prev.disabled=(charPage<=0);
  if(next) next.disabled=(charPage>=total-1);
}
function renderCharPagination(){
  const total=Math.max(1,Math.ceil(getCharList().length/CHAR_PER_PAGE));
  const cur=document.getElementById('char-pagination');
  if(!cur) return;
  cur.innerHTML='';
  for(let i=0;i<total;i++){
    const dot=document.createElement('div');
    dot.className='page-dot'+(i===charPage?' active':'');
    dot.addEventListener('click',()=>{
      if(i!==charPage) gotoCharPage(i);
    });
    cur.appendChild(dot);
  }
}

/* ===== 角色介绍页 ===== */
function showCharacterDetail(id){
  const ch=CHARACTERS[id];
  if(!ch) return;
  const detail=document.getElementById('char-detail');
  detail.style.setProperty('--char-color',ch.color);
  detail.style.setProperty('--char-glow',ch.glow);
  document.getElementById('detail-portrait').innerHTML=getPortrait(id,ch.color,ch.glow);
  document.getElementById('detail-char').textContent=ch.char;
  document.getElementById('detail-name').textContent=ch.name;
  document.getElementById('detail-title').textContent=ch.title;
  document.getElementById('detail-desc').textContent=ch.desc;
  /* v22: 奇术区域展示全部主动技能（含B王5个）
     原逻辑只显示 ch.skill（第一个），导致 B王 等角色主动技能显示不全 */
  const activesForDetail=(ch.actives && ch.actives.length>0)?ch.actives:[ch.skill];
  const skillSection=document.querySelector('#char-detail .detail-section:nth-child(2) .detail-skill');
  if(skillSection){
    /* 重建奇术列表（保留原有首项样式 .detail-skill-header / .detail-skill-desc） */
    skillSection.innerHTML=activesForDetail.map(a=>`
      <div class="detail-skill-header">
        <span class="detail-skill-name">${a.name}</span>
        <span class="detail-skill-cd">冷却 ${a.cd} 回合</span>
      </div>
      <p class="detail-skill-desc">${a.desc}</p>`).join('<hr style="border:0;border-top:1px dashed rgba(0,0,0,0.15);margin:8px 0">');
  } else {
    /* 兜底：原逻辑 */
    document.getElementById('detail-skill-name').textContent=ch.skill.name;
    document.getElementById('detail-skill-desc').textContent=ch.skill.desc;
    document.getElementById('detail-skill-cd').textContent='冷却 '+ch.skill.cd+' 回合';
  }
  document.getElementById('detail-atk').style.setProperty('--w',ch.stats.atk+'%');
  document.getElementById('detail-def').style.setProperty('--w',ch.stats.def+'%');
  document.getElementById('detail-int').style.setProperty('--w',ch.stats.int+'%');
  document.getElementById('detail-atk-val').textContent=ch.stats.atk;
  document.getElementById('detail-def-val').textContent=ch.stats.def;
  document.getElementById('detail-int-val').textContent=ch.stats.int;
  // 台词展示
  const linesEl=document.getElementById('detail-lines');
  linesEl.innerHTML='';
  if(ch.skillLines){
    ch.skillLines.slice(0,3).forEach(line=>{
      const li=document.createElement('div');
      li.className='detail-line';
      li.textContent='"'+line+'"';
      linesEl.appendChild(li);
    });
  }
  detail.dataset.character=id;
  detail.classList.add('show');
  /* v4.0 展示被动技能面板 */
  showPassivePanel(id);
}

/* ===== 游戏初始化 ===== */
/* v28: 应用 B王难度 N 层属性加成
   仅故事模式调用，给 B王方（默认黑方）棋子的 hp/maxHp/atk/def 乘以 BKING_LAYERS[layer] 的系数。
   属性按 Math.floor 取整，避免小数 HP 显示异常。
   系数与角色加成（charAtk/charDef）独立叠加，不影响角色派生属性。 */
function applyBkingLayerBuff(board, color, layer){
  if(typeof BKING_LAYERS==='undefined') return;
  const cfg=BKING_LAYERS[layer];
  if(!cfg) return;
  for(let r=0;r<board.length;r++){
    for(let c=0;c<board[r].length;c++){
      const p=board[r][c];
      if(p && p.player===color){
        p.hp=Math.floor(p.hp*cfg.hpMul);
        p.maxHp=Math.floor(p.maxHp*cfg.hpMul);
        p.atk=Math.floor(p.atk*cfg.atkMul);
        p.def=Math.floor(p.def*cfg.defMul);
      }
    }
  }
}
function startNewGame(){
  /* v4.0 重置被动状态 */
  if(typeof resetPassives==='function') resetPassives();
  /* v22: 重置战斗日志并显示面板 */
  state.battleLog = [];
  const _logPanel = document.getElementById('battle-log-panel');
  if(_logPanel) _logPanel.classList.remove('collapsed');
  showBattleLogToggle(false);
  /* v5.0 多阵营/4v4 模式：使用多阵营棋盘 */
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    /* v8 角色属性注入：按 multiPlayers 的 color→char 构造 charMap */
    const charMap={};
    (state.multiPlayers||[]).forEach(mp=>{ charMap[mp.color]=mp.char; });
    state.board=createMultiFactionBoard(state.activePlayers, charMap);
    state.eliminatedPlayers=[];
    state.playerIndex=0;
    state.currentPlayer=state.activePlayers[0]||RED;
  } else {
    /* v8 角色属性注入：红方用玩家选的角色ID，黑方用AI/B王的角色ID */
    let redId, blackId;
    if(state.gameMode==='pvp'||state.gameMode==='online'){
      redId=state.pvpRedChar; blackId=state.pvpBlackChar;
    } else if(state.gameMode==='three'){
      redId=state.threeHeroes[state.threeHeroIndex]||state.character; blackId='bking';
    } else {
      redId=state.character; blackId='bking';
    }
    state.board=createInitialBoard(redId, blackId);
    if(state.gameMode!=='pvp'&&state.gameMode!=='online') applyHandicap(state.board,state.handicap);
    /* v28: 故事模式按章节应用 B王 N 层属性加成（仅对 B王方棋子生效） */
    if(state.storyChapterId && state.bkingLayer){
      applyBkingLayerBuff(state.board, state.aiColor, state.bkingLayer);
    }
    state.currentPlayer=RED;
    /* 2 玩家模式：activePlayers 固定为 [RED, BLACK] */
    state.activePlayers=[RED, BLACK];
    state.playerIndex=0;
    state.eliminatedPlayers=[];
  }
  state.selected=null; state.validMoves=[];
  state.history=[]; state.gameOver=false;
  state.lastMove=null; state.animating=false; state.aiThinking=false;
  state.moveCount=0; state.redCaptured=[]; state.blackCaptured=[];
  state.roundsSincePlayerSkill=3; state.roundsSinceAISkill=3; state.roundsSinceP2Skill=3;
  state.skillActive=null; state.revealedMoves=null;
  state.suggestedMoves=null; state.aiPredictedMove=null; state.threatMarks=null;
  state.extraMove=0; state.weakenedAITurns=0; state.swapMode=false; state.swapPhase=null; state.swapTargetA=null;
  state.boardSnapshots=[]; state.celestialShield=false; state.celestialPrediction=null;
  state.playerCannotCapture=false; state.aiExtraMoves=0;
  state.dodgeTarget=null; state.disguiseMode=false; state.aweActive=false; state.awePieces=[];
  state.counterEyeTurns=0; state.aiSkillBlocked=false;
  state.playerConfusedMove=null;
  /* v22: PVP 预测类被动强制走法（按颜色区分，允许双方各自持有一份） */
  state.predForcedMoves={};
  state.forcedMovePending=false;
  /* 取消上一个未执行的 forced move timer，避免跨局残留 */
  if(state.forcedMoveTimer){ clearTimeout(state.forcedMoveTimer); state.forcedMoveTimer=null; }
  /* v17: PVP 通用技能封锁标记重置 */
  state.oppSkillBlockedColor=null;
  /* v35-fix P1-Bug4: 诛仙剑阵跨局残留清理 */
  state.zhuxianFormationActive=false;
  state.zhuxianExecuteCheck=false;
  /* v16: 重置一次性技能标记（之前未在 startNewGame 中重置，跨局残留） */
  state.oppMissNext=false;
  state.aoeLockdownTurns=0;
  state.oppSlowTurns=0;
  state.oppPassiveDisabled=0;
  state.barrageActive=false;
  state.bkingCdIncrease=0;
  state.bkingSkillChanceReduce=0;
  state.skillCdReduce=0;
  state.reflectFirstTurn=0;
  state.dodgeNext=false;
  state.attackBoost=0;
  state.chainatkStacks=0; /* v10 弱角色增强：罗伦杰 p_chainatk 独立计数器 */
  state.bkingAtkDebuff=0;
  /* v32-fix P0: 跨局残留清理 — atkDebuffByColor / attackBoostOwner / bkingAtkDebuffTarget
     原本只写不重置，第二局首回合会沿用上局残留层数导致数值异常 */
  state.atkDebuffByColor = {};
  state.attackBoostOwner = null;
  state.bkingAtkDebuffTarget = null;
  state.routePreview=null;
  state.hintMove=null;
  state.revealedPiece=null;
  state.hiddenPiece=null;
  state.oppCannotCapture=false;
  state.oppSilenceTurns=0;
  /* 新技能状态重置 */
  state.ironwallTarget=null; state.ironwallTurns=0;
  state.teleportMode=false;
  state.lockedPiece=null; state.lockTurns=0;
  state.catchActive=false;
  state.controlActive=false; state.controlledMove=null;
  state.silenceTurns=0;
  state.playerSkillLock=false; state.p2SkillLock=false; state.aiSkillLock=false;
  state.aiRoutePlan=[]; state.aiRouteTurns=0; state.routeDisplay=null;
  state.skillOwnerColor=null;
  /* v22 修复 Bug 3/6/8：重置新增技能状态字段 */
  state.sacrificedList=[];
  state.blinkActive=false;
  state.counterActiveTurns=0;
  state.counterStacks=0;
  state.chainatkStacks=0; /* v10 弱角色增强：罗伦杰 p_chainatk 计数器 */
  /* v31: 天气系统初始化 + 技能高亮目标列表 */
  initWeather();
  state.highlightedTargets = []; /* [{r,c,label,color,expires}] */
  /* v10 修复：补充遗漏的状态字段重置（跨局残留导致 buff/限制异常） */
  state.confuseForcedMove=null;
  state.stormActive=null;
  state.shieldMode=false;
  state.shieldAmount=0;
  state.shieldDefBuff=0;
  state.teleportBuff=0;
  state.domainTurns=0;
  state.ironwallPiece=null;
  state.ironwallRevivePending=false;
  state.ironwallActive=false;
  /* v30: 重置 B王形态切换 + 色欲控制列表 + 嫉妒复制列表（跨局残留清理） */
  state.bkingCurrentForm=null;
  state.lustControlledPieces=[];
  state.envyStolenPassives=[];
  /* v31-fix P1: 重置形态修饰（cdReduce/buffDurationBonus/selfAttackChance） */
  state.bkingFormMods = { cdReduce:0, buffDurationBonus:0, selfAttackChance:0 };
  // 三英战B王：重置武将CD与B王计数
  if(state.gameMode==='three'){
    state.threeHeroCDs=[3,3,3];
    state.threeHeroIndex=0;
    state.threeBKingTurns=0;
    state.threeBKingDoubleNext=false;
    if(state.threeHeroes.length>0) state.character=state.threeHeroes[0];
    /* v11: 恢复第一位武将的选中技能 */
    if(state.threeHeroSkills && state.threeHeroSkills[0]){
      state.playerActiveSkill=state.threeHeroSkills[0].active;
      state.playerPassiveSkill=state.threeHeroSkills[0].passive;
    }
  }
  document.getElementById('history-list').innerHTML='';
  const char=getCurrentChar();
  document.getElementById('player-avatar-char').textContent=char.char;
  document.getElementById('player-name').textContent=char.name;
  document.getElementById('player-style').textContent=char.title;
  const av=document.getElementById('player-avatar');
  av.style.borderColor=char.color; av.style.color=char.color;
  let playerCharId;
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    /* v5.0 多阵营：玩家头像取 multiPlayers[0]（红方）的角色 */
    playerCharId=state.multiPlayers[0]?state.multiPlayers[0].char:state.character;
  } else if(state.gameMode==='pvp'||state.gameMode==='online'){
    playerCharId=state.pvpRedChar;
  } else if(state.gameMode==='three'){
    playerCharId=state.threeHeroes[state.threeHeroIndex];
  } else {
    playerCharId=state.character;
  }
  setAvatarPortrait(av, playerCharId);
  if(state.gameMode==='faction'||state.gameMode==='4v4'){
    /* v5.0 多阵营：对手卡片显示下一个玩家 */
    const nextIdx=1%state.activePlayers.length;
    const nextMp=state.multiPlayers.find(p=>p.color===state.activePlayers[nextIdx]);
    if(nextMp){
      const nextCh=CHARACTERS[nextMp.char];
      document.getElementById('ai-name').textContent=nextCh.name;
      document.getElementById('ai-title').textContent=nextCh.title;
      const aiAv=document.querySelector('.opponent-card .player-avatar');
      if(aiAv){ aiAv.style.borderColor=nextCh.color; aiAv.style.color=nextCh.color; }
      const aiChar=document.querySelector('.opponent-card .avatar-char');
      if(aiChar) aiChar.textContent=nextCh.char;
      setAvatarPortrait(aiAv, nextMp.char);
    }
  } else if(state.gameMode==='pvp'||state.gameMode==='online'){
    const p2Char=CHARACTERS[state.pvpBlackChar];
    document.getElementById('ai-name').textContent=p2Char.name;
    document.getElementById('ai-title').textContent=p2Char.title;
    const aiAv=document.querySelector('.opponent-card .player-avatar');
    if(aiAv){ aiAv.style.borderColor=p2Char.color; aiAv.style.color=p2Char.color; }
    const aiChar=document.querySelector('.opponent-card .avatar-char');
    if(aiChar) aiChar.textContent=p2Char.char;
    setAvatarPortrait(aiAv, state.pvpBlackChar);
  } else {
    const diff=DIFFICULTIES[state.difficulty];
    document.getElementById('ai-name').textContent=diff.name;
    document.getElementById('ai-title').textContent=diff.title;
    const aiAv=document.querySelector('.opponent-card .player-avatar');
    if(aiAv){ aiAv.style.borderColor=''; aiAv.style.color=''; }
    const aiChar=document.querySelector('.opponent-card .avatar-char');
    if(aiChar) aiChar.textContent='B';
    setAvatarPortrait(aiAv, 'bking');
  }
  setupCanvas(); renderAll();
  updateTurnIndicator(); updateCapturedDisplay(); updateSkillDisplay();
  hideCheckWarning();
  /* BGM：播放角色主题音乐 */
  playCharacterBGM(playerCharId);
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    setTimeout(()=>speakTaunt('对战开始！红方先行'),600);
  } else if(state.gameMode==='faction'||state.gameMode==='4v4'){
    /* v5.0 多阵营开场提示 */
    const ap=state.activePlayers;
    const names=ap.map(c=>colorDisplayName(c)).join('、');
    setTimeout(()=>speakTaunt(`多阵营对战开始！${names} 轮流出战`),600);
  } else {
    setTimeout(()=>speakTaunt(pick(B_TAUNTS.start)),600);
    setTimeout(()=>speakTaunt(pick(char.speech)),3500);
  }
  showScreen('screen-game');
  /* v22 修复 Bug 8：首回合被动在游戏初始化后立即触发一次，
     避免 p_strategy/p_plan/p_logic/p_knowledge/p_insight/p_hide/p_ironheart 等
     "首回合"效果延迟到玩家走完第一步棋后才生效。 */
  if(typeof passivesTriggerFirstTurn==='function'){
    passivesTriggerFirstTurn();
    renderHUD();
    updateSkillDisplay();
  }
  /* v22: 首回合 predForcedMoves 检查 — passivesTriggerFirstTurn 可能设置
     predForcedMoves[RED]（黑方预测被动强制红方走一步）。
     原 predForcedMoves 检查只在 doMove 回调中触发，导致红方第 1 回合不被检查，
     黑方预测被动对红方首回合完全失效，且会在红方第 2 回合消费过期走法。
     现在在 startNewGame 末尾立即检查并执行，避免过期。 */
  tryConsumeForcedMove();
  /* v22: 战报 — 对局开始 */
  const _modeLabel = state.gameMode==='pve'?'对战B王':state.gameMode==='pvp'?'双人对战':state.gameMode==='online'?'联机对战':state.gameMode==='three'?'三英战B王':state.gameMode==='story'?'故事模式':state.gameMode==='faction'?'阵营对战':state.gameMode;
  const _redName = (state.gameMode==='pvp'||state.gameMode==='online') ? (CHARACTERS[state.pvpRedChar]&&CHARACTERS[state.pvpRedChar].name||'红方') : (CHARACTERS[state.character]&&CHARACTERS[state.character].name||'红方');
  const _blackName = (state.gameMode==='three'||state.gameMode==='pve'||state.gameMode==='story') ? 'B王' : ((CHARACTERS[state.pvpBlackChar]&&CHARACTERS[state.pvpBlackChar].name)||'黑方');
  addBattleLog('system', `<b>${_modeLabel}</b> 开始！${_redName} vs ${_blackName}`);
  renderBattleLog();
}

/* ===== v31: 天气系统 =====
   每隔 3~5 回合随机切换天气，对全局产生 buff/debuff 影响 */
function initWeather(){
  if(typeof WEATHER_TYPES==='undefined' || !WEATHER_TYPES){
    state.weather='sunny'; state.weatherTurnsLeft=5; return;
  }
  const keys = WEATHER_KEYS || Object.keys(WEATHER_TYPES);
  state.weather = keys[Math.floor(Math.random()*keys.length)];
  state.weatherTurnsLeft = WEATHER_DURATION_MIN + Math.floor(Math.random()*(WEATHER_DURATION_MAX-WEATHER_DURATION_MIN+1));
}
function tickWeather(){
  if(!state.weather || !WEATHER_TYPES[state.weather]){
    initWeather(); return;
  }
  state.weatherTurnsLeft--;
  if(state.weatherTurnsLeft<=0){
    /* 切换到新天气（避免重复） */
    const keys = (WEATHER_KEYS||Object.keys(WEATHER_TYPES)).filter(k=>k!==state.weather);
    const oldName = WEATHER_TYPES[state.weather].name;
    state.weather = keys[Math.floor(Math.random()*keys.length)];
    state.weatherTurnsLeft = WEATHER_DURATION_MIN + Math.floor(Math.random()*(WEATHER_DURATION_MAX-WEATHER_DURATION_MIN+1));
    const w = WEATHER_TYPES[state.weather];
    if(typeof addBattleLog==='function'){
      addBattleLog('system', `<b>天气变化</b> ${oldName} → ${w.name}（${w.desc}）`);
    }
  }
}
/* 获取当前天气对某棋子的影响（供 calcDamage 调用）
   返回 { atkMul, defMul, rangedMul, hitChance, dodgeAdj } */
function getWeatherEffectForPiece(piece){
  const base = { atkMul:1.0, defMul:1.0, rangedMul:1.0, hitChance:1.0, dodgeAdj:0, strikerAtkMul:1.0, defenderDefMul:1.0 };
  if(!piece || !state.weather) return base;
  const w = WEATHER_TYPES && WEATHER_TYPES[state.weather];
  if(!w || !w.effect) return base;
  const e = w.effect;
  base.atkMul = e.atkMul || 1.0;
  base.defMul = e.defMul || 1.0;
  base.rangedMul = e.rangedMul || 1.0;
  base.hitChance = e.hitChance!==undefined ? e.hitChance : 1.0;
  base.dodgeAdj = e.dodgeAdj || 0;
  base.strikerAtkMul = e.strikerAtkMul || 1.0;
  base.defenderDefMul = e.defenderDefMul || 1.0;
  return base;
}

/* ===== v31: 技能高亮目标系统 =====
   在技能触发时调用，将目标棋子在棋盘上高亮 N 毫秒。
   targets: [{r, c, label, color}] 数组
   durationMs: 高亮持续时间（默认 4000ms） */
function highlightPieces(targets, durationMs){
  if(!targets || !targets.length) return;
  durationMs = durationMs || 4000;
  if(!state.highlightedTargets) state.highlightedTargets = [];
  const expires = Date.now() + durationMs;
  for(const t of targets){
    if(typeof t.r!=='number' || typeof t.c!=='number') continue;
    state.highlightedTargets.push({
      r: t.r, c: t.c,
      label: t.label || '',
      color: t.color || '#b8945a',
      expires: expires
    });
  }
  /* 自动过期清理定时器 */
  setTimeout(()=>{
    if(!state.highlightedTargets) return;
    const now = Date.now();
    state.highlightedTargets = state.highlightedTargets.filter(t=>t.expires>now);
    renderAll();
  }, durationMs + 50);
}

/* ===== 事件绑定 ===== */
document.getElementById('btn-start').addEventListener('click',()=>{
  showScreen('screen-mode');
  if(shouldShowTutorial()){ showTutorial(); }
});

/* 自由对局（PVE 对战B王）解锁判定：需通关故事模式 */
function isStoryCompleted(){
  const progress = parseInt(localStorage.getItem('bky_story_progress')||'1');
  return progress > STORY_CHAPTERS.length;
}
/* v18: 根据故事进度，刷新 PVE / 三英战B王 卡片锁定态
   两者均需通关故事模式后才开放 */
function updateModeLockState(){
  const pveCard = document.querySelector('[data-mode="pve"]');
  if(pveCard){
    if(!isStoryCompleted()){
      pveCard.classList.add('locked');
    } else {
      pveCard.classList.remove('locked');
    }
  }
  const threeCard = document.querySelector('[data-mode="three"]');
  if(threeCard){
    if(!isStoryCompleted()){
      threeCard.classList.add('locked');
    } else {
      threeCard.classList.remove('locked');
    }
  }
}

// 模式选择
let pvpSelectingPlayer=1; // 1=红方选将, 2=黑方选将
let threePicks=[]; // 三英战B王：已选武将列表
document.querySelectorAll('.mode-card').forEach(card=>{
  card.addEventListener('click',()=>{
    const selectedMode=card.dataset.mode;
    /* 暂时封闭的多人模式（功能未完成）：不响应点击 */
    if(card.classList.contains('disabled')) return;
    // 视觉选中态
    document.querySelectorAll('.mode-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    // 非对局模式：角色图鉴 / 故事 / 阵营 直接处理
    if(selectedMode==='codex'){ showCharCodex(); return; }
    if(selectedMode==='story'){ showStoryMenu(); return; }
    /* v18: 阵营对战暂时封闭（即将开放），不再进入 showFormationMenu */
    /* v5.0 4v4 模式：直接进入 4 玩家选将 */
    if(selectedMode==='4v4'){ start4v4Mode(); return; }
    /* v18: PVE 与三英战B王均需通关故事模式 */
    if(selectedMode==='pve' && !isStoryCompleted()){
      return; // 阻止进入（锁定提示由 CSS overlay 呈现）
    }
    if(selectedMode==='three' && !isStoryCompleted()){
      return; // 阻止进入（锁定提示由 CSS overlay 呈现）
    }
    state.gameMode=selectedMode;
    state.storyChapterId=null; /* 非故事模式：清除章节标记，不应用解锁过滤 */
    state.bkingLayer=null; /* v28: 非故事模式清除 B王 层数，避免误用故事难度 */
    if(selectedMode==='online'){ showScreen('screen-network'); }
    else if(selectedMode==='pvp'){
      /* v4.0 PVP Ban 位阶段 */
      pvpBanPhase=0;
      pvpBannedChars=[];
      pvpSelectingPlayer=1;
      startBanPhase();
    }
    else if(selectedMode==='three'){
      threePicks=[];
      document.getElementById('char-select-title').textContent='三英择将';
      document.getElementById('char-select-desc').textContent='选择3位武将轮换对抗B王 · 已选 0/3';
      renderCharacterCards();
      showScreen('screen-character');
    }
    else {
      document.getElementById('char-select-title').textContent='择 将 出 征';
      document.getElementById('char-select-desc').textContent='选择你的化身，踏入棋局 · 各有奇术';
      renderCharacterCards();
      showScreen('screen-character');
    }
  });
});
document.getElementById('mode-back').addEventListener('click',()=>showScreen('screen-welcome'));

/* ===== 角色图鉴 ===== */
/* v30-fix: CODEX_SKILL_LABEL 已废弃（旧 B王技能 mock/reverse/confuse/foresight/seize/swap/domain/selfreverse 全部替换为七宗罪体系）。
   现统一从 DIFFICULTIES[k].skills[i].name 读取，无需 ID→中文 映射。 */
/* 被动触发时机 → 中文标签 */
const CODEX_TRIGGER_LABEL = {
  turn_start:'回合开始', on_capture:'己方吃子', on_captured:'己方被吃',
  on_skill:'释放技能', aura:'光环', periodic:'周期性', immune:'免疫'
};
function showCharCodex(){
  renderCodexGrid();
  document.getElementById('boss-info-overlay').classList.add('show');
}
function renderCodexGrid(){
  const body=document.getElementById('boss-info-body');
  /* 顶部指南卡片 */
  let html='<div class="codex-guide-entries">';
  html+='<div class="codex-guide-card" data-guide="rules"><div class="cg-icon">规</div><div class="cg-name">游戏规则</div><div class="cg-desc">棋盘/兵种/相克/血量体系</div></div>';
  html+='<div class="codex-guide-card" data-guide="flow"><div class="cg-icon">程</div><div class="cg-name">游戏流程</div><div class="cg-desc">模式/选将/对弈/技能选择</div></div>';
  html+='<div class="codex-guide-card" data-guide="bking"><div class="cg-icon">王</div><div class="cg-name">B王技能详解</div><div class="cg-desc">三难度技能池/三英强化/克制法</div></div>';
  html+='<div class="codex-guide-card" data-guide="strategy"><div class="cg-icon">策</div><div class="cg-name">击败B王攻略</div><div class="cg-desc">推荐角色/技能搭配/实战思路</div></div>';
  html+='<div class="codex-guide-card codex-guide-card-help" data-guide="help"><div class="cg-icon">助</div><div class="cg-name">📖 帮助图鉴</div><div class="cg-desc">相克表/英雄类型/buff说明</div></div>';
  html+='</div>';
  html+='<div class="codex-divider"><span>角 色 图 鉴</span></div>';
  html+='<div class="codex-grid">';
  Object.keys(CHARACTERS).forEach(id=>{
    const ch=CHARACTERS[id];
    const isBking = id==='bking';
    html+=`<div class="codex-char${isBking?' codex-char-bking':''}" data-cid="${id}" style="--char-color:${ch.color}">
      <div class="codex-portrait"><div class="codex-portrait-svg">${getPortrait(id,ch.color,ch.glow)}</div></div>
      <div class="codex-name">${ch.name}</div>
      <div class="codex-title">${ch.title}</div>
    </div>`;
  });
  html+='</div>';
  html+='<div class="codex-hint">点击上方指南卡片查看玩法 · 点击角色头像查看技能详解</div>';
  body.innerHTML=html;
  body.querySelectorAll('.codex-guide-card').forEach(el=>{
    el.addEventListener('click',()=>renderGuidePage(el.dataset.guide));
  });
  body.querySelectorAll('.codex-char').forEach(el=>{
    el.addEventListener('click',()=>renderCodexDetail(el.dataset.cid));
  });
}

/* 游戏指南页面 */
function renderGuidePage(guide){
  const body=document.getElementById('boss-info-body');
  let html='<button class="btn-ghost codex-back-btn" id="codex-back">‹ 返回图鉴</button>';
  if(guide==='rules'){
    html+=`<div class="guide-page"><h2 class="guide-title">游戏规则</h2>
    <section class="guide-section"><h3>棋盘布局</h3><p>9×10 标准中国象棋棋盘。红方在底部（第9行），黑方在顶部（第0行）。中间为楚河汉界，两侧九宫格为将/帅活动区域。</p></section>
    <section class="guide-section"><h3>兵种与属性</h3><p>每个棋子拥有<b>血量HP</b>、<b>攻击ATK</b>、<b>防御DEF</b>三项属性，仅进攻方掉血（防守方不损血）。兵种分为五类：</p>
    <ul class="guide-list">
      <li><b>核心（帅/将）</b>：HP ${PIECE_STATS.k.hp} / ATK ${PIECE_STATS.k.atk} / DEF ${PIECE_STATS.k.def} — 被吃即败</li>
      <li><b>进攻（车/马）</b>：车 HP${PIECE_STATS.r.hp}/ATK${PIECE_STATS.r.atk} / 马 HP${PIECE_STATS.h.hp}/ATK${PIECE_STATS.h.atk} — 攻击无视防守方30%防御（破甲）</li>
      <li><b>远程（炮）</b>：HP ${PIECE_STATS.c.hp} / ATK ${PIECE_STATS.c.atk} / DEF ${PIECE_STATS.c.def} — 打非远程不掉血</li>
      <li><b>防守（仕/相）</b>：士 HP${PIECE_STATS.a.hp}/ATK${PIECE_STATS.a.atk}/DEF${PIECE_STATS.a.def}；相 HP${PIECE_STATS.e.hp}/ATK${PIECE_STATS.e.atk}/DEF${PIECE_STATS.e.def} — 被非炮攻击时，攻击方获「虚弱」buff（下回合攻击-30%）</li>
      <li><b>特殊（兵/卒）</b>：HP ${PIECE_STATS.p.hp} / ATK ${PIECE_STATS.p.atk} / DEF ${PIECE_STATS.p.def} — 受非帅非兵攻击只受35%伤害；打帅+50%伤害</li>
    </ul></section>
    <section class="guide-section"><h3>兵种相克</h3><ul class="guide-list">
      <li>炮 打 非远程 → 炮不掉血</li>
      <li>兵 受 非帅攻击 → 只受50%伤害</li>
      <li>非炮 打 仕/相 → 攻击方虚弱（下回合-30%攻）</li>
      <li>兵 打 帅 → +50%伤害</li>
      <li>车/马 攻击 → 无视防守方30%防御</li>
    </ul></section>
    <section class="guide-section"><h3>角色属性加成</h3><p>所选角色的<b>攻/守/谋</b>属性会除以10后加成到己方所有棋子（如攻80 → 棋子ATK+8）。属性越高，棋子战力越强。</p></section>
    <section class="guide-section"><h3>胜负条件</h3><p>吃掉对方帅/将即获胜。帅/将被吃游戏立即结束。</p></section>
    </div>`;
  } else if(guide==='flow'){
    html+=`<div class="guide-page"><h2 class="guide-title">游戏流程</h2>
    <section class="guide-section"><h3>模式选择</h3><ul class="guide-list">
      <li><b>对战B王</b>：PVE，需通关故事模式解锁。三难度（青铜/钻石/王者）</li>
      <li><b>双人对战</b>：PVP，同设备轮流。支持Ban位禁用角色</li>
      <li><b>联机对战</b>：WebRTC P2P 联机，生成邀请码加入</li>
      <li><b>三英战B王</b>：三将自动轮换共抗强化B王，需通关故事模式</li>
      <li><b>故事模式</b>：${STORY_CHAPTERS.length}章剧情，逐章解锁角色。初始仅第1章角色可选</li>
    </ul></section>
    <section class="guide-section"><h3>选将流程</h3><ol class="guide-list">
      <li>选择模式 → 进入选将屏</li>
      <li>PVP模式：双方先Ban位禁用角色，再依次选将</li>
      <li>点击角色卡片查看详情：背景/奇术/属性/台词/被动</li>
      <li>从<b>主动技能中选1个</b>（普通角色）或选3个（B王） + 从<b>被动技能中选1或2个</b>（数量>2时选2）</li>
      <li>确认选将 → 进入对弈</li>
    </ol></section>
    <section class="guide-section"><h3>对弈操作</h3><ul class="guide-list">
      <li><b>点击己方棋子</b>：选中并显示可走位置（绿色）与可吃位置（红色）</li>
      <li><b>点击目标格</b>：移动或攻击</li>
      <li><b>点击对方棋子</b>：查看其属性和buff状态（inspect模式）</li>
      <li><b>释放技能</b>：点击右下角技能按钮（CD就绪时高亮）</li>
      <li><b>悔棋</b>：人机撤销两步，双人撤销一步</li>
      <li><b>存档</b>：对局中随时可存档</li>
    </ul></section>
    <section class="guide-section"><h3>技能系统</h3><p>每个角色有主动技能（普通角色选1个，B王选3个）和被动技能（数量>2时选2个，否则选1个）。主动技能需冷却（CD 2-7回合），被动技能自动触发（光环/被吃/吃子/周期/首回合/免疫）。</p>
    <p><b>玩家技能</b>：主动技能由玩家手动释放，PVE中作用于AI，PVP中作用于对手。</p>
    <p><b>B王技能</b>：B王是<b>双形态角色</b>。作AI对手时（PVE/三英）按难度自动释放技能；作玩家角色时（PVP/故事通关后可选）可手动释放其${CHARACTERS.bking.actives.length}个主动技能（七宗罪）。详见"B王技能详解"。</p></section>
    <section class="guide-section"><h3>故事模式解锁</h3><p>初始仅第1章角色可选，每通关一章解锁新角色。全部通关后解锁隐藏角色：B王、仙帝Alice、大爱仙尊（古月方源）。</p></section>
    </div>`;
  } else if(guide==='bking'){
    html+=`<div class="guide-page"><h2 class="guide-title">B王技能详解</h2>
    <p class="guide-note">B王是<b>双形态角色</b>：<br>· <b>AI形态</b>（PVE/三英战B王）：按下方三难度技能池自动释放，玩家无法干预。<br>· <b>玩家形态</b>（PVP/故事通关后）：选将时可从${CHARACTERS.bking.actives.length}个主动技能（七宗罪）中选3个 + ${CHARACTERS.bking.passives.length}个被动中选2个手动释放。<br>下方为<b>AI形态技能池</b>（按难度分级），含每个技能的完整效果说明。</p>`;
    Object.keys(DIFFICULTIES).forEach(k=>{
      const d=DIFFICULTIES[k];
      /* v30-fix: 移除 CODEX_SKILL_LABEL 引用（已废弃，引用会抛 ReferenceError）。
         d.skills 数组每项已包含完整 name/desc，直接读取即可。
         若某项缺 name（异常情况），回退到中文「未知技能」而非英文 ID。 */
      const pool=d.skills.map(s=>{
        const nm=s.name||'未知技能';
        const ds=s.desc||'';
        const tag=s.target==='all'?' [全范围]':' [单体]';
        return `<b>${nm}</b>${tag}：${ds}`;
      }).join('<br>');
      html+=`<section class="guide-section"><h3>${d.name} · ${d.title}（AI自动释放）</h3>
      <p>思考深度 ${d.depth} · 技能释放概率 ${Math.round(d.skillChance*100)}% · 被动 ${d.bkingPassives.length}个</p>
      <p class="guide-skill-pool">${pool}</p></section>`;
    });
    html+=`<section class="guide-section"><h3>玩家形态 · ${CHARACTERS.bking.actives.length}个主动技能（七宗罪）</h3>
    <p class="guide-note">PVP/故事通关后选B王时，从以下${CHARACTERS.bking.actives.length}个主动技能中选3个手动释放：</p>
    <p class="guide-skill-pool">${(CHARACTERS.bking.skills||CHARACTERS.bking.actives||[]).map(s=>`<b>${s.name}</b>（CD ${s.cd}）：${s.desc}`).join('<br>')}</p></section>`;
    /* v22: 整合 B王所有被动到统一章节，按难度递进展示 */
    html+=`<section class="guide-section"><h3>B王被动技能全览（按难度/模式递进）</h3>`;
    html+=`<p class="guide-skill-pool"><b>青铜装（PVE简单）：</b>${CHARACTERS.bking.passives[0].name}（${CODEX_TRIGGER_LABEL[CHARACTERS.bking.passives[0].trigger]||CHARACTERS.bking.passives[0].trigger}）：${CHARACTERS.bking.passives[0].desc}</p>`;
    html+=`<p class="guide-skill-pool"><b>钻石装（PVE中等）：</b>${CHARACTERS.bking.passives.map(p=>`${p.name}（${CODEX_TRIGGER_LABEL[p.trigger]||p.trigger}）：${p.desc}`).join('；')}</p>`;
    html+=`<p class="guide-skill-pool"><b>王者装（PVE困难）：</b>${CHARACTERS.bking.passives.map(p=>`${p.name}（${CODEX_TRIGGER_LABEL[p.trigger]||p.trigger}）：${p.desc}`).join('；')}；${BKING_EXTRA_PASSIVE.name}（${CODEX_TRIGGER_LABEL[BKING_EXTRA_PASSIVE.trigger]||BKING_EXTRA_PASSIVE.trigger}）：${BKING_EXTRA_PASSIVE.desc}</p>`;
    const thb=THREE_HEROES_BKING;
    html+=`<p class="guide-skill-pool"><b>三英战B王（极限强化）：</b>思考深度 ${thb.depth}（+2） · 技能释放概率 ${Math.round(thb.skillChance*100)}% · 每${thb.comboTurns}回合连环双杀 · 被吃${Math.round(thb.revengeChance*100)}%反吃<br>${CHARACTERS.bking.passives.map(p=>`${p.name}：${p.desc}`).join('；')}；${BKING_EXTRA_PASSIVE.name}：${BKING_EXTRA_PASSIVE.desc}；${thb.extraPassives.map(p=>`${p.name}（${CODEX_TRIGGER_LABEL[p.trigger]||p.trigger}）：${p.desc}`).join('；')}</p>`;
    html+=`</section>`;
    html+=`<section class="guide-section"><h3>B王阵营说明</h3><p>B王阵营已移除鸡哥，主动技能扩展至7个（七宗罪）。B王技能在被刘雪沛·破妄之眼沉默时<b>禁用</b>。</p></section>`;
    html+='</div>';
  } else if(guide==='strategy'){
    html+=`<div class="guide-page"><h2 class="guide-title">击败B王攻略</h2>
    <section class="guide-section"><h3>核心克制角色</h3><ul class="guide-list">
      <li><b>刘雪沛 · 破妄之眼</b>（首选）：沉默B王3回合，期间B王所有技能禁用。被动「宿敌」对B王伤害+50%。<b>最稳克制</b></li>
      <li><b>仙帝Alice · 仙帝降临</b>：3步回溯+下回合无敌+AI走步预览。被动「仙帝威压」使B王技能CD+1、释放概率-15%。<b>最强压制</b></li>
      <li><b>大爱仙尊（古月方源）· 大爱无疆</b>：感化敌方最强子为己用（阵营反转）。「噬蛊祭道」真实伤害+「算计连环」标记猎物。<b>以敌制敌</b></li>
      <li><b>解宇轩 · 因果律锁</b>：锁定B王强子3回合，限制其走位</li>
    </ul></section>
    <section class="guide-section"><h3>技能搭配推荐</h3><ul class="guide-list">
      <li><b>沉默流</b>：刘雪沛·破妄之眼（主动）+ 宿敌（被动）→ 沉默期间疯狂进攻</li>
      <li><b>回溯流</b>：仙帝Alice·仙帝降临 + 仙帝威压 → 反悔+预判+压制B王技能</li>
      <li><b>感化流</b>：古月方源·大爱无疆 + 蛊师本能 → 持续削弱B王战力</li>
      <li><b>反吃流</b>：唐昊博涵·翻书作弊 + 满分光环 → 预判+无敌+炮马强化</li>
    </ul></section>
    <section class="guide-section"><h3>实战思路</h3><ol class="guide-list">
      <li><b>开局</b>：优先用车/马压制中路，炮控制中线。避免贸然进攻暴露破绽</li>
      <li><b>中期</b>：等B王技能CD时发动进攻。若选刘雪沛，沉默B王后立即全线推进</li>
      <li><b>残局</b>：B王剩余棋子少时，用车/炮远程消耗。注意B王「反吃」被动（三英模式）</li>
      <li><b>终局</b>：用兵/卒贴脸打帅（兵打帅+50%伤害）。或用车/马破甲强攻</li>
    </ol></section>
    <section class="guide-section"><h3>难度应对</h3><ul class="guide-list">
      <li><b>青铜装</b>：B王仅会「傲慢·目中无人」（对方全体棋子攻击-25%）。正常对弈即可</li>
      <li><b>钻石装</b>：B王会「傲慢」+「贪婪·夺人所爱」（窃取永久buff+回血）+「懒惰·拖泥带水」（移动力≤1+攻击-20%）。建议选刘雪沛沉默</li>
      <li><b>王者装</b>：B王再加「嫉妒·东施效颦」（复制你的被动）+「暴怒·怒火中烧」（攻击+50%+真伤）。务必选沉默或回溯角色</li>
    </ul></section>
    <section class="guide-section"><h3>三英模式要点</h3><ul class="guide-list">
      <li>B王极大幅度强化（思考深度+2，每${THREE_HEROES_BKING.comboTurns}回合连环双杀，被吃${Math.round(THREE_HEROES_BKING.revengeChance*100)}%反吃）</li>
      <li>三将<b>自动轮换</b>，轮换时buff随之改变</li>
      <li>建议选<b>沉默+回溯+感化</b>组合：刘雪沛+仙帝Alice+古月方源</li>
      <li>注意：三英模式禁选B王（避免逻辑悖论）</li>
    </ul></section>
    </div>`;
  } else if(guide==='help'){
    html+=renderCodexHelpContent();
  }
  body.innerHTML=html;
  const backBtn=document.getElementById('codex-back');
  if(backBtn) backBtn.addEventListener('click',renderCodexGrid);
}

/* ===== v28: 帮助图鉴 — 兵种相克表 / 英雄类型 / buff说明 / 战斗规则 ===== */

/* 角色英雄类型信息聚合：返回 label/key/role/bonusText/tier/recommend/tip
   依据 HERO_TYPE_BONUS（data.js）和 stats 计算 tier（S+/S/A/B） */
function getHeroTypeInfo(ch){
  if(!ch || !ch.heroType || typeof HERO_TYPE === 'undefined') return null;
  const t = ch.heroType;
  let label, key, role, bonusText, recommend, tip;
  if(t === HERO_TYPE.STRENGTH){
    key='strength'; label='力量系'; role='坦克/战士';
    bonusText='HP +25% · 防御 +15% · 反击伤害 +20%';
    recommend='车 / 兵（高 HP 加成 + 反击强，贴身肉搏压制）';
    tip='利用高 HP 和反击打消耗战，用车一击必杀或兵贴脸打帅；适合主动换子。';
  } else if(t === HERO_TYPE.AGILITY){
    key='agility'; label='敏捷系'; role='刺客/输出';
    bonusText='攻击 +20% · 移速 +1 · 闪避 10%';
    recommend='马 / 炮（高 atk 加成 + 移速 + 闪避，快速突击）';
    tip='脆皮高爆发，用马跳跃杀+15 真伤或炮远程穿透；避免被车一击必杀。';
  } else if(t === HERO_TYPE.INTELLECT){
    key='intellect'; label='智力系'; role='法师/辅助';
    bonusText='技能伤害 +50% · CD -1 · 普攻附带 int×0.3 真伤';
    recommend='炮 / 帅（技能爆发 + CD 短，远程或核心辅助）';
    tip='技能爆发强，主动技能 CD 短可频繁释放；多用技能而非纯普攻。';
  } else {
    return null;
  }
  /* 梯度评级：综合三系属性 + 英雄类型加成估算
     总分 = atk + def + int；阈值：>=240 S+ / >=220 S / >=200 A / 否则 B
     力量系额外 +10（HP/def 加成估值），敏捷系 +5（atk/闪避），智力系 +8（技能+CDR） */
  const total = (ch.stats.atk||0) + (ch.stats.def||0) + (ch.stats.int||0);
  const bonus = key==='strength'?10:(key==='intellect'?8:(key==='agility'?5:0));
  const score = total + bonus;
  let tier;
  if(score >= 240) tier='S+';
  else if(score >= 220) tier='S';
  else if(score >= 200) tier='A';
  else tier='B';
  return { key, label, role, bonusText, tier, recommend, tip };
}

function renderCodexHelpContent(){
  /* 兵种相克表 7×7（行=防守方，列=攻击方）
     规则依据 engine.js calcDamage：车一击必杀+自损、马真伤+不反击、炮加成+破防、
     士反击+50%、相反制概率、兵受50%减伤+打帅+50%、帅受非兵-30%+临终反伤50 */
  const pieceLabels=['车','马','炮','士','相','兵','帅'];
  /* matrix[防守][攻击] = 描述 */
  const matrix=[
    ['—','普通','不掉血','普通','普通','普通','普通'],         /* 车 */
    ['普通','—','不掉血','普通','普通','普通','普通'],         /* 马 */
    ['互射','互射','互射','不掉血','不掉血','普通','普通'],     /* 炮（炮打炮互射） */
    ['自损减半','被反击','不掉血','反击+50%','普通','普通','普通'], /* 士 */
    ['自损减半','不反击','不掉血','普通','普通','普通','普通'],   /* 相 */
    ['一击必杀','普通','减50%','普通','普通','—','+50%'],       /* 兵 */
    ['40%maxHp','减30%','减30%','反伤50','反伤50','+50%','—']   /* 帅 */
  ];
  let html=`<div class="guide-page"><h2 class="guide-title">📖 帮助图鉴</h2>`;

  /* 1. 兵种相克表 */
  html+=`<section class="guide-section"><h3>兵种相克表（行=防守方，列=攻击方）</h3>
  <div class="codex-matrix-wrap">
    <table class="codex-matrix">
      <thead><tr><th>防守 \\ 攻击</th>`;
  pieceLabels.forEach(l=>{ html+=`<th>${l}</th>`; });
  html+=`</tr></thead><tbody>`;
  for(let r=0;r<7;r++){
    html+=`<tr><th>${pieceLabels[r]}</th>`;
    for(let c=0;c<7;c++){
      const cell=matrix[r][c];
      const cls=cell==='—'?'mtx-na':(cell.indexOf('一击')>=0||cell.indexOf('+50')>=0?'mtx-strong':(cell.indexOf('不掉')>=0||cell.indexOf('减')>=0||cell.indexOf('反伤')>=0?'mtx-weak':'mtx-normal'));
      html+=`<td class="${cls}">${cell}</td>`;
    }
    html+=`</tr>`;
  }
  html+=`</tbody></table></div>
  <p class="guide-note">说明：车一击必杀（士/相减半、帅仅受 40%maxHp）并自损 20%maxHp；马附带 15 真实伤害且不触发反击；炮打非远程不掉血、伤害 ×1.2、无视 50% 防御；士反击伤害 ×1.5；相 30% 概率反弹 20% 伤害；兵受非帅非兵攻击 -50% 伤害、打帅 +50%；帅受非兵攻击 -30% 伤害并临终反伤 50 点。</p>
  </section>`;

  /* 2. 英雄类型说明 */
  html+=`<section class="guide-section"><h3>英雄类型说明（Dota2 风格三系）</h3>
  <div class="hero-type-grid">
    <div class="hero-type-card hero-type-strength">
      <div class="ht-icon">力</div>
      <div class="ht-name">力量系</div>
      <div class="ht-role">坦克 / 战士</div>
      <ul class="ht-bonus">
        <li>HP <b>+25%</b></li>
        <li>防御 <b>+15%</b></li>
        <li>反击伤害 <b>+20%</b></li>
      </ul>
      <div class="ht-tip">贴身肉搏强，适合车/兵压制</div>
    </div>
    <div class="hero-type-card hero-type-agility">
      <div class="ht-icon">敏</div>
      <div class="ht-name">敏捷系</div>
      <div class="ht-role">刺客 / 输出</div>
      <ul class="ht-bonus">
        <li>攻击 <b>+20%</b></li>
        <li>移速 <b>+1</b></li>
        <li>闪避 <b>+10%</b></li>
      </ul>
      <div class="ht-tip">脆皮高爆发，适合马/炮突击</div>
    </div>
    <div class="hero-type-card hero-type-intellect">
      <div class="ht-icon">智</div>
      <div class="ht-name">智力系</div>
      <div class="ht-role">法师 / 辅助</div>
      <ul class="ht-bonus">
        <li>技能伤害 <b>+50%</b></li>
        <li>技能 CD <b>-1</b></li>
        <li>普攻附带 <b>int×0.3</b> 真伤</li>
      </ul>
      <div class="ht-tip">技能爆发强，多用主动技能</div>
    </div>
  </div>
  <p class="guide-note">英雄类型在 createPiece 时应用：力量系 hpMul×1.25 / defMul×1.15；敏捷系 atkMul×1.2 / 闪避 10% / 马兵额外移动力 +1；智力系 skillDmgMul×1.5 / cdReduce=1 / 普攻附带 int×0.3 真实伤害。</p>
  </section>`;

  /* 3. buff 类型说明 */
  html+=`<section class="guide-section"><h3>buff 类型说明</h3>
  <table class="codex-buff-table">
    <thead><tr><th>buff</th><th>类型</th><th>效果</th></tr></thead>
    <tbody>
      <tr><td><b>虚弱</b></td><td>攻击向</td><td>攻击力 ×(1-value)，默认 -30%。非炮打仕/相时攻击方获得</td></tr>
      <tr><td><b>attackBoost</b></td><td>攻击向</td><td>攻击力 +value（默认 +20）</td></tr>
      <tr><td><b>executeMark</b></td><td>攻击向</td><td>必中且伤害 ×(1+value)，默认 +50%。命中后消耗</td></tr>
      <tr><td><b>pierce 破甲</b></td><td>攻击向</td><td>禁用守方 ironwall / defenseBoost（基础防御仍生效）</td></tr>
      <tr><td><b>bkiller</b></td><td>攻击向</td><td>对 B王 阵营伤害 +value（默认 +50%）</td></tr>
      <tr><td><b>ironwall</b></td><td>防御向</td><td>防御 ×2</td></tr>
      <tr><td><b>defenseBoost</b></td><td>防御向</td><td>防御 +value（默认 +20）</td></tr>
      <tr><td><b>shield 护盾</b></td><td>防御向</td><td>吸收 value 伤害（默认 80），仅挡常规伤害</td></tr>
      <tr><td><b>immune 免疫</b></td><td>防御向</td><td>免疫所有常规伤害（马真伤仍生效）</td></tr>
      <tr><td><b>defReduce</b></td><td>防御向</td><td>防御按比例降低（默认 -30%）</td></tr>
      <tr><td><b>vulnerability 易伤</b></td><td>防御向</td><td>受到的伤害 ×(1+value)，默认 +50%。命中后消耗</td></tr>
      <tr><td><b>reflect 反伤</b></td><td>防御向</td><td>反弹受到伤害的 value 比例（默认 30%）</td></tr>
    </tbody>
  </table>
  <p class="guide-note">注：马(h)的真实伤害无视 shield / immune；shield 仅吸收常规伤害；executeMark 与 vulnerability 在攻击命中后消耗。</p>
  </section>`;

  /* 4. 战斗规则要点（v36 数值同步更新） */
  html+=`<section class="guide-section"><h3>战斗规则要点（v36 兵种差异化）</h3>
  <ul class="guide-list">
    <li><b>车一击必杀</b>：车攻击 defenderDmg = 守方 maxHp（无视防御）；士/相仅受 50%maxHp，帅仅受 40%maxHp；车自损 30%maxHp</li>
    <li><b>马真实伤害</b>：马攻击附带 20 真伤，不被 shield / immune 免疫；马跳跃攻击不触发反击；马对炮半反击（×0.5）</li>
    <li><b>炮远程穿透</b>：炮伤害 ×1.1，无视防守方 40% 防御；炮打非远程不掉血（马例外）</li>
    <li><b>仕/相虚弱</b>：非炮打仕/相，攻击方获「虚弱」buff（下回合 -30% 攻）</li>
    <li><b>士·贴身肉搏</b>：士反击伤害 ×1.5（v28 强化护卫特色）</li>
    <li><b>相·反制概率</b>：相 30% 概率反弹 20% 伤害（独立于 reflect buff）</li>
    <li><b>兵·普攻强化</b>：兵攻击时 atk +15%；兵受非帅非兵攻击 -35% 伤害；兵反击伤害 ×0.3；兵打帅 +50% 伤害</li>
    <li><b>车·破釜沉舟</b>：车 HP&lt;30% 时 atk +30%（残血爆发）</li>
    <li><b>帅·临终反击</b>：帅被攻击时攻击方受 50 点反伤（不被 shield 吸收）；帅受非兵攻击 -30% 伤害</li>
    <li><b>反击规则</b>：仅 core / defender / special 反击；马对炮例外（×0.5）；马跳跃 / 相斜走攻击不触发反击</li>
  </ul>
  </section>`;

  /* 5. B王 ${Object.keys(BKING_LAYERS).length} 层难度详情（动态生成） */
  if(typeof BKING_LAYERS !== 'undefined'){
    const layerCount = Object.keys(BKING_LAYERS).length;
    /* 计算每层加成百分比（基于第1层基准） */
    const firstLayer = BKING_LAYERS[1];
    const maxHpBonus = Math.round((BKING_LAYERS[layerCount].hpMul - firstLayer.hpMul) * 100);
    html+=`<section class="guide-section"><h3>B王 ${layerCount} 层难度详情（故事模式递增）</h3>
    <p class="boss-diff-info">每层属性加成递增（最高层 +${maxHpBonus}%），高层解锁更多主动/被动技能。</p>`;
    Object.keys(BKING_LAYERS).forEach(k=>{
      const L=BKING_LAYERS[k];
      const hpBonus = Math.round((L.hpMul - firstLayer.hpMul) * 100);
      html+=`<div class="boss-diff-block">
        <h4 class="boss-diff-title">第 ${k} 层 · ${L.name} · ${L.title}</h4>
        <p class="boss-diff-info">HP ×${L.hpMul}（+${hpBonus}%）· atk ×${L.atkMul} · def ×${L.defMul} · 思考深度 ${L.depth} · 释放概率 ${Math.round(L.skillChance*100)}%</p>
        <p class="guide-skill-pool"><b>主动 (${L.actives.length})：</b>${L.actives.join('、')||'无'}<br><b>被动 (${L.passives.length})：</b>${L.passives.join('、')||'无'}</p>
      </div>`;
    });
    /* 动态生成章节映射：根据 STORY_CHAPTERS 中的 bkingLayer 字段 */
    const chapterLayerMap = {};
    STORY_CHAPTERS.forEach(ch => {
      const layer = ch.bkingLayer || 1;
      if(!chapterLayerMap[layer]) chapterLayerMap[layer] = [];
      chapterLayerMap[layer].push(ch.id);
    });
    const mapDesc = Object.keys(chapterLayerMap).map(layer => {
      const chapters = chapterLayerMap[layer];
      const range = chapters.length > 1 ? `${chapters[0]}-${chapters[chapters.length-1]}` : `${chapters[0]}`;
      return `第${range}章→${layer}层`;
    }).join(' / ');
    html+=`<p class="guide-note">章节映射：${mapDesc}。非故事模式（PVE/PVP/三英）不受此层数影响。</p>
    </section>`;
  }

  html+=`</div>`;
  return html;
}
function renderCodexDetail(cid){
  const ch=CHARACTERS[cid];
  if(!ch) return;
  const body=document.getElementById('boss-info-body');
  const trig=(t)=>CODEX_TRIGGER_LABEL[t]||t;
  /* AI专属/玩家可选 标识 */
  const isBking = cid==='bking';
  const roleTag = isBking
    ? '<span class="codex-ai-tag">双形态 · AI/玩家均可</span>'
    : '<span class="codex-player-tag">玩家可选</span>';
  /* v28: 英雄类型标签 + 加成 + 评级 + 推荐 + 建议 */
  const heroTypeInfo = getHeroTypeInfo(ch);
  const heroTypeTag = heroTypeInfo
    ? `<span class="codex-herotype-tag codex-herotype-${heroTypeInfo.key}">${heroTypeInfo.label}</span>`
    : '';
  let html='<button class="btn-ghost codex-back-btn" id="codex-back">‹ 返回列表</button>';
  html+=`<div class="codex-detail-head" style="--char-color:${ch.color}">
    <div class="codex-detail-portrait"><div class="codex-portrait-svg">${getPortrait(cid,ch.color,ch.glow)}</div></div>
    <div class="codex-detail-info">
      <h3 class="codex-detail-name">${ch.name}${roleTag}${heroTypeTag}</h3>
      <div class="codex-detail-title">${ch.title}</div>
      <p class="codex-detail-desc">${ch.desc}</p>
    </div>
  </div>`;
  /* v11: 奇术展示全部主动技能（B王5个，其他角色3个） */
  let skillList;
  if(cid==='bking' && ch.skills && ch.skills.length){
    skillList = ch.skills;  /* B王展示全部 */
  } else if(ch.actives && ch.actives.length){
    skillList = ch.actives;  /* 其他角色展示3主动 */
  } else {
    skillList = [ch.skill];  /* 兼容旧数据 */
  }
  const skillTitle = isBking
    ? `奇术 · 共 ${skillList.length} 个（玩家PVP选3个）`
    : `奇术 · 共 ${skillList.length} 个（3选1）`;
  html+=`<div class="boss-section"><h3>${skillTitle}</h3>`;
  skillList.forEach((s,i)=>{
    const tag = s.target==='aoe' ? '<span class="sk-tag">全范围</span>' : '<span class="sk-tag">单体</span>';
    html+=`<div class="boss-skill-card"><span class="sk-name">${s.name}</span>${tag}<span class="sk-diff">冷却 ${s.cd} 回合</span>
    <div class="sk-desc">${s.desc}</div></div>`;
  });
  html+='</div>';
  /* 被动 — v35: 动态显示选择数量 */
  const passivePickCount = ch.passives.length>2 ? 2 : 1;
  const passiveTitle = isBking
    ? `被动技能 · 共 ${ch.passives.length} 个`
    : `被动技能 · 共 ${ch.passives.length} 个（选${passivePickCount}个）`;
  html+=`<div class="boss-section"><h3>${passiveTitle}</h3>`;
  ch.passives.forEach(p=>{
    html+=`<div class="boss-passive-card"><b>${p.name}</b> · ${trig(p.trigger)}：${p.desc}</div>`;
  });
  html+='</div>';
  /* 属性 */
  html+=`<div class="boss-section"><h3>属性</h3><div class="codex-stats">
    <div class="codex-stat"><span class="cs-label">攻</span><b>${ch.stats.atk}</b></div>
    <div class="codex-stat"><span class="cs-label">守</span><b>${ch.stats.def}</b></div>
    <div class="codex-stat"><span class="cs-label">谋</span><b>${ch.stats.int}</b></div>
  </div></div>`;
  /* v28: 英雄类型 + 加成 + 梯度评级 + 擅长兵种 + 使用建议 */
  if(heroTypeInfo){
    html+=`<div class="boss-section"><h3>英雄类型 · ${heroTypeInfo.label}（${heroTypeInfo.role}）</h3>
    <div class="codex-herotype-detail">
      <div class="codex-ht-row"><span class="codex-ht-label">类型加成</span><span class="codex-ht-value">${heroTypeInfo.bonusText}</span></div>
      <div class="codex-ht-row"><span class="codex-ht-label">梯度评级</span><span class="codex-ht-value codex-tier-${heroTypeInfo.tier}">${heroTypeInfo.tier}</span></div>
      <div class="codex-ht-row"><span class="codex-ht-label">擅长兵种</span><span class="codex-ht-value">${heroTypeInfo.recommend}</span></div>
      <div class="codex-ht-row"><span class="codex-ht-label">使用建议</span><span class="codex-ht-value">${heroTypeInfo.tip}</span></div>
    </div></div>`;
  }
  /* 台词 */
  if(ch.skillLines&&ch.skillLines.length){
    html+='<div class="boss-section"><h3>台词</h3><div class="codex-lines">';
    ch.skillLines.slice(0,4).forEach(line=>{ html+=`<div class="codex-line">"${line}"</div>`; });
    html+='</div></div>';
  }
  /* B王专属：v30 难度分层（七宗罪觉醒）+ 玩家形态说明 + 克制策略 */
  if(cid==='bking'){
    /* v30: 基于 BKING_LAYERS 动态生成难度分层展示，
       不再引用旧的 DIFFICULTIES/BKING_EXTRA_PASSIVE/THREE_HEROES_BKING */
    const findSkill = (id) => ch.skills.find(s=>s.id===id) || ch.actives.find(s=>s.id===id);
    const findPassive = (id) => ch.passives.find(p=>p.id===id);
    html+='<div class="boss-section"><h3>B王难度分层 · 七宗罪逐步觉醒</h3>';
    html+='<p class="boss-diff-info">故事模式随章节递增，B王逐步觉醒七宗罪。非故事模式（PVE/PVP/三英）保持原难度逻辑，不受此分层影响。</p>';
    Object.keys(BKING_LAYERS).forEach(k=>{
      const layer=BKING_LAYERS[k];
      const activesHTML=layer.actives.map(id=>{
        const s=findSkill(id);
        if(!s) return '';
        const tag=(s.target==='all'||s.target==='aoe')?'全范围':'单体';
        return `<div class="boss-skill-card"><span class="sk-name">${s.name}</span><span class="sk-tag">${tag}</span><span class="sk-diff">冷却 ${s.cd} 回合</span><div class="sk-desc">${s.desc}</div></div>`;
      }).join('');
      const passivesHTML=layer.passives.map(id=>{
        const p=findPassive(id);
        if(!p) return '';
        return `<div class="boss-passive-card"><b>${p.name}</b> · ${trig(p.trigger)}：${p.desc}</div>`;
      }).join('');
      html+=`<div class="boss-diff-block"><h4 class="boss-diff-title">${layer.name} · ${layer.title}</h4>
      <p class="boss-diff-info">HP ×${layer.hpMul} · 攻击 ×${layer.atkMul} · 防御 ×${layer.defMul} · 思考深度 ${layer.depth} · 释放概率 ${Math.round(layer.skillChance*100)}% · 主动 ${layer.actives.length}个 · 被动 ${layer.passives.length}个</p>
      <div class="boss-passive-group"><h4 class="boss-diff-title">可用主动（${layer.actives.length}）</h4>${activesHTML}</div>
      <div class="boss-passive-group"><h4 class="boss-diff-title">可用被动（${layer.passives.length}）</h4>${passivesHTML}</div>
      </div>`;
    });
    html+='</div>';
    /* 玩家形态说明 */
    html+=`<div class="boss-section"><h3>玩家形态说明（PVP/故事通关后）</h3>
      <div class="boss-skill-card"><div class="sk-desc">玩家形态（PVP）：选将时从7个主动中选3个，从5个被动中选2个。技能效果与AI形态相同。</div></div></div>`;
    /* 克制策略（静态文本，保持不变） */
    html+='<div class="boss-section"><h3>克制策略</h3><div class="boss-counter">';
    html+='<p><b>刘雪沛·破妄之眼</b>：沉默B王3回合，对B王伤害+50%</p>';
    html+='<p><b>仙帝Alice·天罚</b>：剥夺B王最强子+命定3步+剥夺被动2回合</p>';
    html+='<p><b>大爱仙尊（古月方源）·大爱无疆</b>：感化敌方最强子为己用（阵营反转）+噬蛊祭道真实伤害+算计连环标记猎物</p>';
    html+='<p><b>解宇轩·因果律锁</b>：锁定B王强子3回合</p>';
    html+='</div></div>';
  }
  body.innerHTML=html;
  const backBtn=document.getElementById('codex-back');
  if(backBtn) backBtn.addEventListener('click',renderCodexGrid);
}
document.getElementById('btn-boss-close').addEventListener('click',()=>{
  document.getElementById('boss-info-overlay').classList.remove('show');
});
document.getElementById('boss-info-overlay').addEventListener('click',(e)=>{
  if(e.target.id==='boss-info-overlay') e.currentTarget.classList.remove('show');
});

/* ===== v4.0 故事模式 ===== */
let storyProgress = parseInt(localStorage.getItem('bky_story_progress')||'1');
function showStoryMenu(){
  const body=document.getElementById('story-body');
  let html='';
  STORY_CHAPTERS.forEach(ch=>{
    const locked = ch.id>storyProgress;
    html+=`<div class="story-chapter${locked?' locked':''}" data-ch="${ch.id}">`;
    html+=`<h4>${ch.title}${locked?' 🔒':''}</h4><p>${ch.desc}</p>`;
    if(ch.reward){
      html+=`<p class="story-unlock">${ch.reward}</p>`;
    }
    html+=`</div>`;
  });
  body.innerHTML=html;
  document.getElementById('story-nav').innerHTML=`<button class="btn-ghost" id="story-close-2">返回</button>`;
  document.getElementById('story-close-2').addEventListener('click',()=>{
    document.getElementById('story-overlay').classList.remove('show');
    showScreen('screen-mode');
  });
  document.querySelectorAll('.story-chapter').forEach(el=>{
    el.addEventListener('click',()=>{
      const chId=parseInt(el.dataset.ch);
      if(chId>storyProgress) return;
      startStoryChapter(chId);
    });
  });
  document.getElementById('story-overlay').classList.add('show');
}
function startStoryChapter(chId){
  const ch=STORY_CHAPTERS.find(c=>c.id===chId);
  if(!ch) return;
  /* v40 修复: 从「下一章」按钮调用时 story-overlay 是隐藏的，必须显示 */
  document.getElementById('story-overlay').classList.add('show');
  /* 展示剧情 */
  const body=document.getElementById('story-body');
  let html=`<div class="boss-section"><h3>${ch.title}</h3><p style="font-size:13px;color:var(--ink-soft)">${ch.desc}</p></div>`;
  html+='<div class="boss-section"><h3>剧情</h3>';
  /* v10: intro 兼容字符串与数组两种形式 */
  const introLines = Array.isArray(ch.intro) ? ch.intro : [ch.intro];
  introLines.forEach(line=>{ html+=`<div class="story-intro-line">${line}</div>`; });
  /* v31: 渲染多角色剧情对话（introDialog） */
  if(ch.introDialog && ch.introDialog.length>0){
    html+='<div class="story-dialog-container">';
    ch.introDialog.forEach(dialog=>{
      const isBking = dialog.speaker==='B王';
      const speakerClass = isBking ? 'story-speaker-bking' : 'story-speaker-self';
      html+=`<div class="story-dialog ${speakerClass}">
        <span class="story-speaker">${dialog.speaker}：</span>
        <span class="story-text">${dialog.text}</span>
      </div>`;
    });
    html+='</div>';
  }
  if(ch.reward){
    html+=`<div class="story-intro-line" style="color:var(--vermillion)">奖励：${ch.reward}</div>`;
  }
  html+='</div>';
  document.getElementById('story-nav').innerHTML=`<button class="btn-ghost" id="story-back-list">返回章节</button><button class="btn-primary" id="story-start">开始战斗</button>`;
  body.innerHTML=html;
  document.getElementById('story-back-list').addEventListener('click',showStoryMenu);
  document.getElementById('story-start').addEventListener('click',()=>{
    document.getElementById('story-overlay').classList.remove('show');
    /* 进入战斗：v10 使用 aiDifficulty/aiChar 字段（兼容旧 difficulty/enemy） */
    state.gameMode = ch.threeHeroes?'three':'pve';
    state.difficulty = ch.aiDifficulty || ch.difficulty || 'medium';
    state.storyChapterId = chId;
    /* v28: B王难度 N 层系统 — 故事模式按章节设置 B王 层数
       优先用章节定义的 bkingLayer，否则按章节 id 推算 */
    state.bkingLayer = ch.bkingLayer || (typeof getBkingLayerForChapter==='function' ? getBkingLayerForChapter(chId) : 1);
    if(ch.threeHeroes){
      threePicks=[];
      document.getElementById('char-select-title').textContent=ch.title+' · 三英择将';
      document.getElementById('char-select-desc').textContent='选择3位武将讨伐B王极限形态';
      renderCharacterCards();
      showScreen('screen-character');
    } else if(ch.playerChar){
      /* v39: 章节指定角色 — 角色已由剧情指定，但技能选择仍需玩家操作
         v40 修复: 改为弹出技能选择面板（原直接 confirmCharacterSelect 跳过技能选择） */
      const pc = ch.playerChar;
      const pcChar = CHARACTERS[pc];
      if(pcChar){
        /* 若该角色尚未配置技能选择，初始化为默认索引 0 */
        if(!skillState.selected[pc]){
          skillState.selected[pc] = { active:0, passive:0 };
        }
        /* 短暂延迟让 story-overlay 完成淡出，避免视觉跳动 */
        setTimeout(()=>{
          showSkillSelectPanel(pc);
        }, 300);
      } else {
        /* 兜底：playerChar 无效时回退到选将屏 */
        document.getElementById('char-select-title').textContent=ch.title;
        document.getElementById('char-select-desc').textContent='选择你的化身 · 讨伐B王';
        renderCharacterCards();
        showScreen('screen-character');
      }
    } else {
      document.getElementById('char-select-title').textContent=ch.title;
      document.getElementById('char-select-desc').textContent='选择你的化身 · 讨伐B王';
      renderCharacterCards();
      showScreen('screen-character');
    }
  });
}
document.getElementById('btn-story-close').addEventListener('click',()=>{
  document.getElementById('story-overlay').classList.remove('show');
  showScreen('screen-mode');
});

/* ===== v4.0 阵营模式 ===== */
/* v5.0 多阵营模式：选中阵营列表（2-4 个），逐个选将后开始多阵营对弈 */
let factionPicks=[]; /* 已选阵营 key 列表 */
let factionPickChar={}; /* {factionKey: charId} 每阵营选中的角色 */
let factionPickIndex=0; /* 当前选将的阵营索引 */
function showFormationMenu(){
  factionPicks=[];
  factionPickChar={};
  factionPickIndex=0;
  const body=document.getElementById('story-body');
  let html='<div class="boss-section"><h3>选择你的阵营</h3>';
  html+='<p style="font-size:13px;color:var(--ink-soft);margin-bottom:8px">选择你方阵营出战，B王阵营将自动作为对方阵营加入对局。已选角色（含对方阵营）不可重复选择。</p>';
  Object.keys(FORMATIONS).forEach(k=>{
    if(k==='bking') return; /* B王阵营自动作为对方加入，玩家不可选 */
    const f=FORMATIONS[k];
    html+=`<div class="story-chapter" data-fac="${k}"><h4 style="color:${f.color}">${f.name}</h4><p>${f.desc} · 成员：${f.members.map(m=>CHARACTERS[m].name).join('、')}</p></div>`;
  });
  html+='</div>';
  html+=`<div id="fac-status" style="font-size:14px;color:var(--ink);margin:10px 0">未选阵营 · 对方：B王阵营</div>`;
  document.getElementById('story-nav').innerHTML=`<button class="btn-ghost" id="fac-back">返回</button><button class="btn-primary" id="fac-start" disabled>开始阵营对弈</button>`;
  body.innerHTML=html;
  document.getElementById('fac-back').addEventListener('click',()=>{
    document.getElementById('story-overlay').classList.remove('show');
    showScreen('screen-mode');
  });
  /* 阵营卡片：单选（玩家阵营），B王自动作为对方 */
  document.querySelectorAll('.story-chapter[data-fac]').forEach(el=>{
    el.addEventListener('click',()=>{
      const fac=el.dataset.fac;
      /* 单选：清除其他高亮 */
      document.querySelectorAll('.story-chapter[data-fac]').forEach(e=>{
        e.style.opacity='0.6'; e.style.borderColor=''; e.style.borderWidth='';
      });
      factionPicks=[fac];
      el.style.opacity='1';
      el.style.borderColor=FORMATIONS[fac].color;
      el.style.borderWidth='2px';
      document.getElementById('fac-status').textContent=`已选阵营：${FORMATIONS[fac].name} · 对方：B王阵营`;
      document.getElementById('fac-start').disabled = false;
    });
  });
  /* 开始按钮：进入阵营选将 */
  document.getElementById('fac-start').addEventListener('click',()=>{
    if(factionPicks.length<1) return;
    startFactionCharacterSelect();
  });
  document.getElementById('story-title').textContent='阵营对战';
  document.getElementById('story-overlay').classList.add('show');
}

/* 进入阵营选将流程：玩家阵营(红) vs B王阵营(黑，自动作为对方加入) */
function startFactionCharacterSelect(){
  factionPickIndex=0;
  factionPickChar={};
  state.gameMode='faction';
  state.formation=factionPicks[0];
  /* 跨阵营去重：记录已选角色（含对方阵营） */
  state.factionSelectedChars=[];
  /* 简化阵营模式：玩家阵营(红方) + B王阵营(黑方，自动加入) */
  const playerFac=factionPicks[0];
  state.activePlayers=[RED, BLACK];
  state.multiPlayers=[
    { char: FORMATIONS[playerFac].members[0], color: RED, name: FORMATIONS[playerFac].name, faction: playerFac },
    { char: FORMATIONS.bking.members[0], color: BLACK, name: FORMATIONS.bking.name, faction: 'bking' }
  ];
  state.playerColor=RED;
  state.playerIndex=0;
  state.eliminatedPlayers=[];
  /* B王阵营自动择将：从成员中随机选取（对方阵营自动加入） */
  const bkingPool=FORMATIONS.bking.members.filter(m=>CHARACTERS[m]);
  const bkingPick=bkingPool.length?bkingPool[Math.floor(Math.random()*bkingPool.length)]:FORMATIONS.bking.members[0];
  factionPickChar.bking=bkingPick;
  state.multiPlayers[1].char=bkingPick;
  /* B王已选角色加入去重列表，玩家不可重复选择 */
  state.factionSelectedChars.push(bkingPick);
  /* 进入玩家阵营选将 */
  showFactionPickScreen();
}

function showFactionPickScreen(){
  if(factionPickIndex>=factionPicks.length){
    /* 所有阵营选将完成，开始游戏 */
    state.character=state.multiPlayers[0].char;
    startNewGame();
    return;
  }
  const fac=factionPicks[factionPickIndex];
  const f=FORMATIONS[fac];
  state.formation=fac;
  /* 仅显示本阵营成员 */
  state.factionSelectMembers=f.members;
  document.getElementById('char-select-title').textContent=`${f.name} · 择将 (${factionPickIndex+1}/${factionPicks.length})`;
  document.getElementById('char-select-desc').textContent=`选择${f.name}的出战武将 · 对方：B王阵营（已选角色不可重复）`;
  charPage=0;
  renderCharacterCards();
  showScreen('screen-character');
}

/* 完成当前阵营选将，进入下一阵营 */
function confirmFactionPick(charId){
  const fac=factionPicks[factionPickIndex];
  factionPickChar[fac]=charId;
  state.multiPlayers[factionPickIndex].char=charId;
  /* 记录已选角色，用于跨阵营去重（对方阵营已选角色也不可选） */
  if(!state.factionSelectedChars) state.factionSelectedChars=[];
  if(!state.factionSelectedChars.includes(charId)) state.factionSelectedChars.push(charId);
  factionPickIndex++;
  if(factionPickIndex>=factionPicks.length){
    /* 所有阵营选将完成 */
    state.character=state.multiPlayers[0].char;
    state.factionSelectMembers=null;
    setTimeout(()=>startNewGame(),350);
  } else {
    state.factionSelectMembers=null;
    setTimeout(()=>showFactionPickScreen(),350);
  }
}

/* ===== v5.0 4v4 多人模式（Task 12）=====
   4 个玩家各自选将，颜色固定为 RED/BLACK/BLUE/GREEN，按顺序轮流走棋。
   每位玩家被吃王即淘汰，仅剩 1 玩家时该玩家获胜。 */
let multi4PickIndex=0; /* 当前选将的玩家索引 0-3 */
function start4v4Mode(){
  multi4PickIndex=0;
  state.gameMode='4v4';
  /* 固定 4 玩家：红/黑/蓝/绿，颜色按 PLAYER_COLORS 顺序 */
  state.activePlayers=PLAYER_COLORS.slice();
  state.multiPlayers=PLAYER_COLORS.map((color,i)=>({
    char: 'houzhibo', /* 占位，选将时覆盖 */
    color: color,
    name: colorDisplayName(color),
    faction: null
  }));
  state.playerColor=RED;
  state.playerIndex=0;
  state.eliminatedPlayers=[];
  show4v4PickScreen();
}
function show4v4PickScreen(){
  if(multi4PickIndex>=4){
    /* 4 玩家全部选将完成，开始游戏 */
    state.character=state.multiPlayers[0].char;
    startNewGame();
    return;
  }
  const color=PLAYER_COLORS[multi4PickIndex];
  const colorName=colorDisplayName(color);
  /* 4v4 模式：所有角色可选（玩家轮流选不同角色） */
  const allChars=Object.keys(CHARACTERS);
  state.multi4SelectMembers=allChars;
  document.getElementById('char-select-title').textContent=`${colorName} · 择将 (${multi4PickIndex+1}/4)`;
  document.getElementById('char-select-desc').textContent=`选择${colorName}玩家的化身 · 4v4 自由对战`;
  charPage=0;
  renderCharacterCards();
  showScreen('screen-character');
}
function confirm4v4Pick(charId){
  state.multiPlayers[multi4PickIndex].char=charId;
  state.multiPlayers[multi4PickIndex].name=CHARACTERS[charId].name;
  multi4PickIndex++;
  if(multi4PickIndex>=4){
    state.character=state.multiPlayers[0].char;
    state.multi4SelectMembers=null;
    setTimeout(()=>startNewGame(),350);
  } else {
    state.multi4SelectMembers=null;
    setTimeout(()=>show4v4PickScreen(),350);
  }
}

/* ===== v4.0 PVP Ban 位 ===== */
let pvpBanPhase=0;     /* 0=红ban1, 1=黑ban1, 2=红ban2, 3=黑ban2 */
function startBanPhase(){
  document.getElementById('ban-desc').textContent=`${pvpBanPhase%2===0?'红方':'黑方'}禁用 · 第 ${Math.floor(pvpBanPhase/2)+1} 轮`;
  renderBanCards();
  showScreen('screen-ban');
}
function renderBanCards(){
  const grid=document.getElementById('ban-grid');
  let html='';
  Object.keys(CHARACTERS).forEach(id=>{
    const ch=CHARACTERS[id];
    const banned=pvpBannedChars.includes(id);
    html+=`<div class="char-card${banned?' banned':''}" data-ban-id="${id}">`;
    html+=`<div class="char-portrait" style="background:${ch.color}">${getPortrait(id,ch.color)}</div>`;
    html+=`<div class="char-name">${ch.name}</div><div class="char-title">${ch.title}</div>`;
    if(banned) html+=`<div class="banned-mark">已禁</div>`;
    html+=`</div>`;
  });
  grid.innerHTML=html;
  document.querySelectorAll('[data-ban-id]').forEach(el=>{
    el.addEventListener('click',()=>{
      const id=el.dataset.banId;
      if(pvpBannedChars.includes(id)) return;
      pvpBannedChars.push(id);
      pvpBanPhase++;
      if(pvpBanPhase>=4){
        /* Ban 阶段结束，进入选人 */
        pvpSelectingPlayer=1;
        document.getElementById('char-select-title').textContent='红方择将';
        document.getElementById('char-select-desc').textContent='红方选择你的化身 · 已Ban: '+pvpBannedChars.map(c=>CHARACTERS[c].name).join('、');
        renderCharacterCards();
        showScreen('screen-character');
      } else {
        startBanPhase();
      }
    });
  });
}
document.getElementById('ban-back').addEventListener('click',()=>{
  showScreen('screen-mode');
});

/* ===== v4.0 被动选择面板 ===== */
function showPassivePanel(charId){
  const opts=document.getElementById('passive-options');
  if(!opts) return;
  const ch=CHARACTERS[charId];
  if(!ch||!ch.passives||ch.passives.length<2){ opts.innerHTML='<p style="font-size:12px;color:var(--ink-soft)">该角色暂无被动技能</p>'; return; }
  /* v35: 动态标题 — 5+被动显示"选2"，否则"选1" */
  const titleEl=document.getElementById('passive-section-title');
  if(titleEl){
    titleEl.textContent = ch.passives.length>2
      ? `被动技能 · 共 ${ch.passives.length} 个（选2个）`
      : `被动技能 · 共 ${ch.passives.length} 个（选1个）`;
  }
  const isMulti = ch.passives.length>2;
  const sel=skillState.selected[charId]?.passive;
  const selArr = isMulti
    ? (Array.isArray(sel) ? sel : (sel!==undefined ? [sel] : [0,1]))
    : null;
  const selIdx = isMulti ? -1 : (typeof sel==='number' ? sel : (sel||0));
  opts.innerHTML=ch.passives.map((p,i)=>{
    const selected = isMulti ? (selArr.indexOf(i)>=0) : (i===selIdx);
    return `<div class="passive-card${selected?' selected':''}" data-pv="${i}"${isMulti?' data-multi="1"':''}>
      <div><span class="pv-name">${p.name}</span><span class="pv-trigger">${p.trigger}</span></div>
      <div class="pv-desc">${p.desc}</div>
    </div>`;
  }).join('');
  opts.querySelectorAll('[data-pv]').forEach(el=>{
    el.addEventListener('click',()=>{
      const idx=parseInt(el.dataset.pv);
      if(!skillState.selected[charId]) skillState.selected[charId]={active:0,passive:0};
      const multi = el.dataset.multi==='1';
      if(multi){
        let arr = Array.isArray(skillState.selected[charId].passive) ? skillState.selected[charId].passive.slice() : [0,1];
        const pos = arr.indexOf(idx);
        if(pos>=0){
          if(arr.length>1) arr.splice(pos,1);  /* 至少保留1个 */
        } else {
          if(arr.length>=2) arr.shift();  /* 最多2个 */
          arr.push(idx);
        }
        skillState.selected[charId].passive = arr;
      } else {
        skillState.selected[charId].passive=idx;
      }
      showPassivePanel(charId);
    });
  });
}

/* ===== 联机对战 ===== */
let netRole=null; // 'host' | 'join'
let netWS=null;
let netConnected=false;
let netMyColor=RED; // 主机=红方, 客户端=黑方
let netSuppressSend=false; // 接收对方走棋时禁止回传

document.querySelectorAll('.net-card').forEach(card=>{
  card.addEventListener('click',()=>{
    document.querySelectorAll('.net-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    netRole=card.dataset.net;
    document.getElementById('net-host-setup').style.display=netRole==='host'?'block':'none';
    document.getElementById('net-join-setup').style.display=netRole==='join'?'block':'none';
  });
});
document.getElementById('net-back').addEventListener('click',()=>showScreen('screen-mode'));

document.getElementById('btn-host-create').addEventListener('click',()=>{
  if(typeof window.netAPI!=='undefined'&&window.netAPI.createHost){
    const name=document.getElementById('net-host-name').value.trim()||'博弈之王房间';
    const pwd=document.getElementById('net-host-password').value.trim();
    document.getElementById('net-host-ip').textContent='创建中...';
    document.getElementById('net-host-hint').textContent='正在启动服务器';
    window.netAPI.createHost({password:pwd, name:name}).then(info=>{
      if(info.error){
        document.getElementById('net-host-ip').textContent='创建失败';
        document.getElementById('net-host-hint').textContent='错误：'+info.error;
        return;
      }
      document.getElementById('net-host-ip').textContent=info.ip+':'+info.port;
      document.getElementById('net-host-hint').textContent=info.hasPassword?'已设密码，将地址告诉好友':'将此地址告诉好友，等待加入...';
      // 主机自己用 WebSocket 连接到 localhost（统一消息处理逻辑）
      netMyColor=RED;
      try{
        netWS=new WebSocket('ws://127.0.0.1:'+info.port);
        netWS.onopen=()=>{
          netConnected=true;
        };
        netWS.onmessage=(e)=>{
          const msg=JSON.parse(e.data);
          handleNetMessage(msg);
        };
        netWS.onclose=()=>{
          netConnected=false;
        };
      }catch(err){}
      // 监听客户端加入
      if(window.netAPI.onClientJoin){
        window.netAPI.onClientJoin(()=>{
          document.getElementById('net-host-hint').textContent='好友已加入！开始选将...';
          // 主机选红方
          pvpSelectingPlayer=1;
          charPage=0;
          document.getElementById('char-select-title').textContent='红方择将（你）';
          document.getElementById('char-select-desc').textContent='选择你的化身 · 你是红方';
          renderCharacterCards();
          setTimeout(()=>showScreen('screen-character'),600);
        });
        window.netAPI.onClientLeave(()=>{
          document.getElementById('net-host-hint').textContent='好友已断开，等待重新加入...';
        });
      }
    });
  } else {
    /* v17: 网页版联机 — 使用 WebRTC 手动信令交换
       无需桌面版，双方通过复制粘贴 SDP 完成连接 */
    startWebRtcHost();
  }
});

/* 客户端：搜索局域网房间 */
let netDiscoveryActive=false;
document.getElementById('btn-net-refresh').addEventListener('click', async ()=>{
  if(typeof window.netAPI==='undefined'||!window.netAPI.startDiscovery){
    document.getElementById('net-room-list').innerHTML='<div class="net-room-empty">桌面版才支持自动搜索</div>';
    return;
  }
  const list=document.getElementById('net-room-list');
  list.innerHTML='<div class="net-room-empty">搜索中...</div>';
  if(!netDiscoveryActive){
    netDiscoveryActive=true;
    await window.netAPI.startDiscovery();
    // 5秒后停止
    setTimeout(()=>{
      window.netAPI.stopDiscovery();
      netDiscoveryActive=false;
    },5000);
  }
});
/* 监听发现的房间 */
if(typeof window.netAPI!=='undefined'&&window.netAPI.onRoomFound){
  window.netAPI.onRoomFound((data)=>{
    renderRoomList(data.rooms);
  });
}
function renderRoomList(rooms){
  const list=document.getElementById('net-room-list');
  if(!rooms||rooms.length===0){
    list.innerHTML='<div class="net-room-empty">未发现房间，请确认主机已创建</div>';
    return;
  }
  list.innerHTML='';
  rooms.forEach(r=>{
    const item=document.createElement('div');
    item.className='net-room-item';
    item.innerHTML=`<div class="room-info"><div class="room-name">${r.name||'房间'}</div><div class="room-ip">${r.ip}:${r.port}</div></div><div class="room-badge">${r.hasPassword?'🔒':'公开'}</div>`;
    item.addEventListener('click',()=>{
      document.getElementById('net-join-ip').value=r.ip;
      if(r.hasPassword){
        document.getElementById('net-join-password').focus();
      }
      // 高亮选中
      list.querySelectorAll('.net-room-item').forEach(i=>i.classList.remove('selected'));
      item.classList.add('selected');
    });
    list.appendChild(item);
  });
}

document.getElementById('btn-join-connect').addEventListener('click',()=>{
  const ip=document.getElementById('net-join-ip').value.trim();
  if(!ip){ document.getElementById('net-join-status').textContent='请输入主机IP'; return; }
  /* v18: 网页版联机 — 检测是否为 WebRTC 邀请码
     邀请码是 base64 编码的 SDP（不以 { 开头，而是 base64 字符）。
     判断：netAPI 不存在（纯网页），或输入不是 IP 地址格式，视为邀请码走 WebRTC */
  const isIpAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
  if(typeof window.netAPI==='undefined' || !isIpAddress){
    startWebRtcJoin(ip);
    return;
  }
  const pwd=document.getElementById('net-join-password').value.trim();
  document.getElementById('net-join-status').textContent='连接中...';
  // 停止搜索
  if(window.netAPI&&window.netAPI.stopDiscovery){
    window.netAPI.stopDiscovery();
    netDiscoveryActive=false;
  }
  try{
    netWS=new WebSocket('ws://'+ip+':8081');
    let authed=false;
    netWS.onopen=()=>{
      // 先发送鉴权消息
      netWS.send(JSON.stringify({type:'auth', password:pwd}));
    };
    netWS.onmessage=(e)=>{
      const msg=JSON.parse(e.data);
      if(!authed){
        // 鉴权阶段
        if(msg.type==='auth-ok'){
          authed=true;
          netConnected=true;
          netMyColor=BLACK;
          document.getElementById('net-join-status').textContent='连接成功！等待主机开始...';
        } else if(msg.type==='auth-fail'){
          document.getElementById('net-join-status').textContent='鉴权失败：'+(msg.reason||'密码错误');
          netWS.close();
        }
        return;
      }
      handleNetMessage(msg);
    };
    netWS.onclose=()=>{
      netConnected=false;
      if(authed) document.getElementById('net-join-status').textContent='连接已断开';
    };
    netWS.onerror=()=>{
      document.getElementById('net-join-status').textContent='连接失败，请检查IP地址';
    };
    // 5秒超时
    setTimeout(()=>{
      if(!authed&&netWS.readyState!==1){
        document.getElementById('net-join-status').textContent='连接超时，请检查IP或主机是否已创建';
        try{ netWS.close(); }catch(e){}
      }
    },5000);
  }catch(err){
    document.getElementById('net-join-status').textContent='连接失败：'+err.message;
  }
});

function handleNetMessage(msg){
  switch(msg.type){
    case 'join':
      // 客户端加入（主机端会通过 onClientJoin 事件处理，这里不重复）
      break;
    case 'redChar':
      // 主机选了红方，客户端选黑方
      state.pvpRedChar=msg.redChar;
      pvpSelectingPlayer=2;
      document.getElementById('char-select-title').textContent='黑方择将（你）';
      document.getElementById('char-select-desc').textContent='选择你的化身 · 你是黑方';
      renderCharacterCards();
      showScreen('screen-character');
      break;
    case 'blackChar':
      // 客户端选了黑方，主机开始游戏
      state.pvpBlackChar=msg.blackChar;
      state.pvpRedChar=state.pvpRedChar||state.character;
      netWS.send(JSON.stringify({type:'start',redChar:state.pvpRedChar,blackChar:msg.blackChar}));
      startNewGame();
      break;
    case 'start':
      // 双方选将完成，开始游戏
      state.pvpRedChar=msg.redChar;
      state.pvpBlackChar=msg.blackChar;
      startNewGame();
      break;
    case 'move':
      // 对方走棋
      if(msg.from&&msg.to){
        netSuppressSend=true;
        state.selected=null; state.validMoves=[];
        doMove({r:msg.from.r,c:msg.from.c},{r:msg.to.r,c:msg.to.c});
        netSuppressSend=false;
      }
      break;
    case 'skill':
      // 对方使用技能（简化：同步技能使用）
      if(msg.sid){
        state.currentPlayer=netMyColor===RED?BLACK:RED;
        usePlayerSkill();
      }
      break;
    case 'chat':
      speakTaunt(msg.text,'opp');
      break;
  }
}
function netSendMove(from,to){
  if(netWS&&netWS.readyState===1){
    netWS.send(JSON.stringify({type:'move',from:{r:from.r,c:from.c},to:{r:to.r,c:to.c}}));
  }
}
function netSendChat(text){
  if(netWS&&netWS.readyState===1){
    netWS.send(JSON.stringify({type:'chat',text}));
  }
}

/* ===== v17 网页版联机（WebRTC 手动信令） =====
   用于无桌面版环境（纯网页运行），双方通过复制粘贴 SDP 完成连接。
   - 主机端：生成 offer，等待客户端粘贴 answer
   - 客户端：粘贴主机的 offer，生成 answer 回复主机
   连接建立后通过 DataChannel 通信，接口与 WebSocket 一致（readyState/send/onmessage） */
let rtcPC=null;
let rtcDC=null;
/* 包装 DataChannel 为类 WebSocket 接口，复用 netWS 逻辑 */
function rtcWrapDC(dc){
  return {
    readyState: dc.readyState==='open'?1:0,
    send: (data)=>{ if(dc.readyState==='open') dc.send(data); },
    close: ()=>dc.close(),
    _dc: dc
  };
}
function startWebRtcHost(){
  if(typeof RTCPeerConnection==='undefined'){
    document.getElementById('net-host-ip').textContent='浏览器不支持WebRTC';
    document.getElementById('net-host-hint').textContent='请使用桌面版或最新Chrome/Firefox';
    return;
  }
  document.getElementById('net-host-ip').textContent='生成邀请码中...';
  document.getElementById('net-host-hint').textContent='请将邀请码发送给好友';
  rtcPC=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  rtcDC=rtcPC.createDataChannel('game',{ordered:true});
  rtcDC.onopen=()=>{
    netWS=rtcWrapDC(rtcDC);
    netConnected=true;
    netMyColor=RED;
    document.getElementById('net-host-hint').textContent='好友已加入！开始选将...';
    pvpSelectingPlayer=1;
    charPage=0;
    document.getElementById('char-select-title').textContent='红方择将（你）';
    document.getElementById('char-select-desc').textContent='选择你的化身 · 你是红方';
    renderCharacterCards();
    setTimeout(()=>showScreen('screen-character'),600);
  };
  rtcDC.onmessage=(e)=>{
    const msg=JSON.parse(e.data);
    handleNetMessage(msg);
  };
  rtcDC.onclose=()=>{
    netConnected=false;
    document.getElementById('net-host-hint').textContent='好友已断开';
  };
  rtcPC.onicecandidate=(e)=>{
    if(e.candidate===null){
      /* ICE 收集完成，输出完整 offer */
      const offer=rtcPC.localDescription;
      const code=btoa(JSON.stringify({type:'offer',sdp:offer.sdp}));
      document.getElementById('net-host-ip').textContent='邀请码已生成（点击复制）';
      document.getElementById('net-host-ip').style.cursor='pointer';
      document.getElementById('net-host-ip').onclick=()=>{
        navigator.clipboard.writeText(code).then(()=>{
          document.getElementById('net-host-hint').textContent='已复制！粘贴给好友';
        });
      };
      /* 弹出输入框等待客户端的 answer */
      window._rtcHostWaitAnswer(code);
    }
  };
  rtcPC.createOffer().then(offer=>rtcPC.setLocalDescription(offer)).catch(err=>{
    document.getElementById('net-host-ip').textContent='创建失败：'+err.message;
  });
}
/* 主机等待客户端 answer */
window._rtcHostWaitAnswer=function(offerCode){
  /* 创建输入框让主机粘贴客户端返回的 answer */
  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:9999;max-width:500px;width:90%';
  wrap.innerHTML=`
    <h3 style="margin:0 0 10px;color:#1a1714">等待好友回应</h3>
    <p style="font-size:13px;color:#666;margin:0 0 10px">已复制邀请码：<code style="word-break:break-all;font-size:11px">${offerCode.slice(0,40)}...</code></p>
    <p style="font-size:13px;color:#666;margin:0 0 10px">将邀请码发给好友，好友生成回应码后，粘贴到下方：</p>
    <textarea id="rtc-answer-input" placeholder="粘贴好友的回应码" style="width:100%;height:80px;padding:8px;font-size:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box"></textarea>
    <div style="margin-top:10px;text-align:right">
      <button id="rtc-answer-cancel" style="padding:6px 12px;background:#eee;border:none;border-radius:4px;cursor:pointer;margin-right:8px">取消</button>
      <button id="rtc-answer-ok" style="padding:6px 12px;background:#c4392f;color:#fff;border:none;border-radius:4px;cursor:pointer">确认</button>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('rtc-answer-cancel').onclick=()=>{
    wrap.remove();
    if(rtcPC) rtcPC.close();
  };
  document.getElementById('rtc-answer-ok').onclick=()=>{
    const ans=document.getElementById('rtc-answer-input').value.trim();
    if(!ans) return;
    try{
      const desc=JSON.parse(atob(ans));
      if(desc.type==='answer'){
        rtcPC.setRemoteDescription(new RTCSessionDescription(desc));
        wrap.remove();
      } else {
        alert('回应码格式错误');
      }
    }catch(err){
      alert('解析失败：'+err.message);
    }
  };
};
function startWebRtcJoin(offerCode){
  if(typeof RTCPeerConnection==='undefined'){
    document.getElementById('net-join-status').textContent='浏览器不支持WebRTC';
    return;
  }
  document.getElementById('net-join-status').textContent='解析邀请码...';
  let offer;
  try{
    offer=JSON.parse(atob(offerCode));
    if(offer.type!=='offer') throw new Error('不是有效的邀请码');
  }catch(err){
    document.getElementById('net-join-status').textContent='邀请码错误：'+err.message;
    return;
  }
  rtcPC=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  rtcPC.ondatachannel=(e)=>{
    rtcDC=e.channel;
    rtcDC.onopen=()=>{
      netWS=rtcWrapDC(rtcDC);
      netConnected=true;
      netMyColor=BLACK;
      document.getElementById('net-join-status').textContent='连接成功！等待主机开始...';
    };
    rtcDC.onmessage=(ev)=>{
      const msg=JSON.parse(ev.data);
      handleNetMessage(msg);
    };
    rtcDC.onclose=()=>{
      netConnected=false;
      document.getElementById('net-join-status').textContent='连接已断开';
    };
  };
  rtcPC.onicecandidate=(e)=>{
    if(e.candidate===null){
      /* ICE 收集完成，输出 answer */
      const ans=rtcPC.localDescription;
      const code=btoa(JSON.stringify({type:'answer',sdp:ans.sdp}));
      document.getElementById('net-join-status').textContent='回应码已生成（点击复制）';
      const statusEl=document.getElementById('net-join-status');
      statusEl.style.cursor='pointer';
      statusEl.onclick=()=>{
        navigator.clipboard.writeText(code).then(()=>{
          document.getElementById('net-join-status').textContent='已复制！发送给主机';
        });
      };
      /* 显示回应码 */
      const wrap=document.createElement('div');
      wrap.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:9999;max-width:500px;width:90%';
      wrap.innerHTML=`
        <h3 style="margin:0 0 10px;color:#1a1714">回应码</h3>
        <p style="font-size:13px;color:#666;margin:0 0 10px">将以下回应码复制发送给主机：</p>
        <textarea style="width:100%;height:100px;padding:8px;font-size:11px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box" readonly>${code}</textarea>
        <div style="margin-top:10px;text-align:right">
          <button id="rtc-copy-ok" style="padding:6px 12px;background:#c4392f;color:#fff;border:none;border-radius:4px;cursor:pointer">复制并关闭</button>
        </div>`;
      document.body.appendChild(wrap);
      document.getElementById('rtc-copy-ok').onclick=()=>{
        navigator.clipboard.writeText(code);
        wrap.remove();
      };
    }
  };
  rtcPC.setRemoteDescription(new RTCSessionDescription(offer))
    .then(()=>rtcPC.createAnswer())
    .then(ans=>rtcPC.setLocalDescription(ans))
    .catch(err=>{
      document.getElementById('net-join-status').textContent='连接失败：'+err.message;
    });
}

/* ===== v9 技能选择面板（点击角色弹出） ===== */
let skillSelectCharId=null;

function showSkillSelectPanel(charId){
  const ch=CHARACTERS[charId];
  if(!ch) return;
  skillSelectCharId=charId;

  /* 标题 */
  document.getElementById('skill-select-char-name').textContent=ch.name+' · 技能选择';

  /* v36-dynamic: 主动/被动技能标题动态化 — 从角色数据读取选择数量 */
  const actives=(ch.actives&&ch.actives.length)?ch.actives:[ch.skill];
  const passives=(ch.passives&&ch.passives.length)?ch.passives:[];
  const isBking = charId==='bking';
  const activePickCount = isBking ? 3 : 1;  /* B王选3，其他选1 */
  const passivePickCount = passives.length > 2 ? 2 : 1;  /* 通天教主/B王选2，其他选1 */
  /* 更新 HTML 中的标题文案 */
  const activeTitleEl = document.querySelector('#skill-select-actives').previousElementSibling;
  const passiveTitleEl = document.querySelector('#skill-select-passives').previousElementSibling;
  if(activeTitleEl) activeTitleEl.textContent = `主动技能（选${activePickCount}）`;
  if(passiveTitleEl) passiveTitleEl.textContent = `被动技能（选${passivePickCount}）`;

  /* 渲染主动技能 */
  const activesEl=document.getElementById('skill-select-actives');
  const selActive=skillState.selected[charId]?.active||0;
  activesEl.innerHTML=actives.map((a,i)=>`
    <div class="skill-select-item${i===selActive?' selected':''}" data-type="active" data-idx="${i}">
      <div class="skill-item-name">${a.name}</div>
      <div class="skill-item-desc">${a.desc}</div>
      <div class="skill-item-cd">CD: ${a.cd}回合</div>
    </div>`).join('');

  /* 渲染被动技能 */
  const passivesEl=document.getElementById('skill-select-passives');
  if(passives.length===0){
    passivesEl.innerHTML='<div class="skill-select-empty">该角色暂无被动技能</div>';
  } else {
    const isMulti = passives.length > 2;
    const selPassive = skillState.selected[charId]?.passive;
    if(isMulti){
      /* 5选2：多选模式 */
      const selArr = Array.isArray(selPassive) ? selPassive : (selPassive!==undefined ? [selPassive] : [0,1]);
      passivesEl.innerHTML=passives.map((p,i)=>`
        <div class="skill-select-item${selArr.indexOf(i)>=0?' selected':''}" data-type="passive" data-idx="${i}" data-multi="1">
          <div class="skill-item-name">${p.name}<span class="skill-item-trigger">${p.trigger||''}</span></div>
          <div class="skill-item-desc">${p.desc}</div>
        </div>`).join('');
    } else {
      /* 2选1：单选模式 */
      const idx = typeof selPassive==='number' ? selPassive : (selPassive||0);
      passivesEl.innerHTML=passives.map((p,i)=>`
        <div class="skill-select-item${i===idx?' selected':''}" data-type="passive" data-idx="${i}">
          <div class="skill-item-name">${p.name}<span class="skill-item-trigger">${p.trigger||''}</span></div>
          <div class="skill-item-desc">${p.desc}</div>
        </div>`).join('');
    }
  }

  /* 绑定选择事件 */
  activesEl.querySelectorAll('.skill-select-item').forEach(el=>{
    el.addEventListener('click',()=>{
      const idx=parseInt(el.dataset.idx);
      if(!skillState.selected[charId]) skillState.selected[charId]={active:0,passive:0};
      skillState.selected[charId].active=idx;
      activesEl.querySelectorAll('.skill-select-item').forEach((m,i)=>{
        m.classList.toggle('selected', i===idx);
      });
    });
  });
  passivesEl.querySelectorAll('.skill-select-item').forEach(el=>{
    el.addEventListener('click',()=>{
      const idx=parseInt(el.dataset.idx);
      if(!skillState.selected[charId]) skillState.selected[charId]={active:0,passive:0};
      const isMulti = el.dataset.multi==='1';
      if(isMulti){
        /* v34: 5选2 多选模式 */
        let selArr = Array.isArray(skillState.selected[charId].passive) ? skillState.selected[charId].passive.slice() : [0,1];
        const pos = selArr.indexOf(idx);
        if(pos>=0){
          /* 已选中：取消选择（至少保留1个）*/
          if(selArr.length>1) selArr.splice(pos,1);
        } else {
          /* 未选中：添加（最多2个）*/
          if(selArr.length>=2) selArr.shift();  /* 移除最早的 */
          selArr.push(idx);
        }
        skillState.selected[charId].passive = selArr;
        passivesEl.querySelectorAll('.skill-select-item').forEach((m,i)=>{
          m.classList.toggle('selected', selArr.indexOf(i)>=0);
        });
      } else {
        /* 2选1 单选模式 */
        skillState.selected[charId].passive=idx;
        passivesEl.querySelectorAll('.skill-select-item').forEach((m,i)=>{
          m.classList.toggle('selected', i===idx);
        });
      }
    });
  });

  document.getElementById('skill-select-overlay').style.display='flex';
}

function hideSkillSelectPanel(){
  document.getElementById('skill-select-overlay').style.display='none';
  skillSelectCharId=null;
}

document.getElementById('skill-select-close').addEventListener('click',hideSkillSelectPanel);
document.getElementById('skill-select-overlay').addEventListener('click',(e)=>{
  if(e.target.id==='skill-select-overlay') hideSkillSelectPanel();
});
document.getElementById('skill-select-confirm').addEventListener('click',()=>{
  if(!skillSelectCharId) return;
  const id=skillSelectCharId;
  hideSkillSelectPanel();
  confirmCharacterSelect(id);
});

document.addEventListener('click',(e)=>{
  // 角色卡片：弹出技能选择面板（不再直接选将）
  const card=e.target.closest('.character-card');
  if(card){
    /* 面板已弹出时不重复触发 */
    if(document.getElementById('skill-select-overlay').style.display==='flex') return;
    showSkillSelectPanel(card.dataset.character);
    return;
  }
});

/* 确认选择角色 */
function confirmCharacterSelect(id){
  /* 记录选中角色的主动/被动技能到 state */
  const _ch=CHARACTERS[id];
  let pickedActive=null, pickedPassive=null;
  if(_ch){
    const _sel=skillState.selected[id]||{active:0,passive:0};
    pickedActive=(_ch.actives&&_ch.actives.length)?_ch.actives[_sel.active||0]:_ch.skill;
    pickedPassive=(_ch.passives&&_ch.passives.length)?_ch.passives[_sel.passive||0]:null;
    state.playerActiveSkill=pickedActive;
    state.playerPassiveSkill=pickedPassive;
  }
  if(state.gameMode==='online'){
    if(netMyColor===RED&&pvpSelectingPlayer===1){
      state.pvpRedChar=id;
      state.character=id;
      state.pvpRedActiveSkill=pickedActive;
      state.pvpRedPassive=pickedPassive;
      if(netWS&&netWS.readyState===1){
        netWS.send(JSON.stringify({type:'redChar',redChar:state.pvpRedChar}));
      }
      document.getElementById('char-select-title').textContent='等待对方选将...';
      document.getElementById('char-select-desc').textContent='好友正在选择黑方角色';
    } else if(netMyColor===BLACK){
      state.pvpBlackChar=id;
      state.pvpBlackActiveSkill=pickedActive;
      state.pvpBlackPassive=pickedPassive;
      if(netWS&&netWS.readyState===1){
        netWS.send(JSON.stringify({type:'blackChar',blackChar:state.pvpBlackChar}));
      }
      document.getElementById('char-select-title').textContent='准备开始...';
      document.getElementById('char-select-desc').textContent='等待主机开始游戏';
    }
  } else if(state.gameMode==='pvp'){
    if(pvpSelectingPlayer===1){
      state.pvpRedChar=id;
      state.pvpRedActiveSkill=pickedActive;
      state.pvpRedPassive=pickedPassive;
      setTimeout(()=>{
        pvpSelectingPlayer=2;
        charPage=0;
        document.querySelectorAll('.character-card').forEach(c=>c.classList.remove('selected'));
        document.getElementById('char-select-title').textContent='黑方择将';
        document.getElementById('char-select-desc').textContent='黑方选择你的化身 · 各有奇术';
        renderCharacterCards();
      },350);
    } else {
      state.pvpBlackChar=id;
      state.pvpBlackActiveSkill=pickedActive;
      state.pvpBlackPassive=pickedPassive;
      setTimeout(()=>{ startNewGame(); },350);
    }
  } else if(state.gameMode==='three'){
    // 三英战B王：选满3位后进入难度设置（固定狂妄B王）
    if(threePicks.includes(id)) return; // 不可重复
    threePicks.push(id);
    /* v11: 为每位武将独立存储选中的主动/被动技能 */
    if(!state.threeHeroSkills) state.threeHeroSkills=[];
    state.threeHeroSkills.push({active:pickedActive, passive:pickedPassive});
    document.getElementById('char-select-desc').textContent=`选择3位武将轮换对抗B王 · 已选 ${threePicks.length}/3`;
    if(threePicks.length>=3){
      state.threeHeroes=threePicks.slice();
      state.threeHeroIndex=0;
      state.character=threePicks[0];
      /* v11: 设置当前武将的技能 */
      if(state.threeHeroSkills[0]){
        state.playerActiveSkill=state.threeHeroSkills[0].active;
        state.playerPassiveSkill=state.threeHeroSkills[0].passive;
      }
      setTimeout(()=>showScreen('screen-handicap'),350);
    } else {
      renderCharacterCards();
    }
  } else if(state.gameMode==='faction'){
    /* v5.0 多阵营模式：当前阵营选将 → 下一阵营 */
    confirmFactionPick(id);
  } else if(state.gameMode==='4v4'){
    /* v5.0 4v4 模式：当前玩家选将 → 下一玩家 */
    confirm4v4Pick(id);
  } else {
    state.character=id;
    /* v17: 故事模式跳过难度选择屏，直接用章节设定难度 */
    if(state.storyChapterId){
      setTimeout(()=>{ startNewGame(); },350);
    } else {
      setTimeout(()=>showScreen('screen-handicap'),350);
    }
  }
}

document.getElementById('char-back').addEventListener('click',()=>{
  if(state.gameMode==='pvp'&&pvpSelectingPlayer===2){
    pvpSelectingPlayer=1;
    charPage=0;
    document.getElementById('char-select-title').textContent='红方择将';
    document.getElementById('char-select-desc').textContent='红方选择你的化身 · 各有奇术';
    renderCharacterCards(true);
  } else if(state.gameMode==='three'&&threePicks.length>0){
    threePicks.pop();
    document.getElementById('char-select-desc').textContent=`选择3位武将轮换对抗B王 · 已选 ${threePicks.length}/3`;
    renderCharacterCards();
  } else if(state.gameMode==='faction'){
    /* v5.0 多阵营：返回上一阵营选将 */
    if(factionPickIndex>0){
      factionPickIndex--;
      state.factionSelectMembers=null;
      showFactionPickScreen();
    } else {
      state.factionSelectMembers=null;
      state.gameMode='formation';
      showFormationMenu();
    }
  } else if(state.gameMode==='4v4'){
    /* v5.0 4v4：返回上一玩家选将 */
    if(multi4PickIndex>0){
      multi4PickIndex--;
      state.multi4SelectMembers=null;
      show4v4PickScreen();
    } else {
      state.multi4SelectMembers=null;
      state.gameMode='pve';
      showScreen('screen-mode');
    }
  } else {
    showScreen('screen-mode');
  }
});

/* 翻页按钮 */
document.getElementById('char-prev').addEventListener('click',()=>gotoCharPage(charPage-1,-1));
document.getElementById('char-next').addEventListener('click',()=>gotoCharPage(charPage+1,1));
/* 键盘左右翻页 */
document.addEventListener('keydown',(e)=>{
  if(document.getElementById('screen-character').classList.contains('active')&&
     !document.getElementById('char-detail').classList.contains('show')){
    if(e.key==='ArrowLeft') gotoCharPage(charPage-1,-1);
    else if(e.key==='ArrowRight') gotoCharPage(charPage+1,1);
  }
});

let selectedHandicap='none';
document.querySelectorAll('.handicap-card').forEach(card=>{
  card.addEventListener('click',()=>{
    document.querySelectorAll('.handicap-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    selectedHandicap=card.dataset.handicap;
  });
});

let selectedDifficulty='easy';
/* v36-dynamic: 难度卡片文案动态化 — 从 DIFFICULTIES 常量读取，避免 HTML 硬编码过时 */
function syncDifficultyCardsFromData(){
  if(typeof DIFFICULTIES==='undefined') return;
  /* v38 动态化：难度面板标题从 BKING_DIFFICULTY_HEADER 常量读取，禁止 HTML 硬编码 */
  if(typeof BKING_DIFFICULTY_HEADER!=='undefined'){
    const headerEl = document.querySelector('.setup-section .setup-label');
    if(headerEl) headerEl.textContent = BKING_DIFFICULTY_HEADER;
  }
  document.querySelectorAll('.difficulty-card').forEach(card=>{
    const key = card.dataset.difficulty;
    const d = DIFFICULTIES[key];
    if(!d) return;
    /* 更新标题与描述（v38: 改为读取 d.desc，避免所有难度统一显示「偶有失误」的 bug） */
    const nameEl = card.querySelector('.diff-name');
    const descEl = card.querySelector('.diff-desc');
    const skillEl = card.querySelector('.diff-skill');
    if(nameEl) nameEl.textContent = d.name;
    if(descEl) descEl.textContent = d.desc || (d.title + '，偶有失误');
    /* 技能池摘要：取前2个技能名 */
    if(skillEl && d.skills){
      const skills = d.skills.slice(0,2).map(s=>s.name).join('、');
      const more = d.skills.length > 2 ? ` 等${d.skills.length}个` : '';
      skillEl.textContent = `奇术 · ${skills}${more}`;
    }
  });
}
/* v36-dynamic: 模式卡片动态字段同步 — 故事模式章节数等从常量读取 */
function syncModeCardDynamicFields(){
  if(typeof STORY_CHAPTERS!=='undefined'){
    const storyCard = document.querySelector('.mode-card[data-mode="story"] .mode-desc');
    if(storyCard) storyCard.textContent = `讨伐B王的史诗剧情 · ${STORY_CHAPTERS.length}章冒险`;
  }
}
document.querySelectorAll('.difficulty-card').forEach(card=>{
  card.addEventListener('click',()=>{
    document.querySelectorAll('.difficulty-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    selectedDifficulty=card.dataset.difficulty;
  });
});
/* 初始化时同步一次（DOM 加载后立即调用） */
syncDifficultyCardsFromData();
syncModeCardDynamicFields();

document.getElementById('hand-back').addEventListener('click',()=>showScreen('screen-character'));
document.getElementById('hand-confirm').addEventListener('click',()=>{
  state.handicap=selectedHandicap||'none';
  state.difficulty=selectedDifficulty||'easy';
  startNewGame();
});

/* ===== 棋子操作菜单（进攻 / 查看详情） =====
   原逻辑：点击己方棋子 → 直接进入移动模式
   新逻辑：点击己方棋子 → 弹出操作菜单 → 选「进攻」才进入移动模式；选「详情」查看属性
   技能模式（teleport/disguise/swap/ironwall 等）维持原逻辑，不弹菜单。 */
function isNormalSelectMode(){
  // 仅当处于「需要 selectPiece 特殊分支」的模式时才不走菜单：
  // ironwall 选棋、teleport/disguise/swap 选棋；其他 skillActive（debuff/被动）按正常选子处理
  return state.skillActive!=='ironwall' && !state.teleportMode && !state.disguiseMode && !state.swapMode;
}
function isPieceActionMenuVisible(){
  const m=document.getElementById('piece-action-menu');
  return !!(m && m.style.display!=='none' && m.style.display!=='');
}
/* 弹出操作菜单，定位到棋子旁（基于 canvas 屏幕坐标计算） */
function showPieceActionMenu(row,col,piece){
  const menu=document.getElementById('piece-action-menu');
  if(!menu) return;
  const rect=canvas.getBoundingClientRect();
  const sx=rect.width/CANVAS_W, sy=rect.height/CANVAS_H;
  const cx=(PAD+col*CELL)*sx;     // 格子中心 X（相对 canvas 左上）
  const cy=(PAD+row*CELL)*sy;     // 格子中心 Y
  const r=(PIECE_RADIUS||25)*sx;
  const menuW=92, menuH=80;        // 预估菜单尺寸
  // 默认放在棋子右侧；右侧不够则放左侧
  let left=rect.left+cx+r+6;
  if(left+menuW>window.innerWidth-8){
    left=rect.left+cx-r-menuW-6;
  }
  if(left<8) left=8;
  // 垂直居中对齐棋子
  let top=rect.top+cy-menuH/2;
  if(top+menuH>window.innerHeight-8) top=window.innerHeight-8-menuH;
  if(top<8) top=8;
  menu.style.left=left+'px';
  menu.style.top=top+'px';
  menu.style.display='flex';
  menu.dataset.row=row;
  menu.dataset.col=col;
}
function hidePieceActionMenu(){
  const menu=document.getElementById('piece-action-menu');
  if(menu){
    menu.style.display='none';
    delete menu.dataset.row;
    delete menu.dataset.col;
  }
}
/* v12: 棋子详情弹窗 — 显示完整属性（基础 + 角色加成 + buff 影响） */
function showPieceDetail(piece){
  const overlay=document.getElementById('piece-detail-overlay');
  const titleEl=document.getElementById('piece-detail-title');
  const bodyEl=document.getElementById('piece-detail-body');
  if(!overlay||!piece) return;
  const chars=PIECE_CHAR[piece.player]||PIECE_CHAR.red;
  const pieceName=chars[piece.type]||'?';
  const typeName=PIECE_TYPE_NAME[piece.ptype]||'未知';
  const colorName={red:'红方',black:'黑方',blue:'蓝方',green:'绿方'}[piece.player]||piece.player;
  const stats = getPieceEffectiveStats(piece);
  /* 攻防显示：基础(+角色加成) → 最终值（含 buff 影响） */
  const atkStr = stats.charAtkBonus>0
    ? `${stats.baseAtk} (+${stats.charAtkBonus}) → <b style="color:#b8302a">${stats.effAtk}</b>`
    : `${stats.baseAtk} → <b style="color:#b8302a">${stats.effAtk}</b>`;
  const defStr = stats.charDefBonus>0
    ? `${stats.baseDef} (+${stats.charDefBonus}) → <b style="color:#3a6b8a">${stats.effDef}</b>`
    : `${stats.baseDef} → <b style="color:#3a6b8a">${stats.effDef}</b>`;
  /* buff 详情列表 */
  let buffsHtml = '<div class="pd-row"><span class="pd-label">状态</span><span class="pd-val">无</span></div>';
  if(stats.buffs.length){
    buffsHtml = '<div class="pd-buffs"><div class="pd-buffs-title">状态效果</div>';
    stats.buffs.forEach(b=>{
      buffsHtml += `<div class="pd-buff-row">
        <span class="pd-buff-name">${b.name}</span>
        <span class="pd-buff-desc">${b.desc}</span>
        <span class="pd-buff-dur">剩余 ${b.duration} 回合</span>
      </div>`;
    });
    buffsHtml += '</div>';
  }
  titleEl.textContent=`${pieceName} · ${typeName}`;
  bodyEl.innerHTML=
    `<div class="pd-row"><span class="pd-label">阵营</span><span class="pd-val">${colorName}</span></div>`+
    `<div class="pd-row"><span class="pd-label">兵种</span><span class="pd-val">${typeName}</span></div>`+
    `<div class="pd-row"><span class="pd-label">生命</span><span class="pd-val">${Math.max(0,piece.hp)} / ${piece.maxHp}</span></div>`+
    `<div class="pd-row"><span class="pd-label">攻击</span><span class="pd-val">${atkStr}</span></div>`+
    `<div class="pd-row"><span class="pd-label">防御</span><span class="pd-val">${defStr}</span></div>`+
    `<div class="pd-row"><span class="pd-label">角色加成</span><span class="pd-val">攻+${stats.charAtkBonus} / 防+${stats.charDefBonus}</span></div>`+
    buffsHtml;
  overlay.style.display='flex';
}
function hidePieceDetail(){
  const overlay=document.getElementById('piece-detail-overlay');
  if(overlay) overlay.style.display='none';
}
/* 菜单按钮：进攻 → 进入移动模式 */
document.getElementById('piece-action-attack').addEventListener('click',(e)=>{
  e.stopPropagation();
  const menu=document.getElementById('piece-action-menu');
  const r=parseInt(menu.dataset.row), c=parseInt(menu.dataset.col);
  hidePieceActionMenu();
  if(Number.isFinite(r)&&Number.isFinite(c)) selectPiece(r,c);
});
/* 菜单按钮：详情 → 显示棋子属性 */
document.getElementById('piece-action-detail').addEventListener('click',(e)=>{
  e.stopPropagation();
  const menu=document.getElementById('piece-action-menu');
  const r=parseInt(menu.dataset.row), c=parseInt(menu.dataset.col);
  hidePieceActionMenu();
  if(Number.isFinite(r)&&Number.isFinite(c)){
    const p=state.board[r]&&state.board[r][c];
    if(p) showPieceDetail(p);
  }
});
/* 详情弹窗关闭 */
function _bindPieceDetailClose(){
  ['piece-detail-close','piece-detail-ok'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('click',hidePieceDetail);
  });
  const overlay=document.getElementById('piece-detail-overlay');
  if(overlay){
    overlay.addEventListener('click',(e)=>{
      if(e.target===overlay) hidePieceDetail();
    });
  }
}
_bindPieceDetailClose();
/* 点击页面其他位置（菜单外）关闭菜单。
   注：canvas 的 click 先于 document 冒泡触发，且 canvas 内已自行处理关闭，此处只兜底非 canvas 区域。 */
document.addEventListener('click',(e)=>{
  if(!isPieceActionMenuVisible()) return;
  if(e.target.closest('#piece-action-menu')) return;
  hidePieceActionMenu();
});
/* 切换玩家 / 新局开始时，关闭可能残留的菜单与详情 */
const _origAdvanceToNextPlayer=typeof advanceToNextPlayer==='function'?advanceToNextPlayer:null;
if(_origAdvanceToNextPlayer){
  advanceToNextPlayer=function(){
    hidePieceActionMenu();
    return _origAdvanceToNextPlayer.apply(this,arguments);
  };
}
/* 离开对弈屏时，关闭可能残留的菜单与详情弹窗（详情弹窗位于 body 层，不会随 screen 隐藏） */
const _origShowScreen=typeof showScreen==='function'?showScreen:null;
if(_origShowScreen){
  showScreen=function(id){
    if(id!=='screen-game'){ hidePieceActionMenu(); hidePieceDetail(); }
    return _origShowScreen.apply(this,arguments);
  };
}

// 棋盘点击 — 修复坐标
canvas.addEventListener('click',(e)=>{
  if(state.gameOver||state.animating||state.aiThinking) return;
  /* v22: 强制走法执行期间（800ms 延迟）禁止玩家抢操作，避免回合错乱 */
  if(state.forcedMovePending) return;
  // 若棋子操作菜单正打开，点击棋盘任意位置仅关闭菜单，不处理本次点击
  if(isPieceActionMenuVisible()){
    hidePieceActionMenu();
    return;
  }
  // PVE模式：只允许玩家方操作；PVP/online/faction/4v4 模式：当前方操作
  if(state.gameMode==='pve'&&state.currentPlayer!==state.playerColor&&!state.swapMode) return;
  if(state.gameMode==='three'&&state.currentPlayer!==state.playerColor) return;
  if(state.gameMode==='online'&&state.currentPlayer!==netMyColor) return;
  /* v5.0 多阵营/4v4：所有玩家在同设备轮流操作，无需阻止 */
  const rect=canvas.getBoundingClientRect();
  const sx=CANVAS_W/rect.width, sy=CANVAS_H/rect.height;
  const x=(e.clientX-rect.left)*sx, y=(e.clientY-rect.top)*sy;
  const cell=pixelToCell(x,y);
  if(!cell) return;
  const piece=state.board[cell.row][cell.col];
  if(state.selected){
    if(tryMove(cell.row,cell.col)) return;
    if(piece&&piece.player===state.currentPlayer){
      // 重新选择己方棋子：直接进入移动模式（保证点击即可选中）
      selectPiece(cell.row,cell.col);
      return;
    }
    /* v18: 已选中己方棋子时点击对方棋子 — 进入查看模式显示属性与 debuff
       修复：原代码此处仅清空选中，导致点击对方棋子看不到 buff 状态 */
    if(piece && piece.player!==state.currentPlayer){
      state.inspect={row:cell.row,col:cell.col};
      state.selected=null; state.validMoves=[];
      renderAll();
      return;
    }
    state.selected=null; state.validMoves=[]; renderAll();
  } else {
    let allowedColor=(state.gameMode==='pvp'||state.gameMode==='online')?state.currentPlayer:state.playerColor;
    /* v5.0 多阵营/4v4：所有玩家轮流操作，允许当前玩家选择自己的棋子 */
    if(state.gameMode==='faction'||state.gameMode==='4v4') allowedColor=state.currentPlayer;
    if(piece&&piece.player===allowedColor){
      // 点击己方棋子：直接进入移动模式（保证点击即可选中）
      selectPiece(cell.row,cell.col);
    } else if(piece){
      /* v17: 点击对方棋子 — 进入查看模式，显示属性与 debuff
         修复：原代码此处未调用 selectPiece，导致点击对方棋子无反应 */
      selectPiece(cell.row,cell.col);
    }
  }
});

document.getElementById('btn-skill').addEventListener('click',usePlayerSkill);
/* v23: 黑方技能释放按钮（PVP 模式下，黑方玩家点击释放技能）
   usePlayerSkill 内部已根据 state.currentPlayer 处理黑方技能，无需额外参数 */
const _btnOppSkill=document.getElementById('btn-opp-skill');
if(_btnOppSkill) _btnOppSkill.addEventListener('click',usePlayerSkill);
document.getElementById('btn-undo').addEventListener('click',undoLastMove);
document.getElementById('btn-restart').addEventListener('click',startNewGame);
document.getElementById('btn-th-switch').addEventListener('click',()=>{
  // 循环切换到下一个武将
  const next=(state.threeHeroIndex+1)%state.threeHeroes.length;
  switchThreeHero(next);
});
/* v22: 战报面板控制 */
document.getElementById('btn-battle-log-clear').addEventListener('click',clearBattleLog);
document.getElementById('btn-battle-log-collapse').addEventListener('click',toggleBattleLogPanel);
document.getElementById('btn-battle-log-toggle').addEventListener('click',toggleBattleLogPanel);
document.getElementById('btn-resign').addEventListener('click',()=>{
  if(state.gameOver) return;
  state.gameOver=true;
  showResult(false,'主动认输');
});
document.getElementById('btn-game-back').addEventListener('click',()=>{
  if(confirm('确定返回主菜单？当前对局将不会保存（可在返回前点击「保存」）。')){
    showScreen('screen-welcome');
  }
});
document.getElementById('btn-again').addEventListener('click',startNewGame);
document.getElementById('btn-home').addEventListener('click',()=>showScreen('screen-welcome'));
// 绝杀确认按钮：确认后进入结局屏
document.getElementById('btn-mate-confirm').addEventListener('click',()=>{
  const overlay=document.getElementById('mate-overlay');
  const reason=overlay.dataset.reason||'';
  const playerWins=overlay.dataset.playerWins==='true';
  hideMateOverlay();
  showResult(playerWins,reason);
});

// 保存/加载功能
document.getElementById('btn-save').addEventListener('click',saveGame);
document.getElementById('btn-load').addEventListener('click',loadGame);

function saveGame(){
  /* v30-fix P0-2: 扩展存档字段 — 原 saveData 仅 14 个字段，
     丢失 30+ 关键状态（gameMode/pvpBlackChar/silenceTurns/envyStolenPassives 等），
     导致读档后模式错乱、临时状态丢失。 */
  /* v30-fix P1-2: 保存前清理 forcedMoveTimer，避免存档后 timer 在已销毁 state 上调用 */
  if(state.forcedMoveTimer){
    clearTimeout(state.forcedMoveTimer);
    state.forcedMoveTimer = null;
  }
  const saveData={
    version:'1.1',
    timestamp:Date.now(),
    board:state.board,
    currentPlayer:state.currentPlayer,
    playerColor:state.playerColor,
    aiColor:state.aiColor,
    character:state.character,
    handicap:state.handicap,
    difficulty:state.difficulty,
    history:state.history,
    gameOver:state.gameOver,
    moveCount:state.moveCount,
    redCaptured:state.redCaptured,
    blackCaptured:state.blackCaptured,
    roundsSincePlayerSkill:state.roundsSincePlayerSkill,
    roundsSinceAISkill:state.roundsSinceAISkill,
    skillActive:state.skillActive,
    lastMove:state.lastMove,
    /* v30-fix: 模式与 PVP 字段 */
    gameMode:state.gameMode,
    storyChapterId:state.storyChapterId,
    bkingLayer:state.bkingLayer,
    bkingCurrentForm:state.bkingCurrentForm,
    pvpRedChar:state.pvpRedChar,
    pvpBlackChar:state.pvpBlackChar,
    pvpRedActiveSkill:state.pvpRedActiveSkill,
    pvpBlackActiveSkill:state.pvpBlackActiveSkill,
    pvpRedPassive:state.pvpRedPassive,
    pvpBlackPassive:state.pvpBlackPassive,
    playerActiveSkill:state.playerActiveSkill,
    playerPassiveSkill:state.playerPassiveSkill,
    roundsSinceP2Skill:state.roundsSinceP2Skill,
    skillOwnerColor:state.skillOwnerColor,
    /* v30-fix: 技能临时状态 */
    oppSlowTurns:state.oppSlowTurns,
    oppPassiveDisabled:state.oppPassiveDisabled,
    silenceTurns:state.silenceTurns,
    oppSkillBlockedColor:state.oppSkillBlockedColor,
    oppCannotCapture:state.oppCannotCapture,
    playerCannotCapture:state.playerCannotCapture,
    aoeLockdownTurns:state.aoeLockdownTurns,
    barrageActive:state.barrageActive,
    stormActive:state.stormActive,
    catchActive:state.catchActive,
    controlActive:state.controlActive,
    lockedPiece:state.lockedPiece,
    lockTurns:state.lockTurns,
    ironwallTarget:state.ironwallTarget,
    ironwallTurns:state.ironwallTurns,
    hiddenPiece:state.hiddenPiece,
    aweActive:state.aweActive,
    counterActiveTurns:state.counterActiveTurns,
    counterStacks:state.counterStacks,
    confuseForcedMove:state.confuseForcedMove,
    predForcedMoves:state.predForcedMoves,
    /* v30-fix: 跨回合 buff 状态 */
    envyStolenPassives:state.envyStolenPassives,
    lustControlledPieces:state.lustControlledPieces,
    /* v30-fix: 三英模式 B王连击 */
    threeBKingTurns:state.threeBKingTurns,
    /* v30-fix: 天气系统 */
    weather:state.weather,
    weatherTurnsLeft:state.weatherTurnsLeft
  };
  localStorage.setItem('xiangqi_save',JSON.stringify(saveData));
  speakTaunt('棋局已保存！');
}

function loadGame(){
  const saved=localStorage.getItem('xiangqi_save');
  if(!saved){
    speakTaunt('没有找到存档！');
    return;
  }
  try{
    const data=JSON.parse(saved);
    /* v30-fix P0-3: 读档前先重置被动运行时状态（immunityUsed/counters 等），
       避免跨局残留导致 p_shield/p_shameless 等计数器失效。 */
    if(typeof resetPassives==='function') resetPassives();
    state.board=data.board;
    state.currentPlayer=data.currentPlayer;
    state.playerColor=data.playerColor;
    state.aiColor=data.aiColor;
    state.character=data.character;
    state.handicap=data.handicap;
    state.difficulty=data.difficulty;
    state.history=data.history;
    state.gameOver=data.gameOver;
    state.moveCount=data.moveCount;
    state.redCaptured=data.redCaptured;
    state.blackCaptured=data.blackCaptured;
    state.roundsSincePlayerSkill=data.roundsSincePlayerSkill;
    state.roundsSinceAISkill=data.roundsSinceAISkill;
    state.skillActive=data.skillActive;
    state.lastMove=data.lastMove;
    /* v30-fix P0-2/P1-8: 恢复模式与 PVP 字段（原仅恢复 14 个字段，
       导致 PVP 存档读档后变成 PVE，黑方技能按钮失效） */
    if(data.gameMode!==undefined) state.gameMode=data.gameMode;
    if(data.storyChapterId!==undefined) state.storyChapterId=data.storyChapterId;
    if(data.bkingLayer!==undefined) state.bkingLayer=data.bkingLayer;
    if(data.bkingCurrentForm!==undefined) state.bkingCurrentForm=data.bkingCurrentForm;
    if(data.pvpRedChar!==undefined) state.pvpRedChar=data.pvpRedChar;
    if(data.pvpBlackChar!==undefined) state.pvpBlackChar=data.pvpBlackChar;
    if(data.pvpRedActiveSkill!==undefined) state.pvpRedActiveSkill=data.pvpRedActiveSkill;
    if(data.pvpBlackActiveSkill!==undefined) state.pvpBlackActiveSkill=data.pvpBlackActiveSkill;
    if(data.pvpRedPassive!==undefined) state.pvpRedPassive=data.pvpRedPassive;
    if(data.pvpBlackPassive!==undefined) state.pvpBlackPassive=data.pvpBlackPassive;
    if(data.playerActiveSkill!==undefined) state.playerActiveSkill=data.playerActiveSkill;
    if(data.playerPassiveSkill!==undefined) state.playerPassiveSkill=data.playerPassiveSkill;
    if(data.roundsSinceP2Skill!==undefined) state.roundsSinceP2Skill=data.roundsSinceP2Skill;
    if(data.skillOwnerColor!==undefined) state.skillOwnerColor=data.skillOwnerColor;
    /* v30-fix: 恢复技能临时状态 */
    if(data.oppSlowTurns!==undefined) state.oppSlowTurns=data.oppSlowTurns;
    if(data.oppPassiveDisabled!==undefined) state.oppPassiveDisabled=data.oppPassiveDisabled;
    if(data.silenceTurns!==undefined) state.silenceTurns=data.silenceTurns;
    if(data.oppSkillBlockedColor!==undefined) state.oppSkillBlockedColor=data.oppSkillBlockedColor;
    if(data.oppCannotCapture!==undefined) state.oppCannotCapture=data.oppCannotCapture;
    if(data.playerCannotCapture!==undefined) state.playerCannotCapture=data.playerCannotCapture;
    if(data.aoeLockdownTurns!==undefined) state.aoeLockdownTurns=data.aoeLockdownTurns;
    if(data.barrageActive!==undefined) state.barrageActive=data.barrageActive;
    if(data.stormActive!==undefined) state.stormActive=data.stormActive;
    if(data.catchActive!==undefined) state.catchActive=data.catchActive;
    if(data.controlActive!==undefined) state.controlActive=data.controlActive;
    if(data.lockedPiece!==undefined) state.lockedPiece=data.lockedPiece;
    if(data.lockTurns!==undefined) state.lockTurns=data.lockTurns;
    if(data.ironwallTarget!==undefined) state.ironwallTarget=data.ironwallTarget;
    if(data.ironwallTurns!==undefined) state.ironwallTurns=data.ironwallTurns;
    if(data.hiddenPiece!==undefined) state.hiddenPiece=data.hiddenPiece;
    if(data.aweActive!==undefined) state.aweActive=data.aweActive;
    if(data.counterActiveTurns!==undefined) state.counterActiveTurns=data.counterActiveTurns;
    if(data.counterStacks!==undefined) state.counterStacks=data.counterStacks;
    if(data.confuseForcedMove!==undefined) state.confuseForcedMove=data.confuseForcedMove;
    if(data.predForcedMoves!==undefined) state.predForcedMoves=data.predForcedMoves;
    /* v30-fix: 恢复跨回合 buff 状态 */
    if(data.envyStolenPassives!==undefined) state.envyStolenPassives=data.envyStolenPassives||[];
    if(data.lustControlledPieces!==undefined) state.lustControlledPieces=data.lustControlledPieces||[];
    if(data.threeBKingTurns!==undefined) state.threeBKingTurns=data.threeBKingTurns;
    /* v30-fix: 恢复天气系统 */
    if(data.weather!==undefined) state.weather=data.weather;
    if(data.weatherTurnsLeft!==undefined) state.weatherTurnsLeft=data.weatherTurnsLeft;
    state.selected=null;
    state.validMoves=[];
    state.revealedMoves=null;
    state.suggestedMoves=null;
    state.aiPredictedMove=null;
    state.threatMarks=null;
    state.aiRoutePlan=[]; state.aiRouteTurns=0; state.routeDisplay=null;
    state.extraMove=0;
    state.weakenedAITurns=0;
    state.swapMode=false;
    state.celestialShield=false;
    state.aiExtraMoves=0;
    state.dodgeTarget=null;
    state.disguiseMode=false;
    if(!state.aweActive) state.aweActive=false;
    if(!state.awePieces) state.awePieces=[];
    if(!state.ironwallTarget){ state.ironwallTarget=null; state.ironwallTurns=0; }
    state.teleportMode=false;
    if(!state.lockedPiece){ state.lockedPiece=null; state.lockTurns=0; }
    if(!state.catchActive) state.catchActive=false;
    if(!state.controlActive){ state.controlActive=false; state.controlledMove=null; }
    if(!state.silenceTurns) state.silenceTurns=0;
    state.playerConfusedMove=null;
    if(!state.predForcedMoves) state.predForcedMoves={};
    state.forcedMovePending=false;
    if(state.forcedMoveTimer){ clearTimeout(state.forcedMoveTimer); state.forcedMoveTimer=null; }
    state.playerSkillLock=false; state.p2SkillLock=false; state.aiSkillLock=false;
    if(!state.skillOwnerColor) state.skillOwnerColor=null;
    const char=CHARACTERS[state.character];
    document.getElementById('player-avatar-char').textContent=char.char;
    document.getElementById('player-name').textContent=char.name;
    document.getElementById('player-style').textContent=char.title;
    const av=document.getElementById('player-avatar');
    av.style.borderColor=char.color; av.style.color=char.color;
    setAvatarPortrait(av, state.character);
    const diff=DIFFICULTIES[state.difficulty];
    document.getElementById('ai-name').textContent=diff.name;
    document.getElementById('ai-title').textContent=diff.title;
    const aiAv=document.querySelector('.opponent-card .player-avatar');
    setAvatarPortrait(aiAv, 'bking');
    setupCanvas();
    renderAll();
    updateTurnIndicator();
    updateCapturedDisplay();
    updateSkillDisplay();
    hideCheckWarning();
    speakTaunt('棋局已读取！');
    showScreen('screen-game');
  } catch(e){
    speakTaunt('存档损坏，无法读取！');
  }
}

window.addEventListener('resize',()=>{ if(state.board){ setupCanvas(); renderAll(); } });

/* ===== 复盘按钮事件 ===== */
document.getElementById('btn-replay-list').addEventListener('click',()=>showReplayList());
document.getElementById('replay-list-back').addEventListener('click',()=>showScreen('screen-welcome'));
document.getElementById('replay-back').addEventListener('click',()=>{
  if(replayState.playing){ replayTogglePlay(); }
  switchToGameCanvas();
  showReplayList();
});
document.getElementById('btn-result-replay').addEventListener('click',()=>{
  // 复盘刚刚结束的对局（取最近一条）
  const list=getReplayList();
  if(list.length>0) startReplay(list[0].id);
  else showScreen('screen-welcome');
});
document.getElementById('btn-replay-start').addEventListener('click',()=>replayGoto(0));
document.getElementById('btn-replay-prev').addEventListener('click',()=>replayStep(-1));
document.getElementById('btn-replay-play').addEventListener('click',()=>replayTogglePlay());
document.getElementById('btn-replay-next').addEventListener('click',()=>replayStep(1));
document.getElementById('btn-replay-end').addEventListener('click',()=>{
  if(replayState.data) replayGoto(replayState.data.moves.length);
});
document.getElementById('replay-bar').addEventListener('input',(e)=>{
  replayGoto(parseInt(e.target.value));
});

/* ===== 主界面：读取存档 / 手动保存记录 ===== */
document.getElementById('btn-load-save').addEventListener('click',()=>{
  const saved=localStorage.getItem('xiangqi_save');
  if(!saved){
    /* 无存档：弹出提示并引导查看图鉴 */
    showCharCodex();
    setTimeout(()=>speakTaunt('暂无存档，可在图鉴中查看玩法说明','self'),400);
    return;
  }
  loadGame();
});

/* 游戏图鉴弹层（原"启动说明"已替换为图鉴） */
document.getElementById('btn-help').addEventListener('click',()=>{
  showCharCodex();
});

/* 结局页：手动保存记录（再次写入复盘库） */
document.getElementById('btn-save-record').addEventListener('click',()=>{
  const lastWin = state.lastResult==='win';
  saveReplay(lastWin, state.lastResultReason||'manual');
  speakTaunt('本局记录已归档！');
});

/* ===== 音频系统已移至 js/audio.js ===== */
/* 初始化音频按钮状态 */
updateAudioButtons();
/* 绑定音频按钮（DOM 就绪后） */
bindAudioButtons();

/* ===== 新手教程系统（动态化：步数与数值从常量读取） ===== */
const TUTORIAL_STEPS = [
  { title:'欢迎', content:`欢迎来到博弈之王！这是一款融合角色技能与兵种相克的中国象棋。本教程共${0}步，带你快速上手。` },
  { title:'模式与解锁', content:`游戏模式：故事模式（初始仅第1章角色，通关解锁更多，全通关解锁B王/仙帝/大爱仙尊）；PVP（始终开放，含Ban位）；阵营模式（多色互相攻伐）；三英战B王。PVE需完成故事模式后解锁。点击模式卡片直接进入。` },
  { title:'选棋与操作菜单', content:'点击己方棋子弹出操作菜单：选择"进攻"进入移动模式，选择"详情"查看棋子属性（HP/攻防/兵种/Buff）。选将屏点击角色卡片会弹出技能选择面板。' },
  { title:'移动与吃子', content:'选中棋子后，绿色圆点表示可移动位置，红色圆圈表示可吃子位置。点击目标位置即可移动。吃子时双方互相结算伤害，只有HP归零棋子才被移除。' },
  { title:'兵种相克', content:`${Object.keys(PIECE_STATS).length}种兵种相克：炮(远程)打非远程不掉血（马例外可半反击）；车/马(进攻)无视30%防御；兵(特殊)受非帅非兵攻击只受35%伤害；非炮打相/士(防守)攻击方获虚弱buff；兵打帅+50%伤害。合理利用相克是制胜关键。` },
  { title:'HP与战斗体系', content:`每个棋子有HP/攻击/防御：帅(${PIECE_STATS.k.hp}/${PIECE_STATS.k.atk}/${PIECE_STATS.k.def})、车(${PIECE_STATS.r.hp}/${PIECE_STATS.r.atk}/${PIECE_STATS.r.def})、马(${PIECE_STATS.h.hp}/${PIECE_STATS.h.atk}/${PIECE_STATS.h.def})、炮(${PIECE_STATS.c.hp}/${PIECE_STATS.c.atk}/${PIECE_STATS.c.def})、相/士(${PIECE_STATS.e.hp}/${PIECE_STATS.e.atk}/${PIECE_STATS.e.def})、兵(${PIECE_STATS.p.hp}/${PIECE_STATS.p.atk}/${PIECE_STATS.p.def})。血条颜色随HP变化（绿→黄→红）。虚弱buff显示"虛"字。` },
  { title:'角色属性与技能选择', content:`选将时点击角色卡片弹出技能面板：主动技能选1（普通角色）或选3（B王，金色高亮）+ 被动技能选1或选2（数量>2时选2，朱红高亮）。角色属性（攻/防/智）影响棋子战斗加成。技能CD一般为2-7回合，B王有${CHARACTERS.bking.actives.length}个主动技能（七宗罪）。` },
  { title:'Buff与棋子合并', content:'技能产生的Buff双方HUD都会显示（虚弱/护盾/沉默/禁锢等）。部分技能会产生棋子合并（如分身/复活），合并时HP叠加，攻防取较高值，Buff合并去重。祝你在博弈之王的棋盘上所向披靡！' }
];
/* 动态注入步数（避免硬编码） */
TUTORIAL_STEPS[0].content = TUTORIAL_STEPS[0].content.replace('${0}', TUTORIAL_STEPS.length);
let tutorialStep = 0;

function shouldShowTutorial(){
  return !localStorage.getItem('bky_tutorial_done');
}

function showTutorial(){
  tutorialStep = 0;
  document.getElementById('tutorial-overlay').style.display = 'flex';
  renderTutorialStep();
}

function renderTutorialStep(){
  const step = TUTORIAL_STEPS[tutorialStep];
  document.getElementById('tutorial-step-num').textContent = tutorialStep + 1;
  const totalEl=document.getElementById('tutorial-step-total');
  if(totalEl) totalEl.textContent=TUTORIAL_STEPS.length;
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-content').textContent = step.content;
  document.getElementById('tutorial-prev').style.display = tutorialStep === 0 ? 'none' : 'block';
  document.getElementById('tutorial-next').textContent = tutorialStep === TUTORIAL_STEPS.length - 1 ? '完成' : '下一步';
}

function nextTutorialStep(){
  if(tutorialStep < TUTORIAL_STEPS.length - 1){
    tutorialStep++;
    renderTutorialStep();
  } else {
    closeTutorial();
  }
}

function prevTutorialStep(){
  if(tutorialStep > 0){
    tutorialStep--;
    renderTutorialStep();
  }
}

function closeTutorial(){
  document.getElementById('tutorial-overlay').style.display = 'none';
  localStorage.setItem('bky_tutorial_done', '1');
}

document.getElementById('tutorial-next').addEventListener('click', nextTutorialStep);
document.getElementById('tutorial-prev').addEventListener('click', prevTutorialStep);
document.getElementById('tutorial-skip').addEventListener('click', closeTutorial);

/* ===== 初始化 ===== */
renderCharacterCards();
setupCanvas();
