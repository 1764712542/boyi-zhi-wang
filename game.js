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
  roundsSincePlayerSkill:3, roundsSinceAISkill:3,
  skillActive:null, revealedMoves:null, suggestedMoves:null, aiPredictedMove:null,
  threatMarks:null, extraMove:0, weakenedAITurns:0, swapMode:false,
  boardSnapshots:[], celestialShield:false, celestialPrediction:null,
  playerCannotCapture:false, aiExtraMoves:0,
  dodgeTarget:null, disguiseMode:false, aweActive:false, awePieces:[],
  counterEyeTurns:0, aiSkillBlocked:false,
  playerConfusedMove:null, /* B王·指鹿为马：玩家下回合强制走这步 */
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
  immuneFirstTurn:false, /* 首回合免疫 */
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
  eliminatedPlayers:[]
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
/* 显示多步路线（带序号+路径箭头+流动动画），steps=显示前N步 */
function showRoutePlan(plan, color, labelPrefix){
  state.aiRoutePlan=plan.slice();
  state.aiRouteTurns=plan.length;
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
  const buffList = document.getElementById('hud-buff-list');
  const redEl = document.getElementById('hud-red-stats');
  const blackEl = document.getElementById('hud-black-stats');
  const hintEl = document.getElementById('hud-type-hint');
  const skillEl = document.getElementById('hud-skill-status');
  if(!buffList || !redEl || !blackEl || !hintEl) return;
  if(!state.board) return;

  /* v12: 收集双方带 buff 的棋子，显示 buff 名称与具体数值影响 */
  const redBuffs = [];
  const blackBuffs = [];
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const p = state.board[r][c];
      if(!p || !p.buffs || !p.buffs.length) continue;
      const charName = (PIECE_CHAR[p.player] && PIECE_CHAR[p.player][p.type]) || '';
      const list = p.player===RED ? redBuffs : (p.player===BLACK ? blackBuffs : null);
      if(!list) continue;
      p.buffs.forEach(b=>{
        const info = getBuffDesc(b);
        list.push({label:`${charName}·${info.name}(${info.desc}, ${b.duration}回)`});
      });
    }
  }
  const renderSideBuffs = (title, sideClass, list) => `
    <div class="hud-side-buffs">
      <div class="hud-side-title ${sideClass}">${title}</div>
      ${list.length ? list.map(b=>`<div class="hud-buff-item ${sideClass}">${b.label}</div>`).join('') : '<div class="hud-empty">无</div>'}
    </div>`;
  buffList.innerHTML =
    renderSideBuffs('红方', 'red', redBuffs) +
    renderSideBuffs('黑方', 'black', blackBuffs);

  /* 1.5 角色属性加成显示（与 calcDamage 一致：charAtk/10、charDef/10） */
  const attrsEl = document.getElementById('hud-charattrs');
  if(attrsEl){
    const isPvpAttrs = (state.gameMode==='pvp'||state.gameMode==='online');
    const redCharId = isPvpAttrs ? state.pvpRedChar : state.character;
    const blackCharId = isPvpAttrs ? state.pvpBlackChar : 'bking';
    const redCh = (redCharId && typeof CHARACTERS!=='undefined' && CHARACTERS[redCharId]) ? CHARACTERS[redCharId] : null;
    const blackCh = (blackCharId && typeof CHARACTERS!=='undefined' && CHARACTERS[blackCharId]) ? CHARACTERS[blackCharId] : null;
    let attrsHtml = '';
    if(redCh){
      attrsHtml += `<div class="hud-attr-row red">
        <span class="hud-attr-name">${redCh.name}</span>
        <span>攻+${Math.floor((redCh.stats?.atk||0)/10)}</span>
        <span>防+${Math.floor((redCh.stats?.def||0)/10)}</span>
        <span>智${Math.floor((redCh.stats?.int||0)/10)}</span>
      </div>`;
    }
    if(blackCh){
      attrsHtml += `<div class="hud-attr-row black">
        <span class="hud-attr-name">${blackCh.name}</span>
        <span>攻+${Math.floor((blackCh.stats?.atk||0)/10)}</span>
        <span>防+${Math.floor((blackCh.stats?.def||0)/10)}</span>
        <span>智${Math.floor((blackCh.stats?.int||0)/10)}</span>
      </div>`;
    }
    attrsEl.innerHTML = attrsHtml || '<div class="hud-empty">无</div>';
  }

  /* v14: 选中棋子的完整属性显示（基础 + 角色加成 + buff 影响）
     - state.selected：己方棋子（可移动）
     - state.inspect：对方棋子（只读查看，用于判断 debuff 是否生效）
     两者都使用 {row, col} 字段 */
  const selEl = document.getElementById('hud-selected-piece');
  if(selEl){
    const target = state.selected || state.inspect;
    if(target && state.board){
      const sr = target.row!==undefined ? target.row : target.r;
      const sc = target.col!==undefined ? target.col : target.c;
      const p = state.board[sr] && state.board[sr][sc];
      if(p){
        const isInspect = !state.selected; /* 查看模式（对方棋子） */
        const stats = getPieceEffectiveStats(p);
        const chars = PIECE_CHAR[p.player]||PIECE_CHAR.red;
        const pieceName = chars[p.type]||'?';
        const typeName = PIECE_TYPE_NAME[p.ptype]||'未知';
        const sideName = p.player===RED?'红':(p.player===BLACK?'黑':p.player);
        /* 攻击力显示：基础(+角色加成) → 最终值，buff 影响单独标注 */
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
          html += '<div class="hud-sel-buffs">';
          stats.buffs.forEach(b=>{
            html += `<div class="hud-sel-buff">
              <span class="hud-sel-buff-name">${b.name}</span>
              <span class="hud-sel-buff-desc">${b.desc}</span>
              <span class="hud-sel-buff-dur">${b.duration}回</span>
            </div>`;
          });
          html += '</div>';
        }
        selEl.innerHTML = html;
      } else {
        selEl.innerHTML = '<div class="hud-empty">点击棋子查看</div>';
      }
    } else {
      selEl.innerHTML = '<div class="hud-empty">点击棋子查看</div>';
    }
  }

  /* 2. 双方技能冷却状态 */
  if(skillEl){
    const isPvp = (state.gameMode==='pvp'||state.gameMode==='online');
    let redCharId, blackCharId, redCD, blackCD;
    let redSkillObj = null, blackSkillObj = null;
    if(isPvp){
      redCharId = state.pvpRedChar;
      blackCharId = state.pvpBlackChar;
      redCD = state.roundsSincePlayerSkill;
      blackCD = state.roundsSinceP2Skill;
      redSkillObj = state.pvpRedActiveSkill;
      blackSkillObj = state.pvpBlackActiveSkill;
    } else {
      redCharId = state.character;
      blackCharId = 'bking';
      redCD = state.roundsSincePlayerSkill;
      blackCD = state.roundsSinceAISkill;
      redSkillObj = state.playerActiveSkill;
    }
    const redChar = CHARACTERS[redCharId] || {};
    const blackChar = CHARACTERS[blackCharId] || {};
    /* v16: CD 按选中技能实际 cd 计算，与 canUseSkill 同步 */
    const redSkill = redSkillObj || redChar.skill || {};
    const blackSkill = blackSkillObj || blackChar.skill || {};
    const redThreshold = Math.max(1, (redSkill.cd||3) + (state.bkingCdIncrease||0) - (state.skillCdReduce||0));
    const blackThreshold = Math.max(1, (blackSkill.cd||3) + (state.bkingCdIncrease||0));
    const redCDLeft = Math.max(0, redThreshold - redCD);
    const blackCDLeft = Math.max(0, blackThreshold - blackCD);
    const fmtSkill = (name, cdLeft, silenced) => {
      if(silenced) return `${name}(沉默)`;
      return cdLeft===0 ? `${name}(就绪)` : `${name}(冷${cdLeft})`;
    };
    /* v17: PVP 被封锁方显示"沉默"状态 */
    const redSilenced = (state.gameMode==='pvp'||state.gameMode==='online')
      && state.oppSkillBlockedColor===RED && state.silenceTurns>0;
    const blackSilenced = (state.gameMode==='pvp'||state.gameMode==='online')
      && state.oppSkillBlockedColor===BLACK && state.silenceTurns>0;
    skillEl.innerHTML = `
      <div class="hud-skill-row red">红方: ${fmtSkill(redSkill.name||'—', redCDLeft, redSilenced)}</div>
      <div class="hud-skill-row black">黑方: ${fmtSkill(blackSkill.name||'—', blackCDLeft, blackSilenced)}</div>`;
  }

  /* v17: 双方被动技能显示 */
  const passiveEl = document.getElementById('hud-passive-status');
  if(passiveEl){
    const redPassive = getPassiveForColor(RED);
    const blackPassive = getPassiveForColor(BLACK);
    const fmtPassive = (p) => {
      if(!p) return '—';
      /* v17: 显示被动名称+触发类型，避免与主动技能同名混淆 */
      const triggerLabel = getPassiveTriggerLabel(p.trigger);
      return `${p.name} [${triggerLabel}]`;
    };
    passiveEl.innerHTML = `
      <div class="hud-skill-row red">红方: ${fmtPassive(redPassive)}</div>
      <div class="hud-skill-row black">黑方: ${fmtPassive(blackPassive)}</div>`;
  }

  /* v18: 侧边面板 — 双方各自显示被动技能详情 + 状态列表
     面板按位置固定：左侧=黑方(对手/B王)，右侧=红方(玩家)
     这与 player-card 的 avatar 布局一致（左 avatar-black，右 avatar-red） */
  const fmtPassiveDetail = (p) => {
    if(!p) return '<div class="side-empty">—</div>';
    const triggerLabel = getPassiveTriggerLabel(p.trigger);
    return `<div class="side-passive-item">
      <div><span class="sp-name">${p.name}</span><span class="sp-trigger">${triggerLabel}</span></div>
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

  /* v14: 各方棋子攻防统计 — 使用 getPieceEffectiveStats 计算有效属性
     包含角色加成（charAtk/charDef）和 buff 影响（attackBoost/weakness/ironwall 等）
     这样技能释放后兵力面板会实时反映 buff 加成 */
  const redStats = { count:0, totalAtk:0, totalDef:0, totalHp:0, buffCount:0 };
  const blackStats = { count:0, totalAtk:0, totalDef:0, totalHp:0, buffCount:0 };
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
      if(p.buffs && p.buffs.length) stats.buffCount += p.buffs.length;
    }
  }
  redEl.innerHTML =
    `<div class="hud-side">红方</div><div>子:${redStats.count}</div><div>攻:${redStats.totalAtk}</div><div>防:${redStats.totalDef}</div><div>血:${redStats.totalHp}</div>${redStats.buffCount?`<div class="hud-buff-count">buff×${redStats.buffCount}</div>`:''}`;
  blackEl.innerHTML =
    `<div class="hud-side">黑方</div><div>子:${blackStats.count}</div><div>攻:${blackStats.totalAtk}</div><div>防:${blackStats.totalDef}</div><div>血:${blackStats.totalHp}</div>${blackStats.buffCount?`<div class="hud-buff-count">buff×${blackStats.buffCount}</div>`:''}`;

  /* 4. 兵种相克提示 */
  hintEl.innerHTML = `
    <div class="hud-hint-item">炮(远程)→非远程：不掉血</div>
    <div class="hud-hint-item">车/马→任意：无视30%防御</div>
    <div class="hud-hint-item">兵(特殊)→非帅：受50%伤害</div>
    <div class="hud-hint-item">非炮→相/士：攻击方虚弱</div>
    <div class="hud-hint-item">兵→帅：+50%伤害</div>
  `;
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
  if(state.skillActive==='ironwall'){
    const p=state.board[r][c];
    if(p&&p.player===mc&&p.type!==T.KING){
      addBuff(p, 'ironwall', 0, 2);     /* 铁壁：防御×2，2回合 */
      addBuff(p, 'attackBoost', 30, 2); /* 攻击+30（约+50%），2回合 */
      state.skillActive='ironwall-active';
      state.ironwallTarget={r,c}; /* 保留用于反吃逻辑 */
      state.ironwallTurns=2;
      speakTaunt('狂战之怒！这颗子2回合内攻防翻倍，攻击者反被吃！','self');
      updateSkillDisplay();
      renderAll();
      return;
    }
    state.skillActive=null;
    state.ironwallTarget=null;
    renderAll();
    return;
  }

  // 胡浩·正道护体（v13: 选中棋子后挂 shield + defenseBoost buff）
  if(state.shieldMode){
    const p=state.board[r][c];
    if(p&&p.player===mc&&p.type!==T.KING){
      addBuff(p, 'shield', state.shieldAmount||100, 3); /* 护盾：吸收100伤害 */
      addBuff(p, 'defenseBoost', Math.floor((p.def||0)*0.3), 3); /* 防御+30% */
      state.shieldMode=false;
      state.shieldAmount=0;
      state.shieldDefBuff=0;
      speakTaunt('正道护体！护盾已就位，防御+30%！','self');
      updateSkillDisplay();
      renderAll();
      return;
    }
    state.shieldMode=false;
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
    /* v13: 优雅闪烁 — 瞬移后给该棋子挂 attackBoost buff（攻击+30%，2回合） */
    if(state.teleportBuff>0){
      const atkBonus = Math.floor((piece.atk||0) * state.teleportBuff);
      addBuff(piece, 'attackBoost', atkBonus, 2);
      state.teleportBuff=0;
      speakTaunt('优雅闪烁！瞬移完成，攻击+30%！','self');
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
  bkiller: { name:'弑王', desc:(b)=>`对B王棋子伤害+${Math.round((b.value||0.5)*100)}%` }
};
function getBuffDesc(b){
  const m = BUFF_DESC_MAP[b.type];
  if(!m) return { name:b.type||'未知', desc:'' };
  return { name:m.name, desc:m.desc(b) };
}
function tickBuffs(player){
  if(!player) return;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=state.board[r][c];
    if(!p || !p.buffs || p.player!==player) continue;
    for(const b of p.buffs){
      if(b._fresh){ b._fresh=false; continue; } /* 本回合新增：跳过首次递减 */
      b.duration--;
    }
    p.buffs = p.buffs.filter(b => b.duration>0);
    if(p.buffs.length===0) delete p.buffs;
  }
}
function doMove(from,to){
  const piece=state.board[from.r][from.c];
  let captured=state.board[to.r][to.c];
  /* 技能激活者颜色（PVP/PVE通用）：PVE默认为playerColor */
  const skillOwner = state.skillOwnerColor || state.playerColor;
  const skillOpp = skillOwner===RED?BLACK:RED;

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
    // 50%概率打偏（攻击失败），并反击吃掉攻击者
    if(Math.random()<0.5){
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
  if(state.celestialShield&&state.currentPlayer===skillOpp&&captured&&captured.player===skillOwner){
    const altMoves=getLegalAIMoves(state.board,skillOpp).filter(m=>!state.board[m.tr][m.tc]||state.board[m.tr][m.tc].player!==skillOwner);
    if(altMoves.length>0){
      const m=altMoves[Math.floor(Math.random()*altMoves.length)];
      to={r:m.tr,c:m.tc};
      captured=state.board[to.r][to.c];
      speakTaunt('仙帝护盾？换一路走！');
    }
  }

  // 铜墙铁壁/课堂点名/异常捕获：对方不能吃子
  if((state.skillActive==='shield'||state.skillActive==='catch-shield')&&state.currentPlayer===skillOpp&&captured){
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
    /* v4.0 闪避被动：dodgeNext 时撤销吃子 */
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
    /* v13: 防守方免疫时双方不掉血 */
    if(dmg.defenderImmune){
      attacker.hp -= 0; defender.hp -= 0;
      speakTaunt('免疫！伤害无效！');
    } else {
      attacker.hp-=dmgToAttacker;
      defender.hp-=dmgToDefender;
      /* v13: 反伤 buff（reflect）— 由 calcDamage 计算并返回 */
      if(dmg.reflectDmg > 0){
        attacker.hp -= dmg.reflectDmg;
        speakTaunt('反伤！反弹'+dmg.reflectDmg+'伤害！');
      }
    }
    /* v13: 消耗 executeMark buff（必中标记：攻击命中后移除） */
    if(dmg.executeMarkBuff){
      consumeBuff(attacker, 'executeMark');
    }
    /* 规则5：非炮打相/士 → 攻击方获虚弱 buff
       重新赋值新数组，避免与 histEntry.piece 的浅拷贝共享引用（悔棋还原时干净） */
    if(dmg.attackerBuff){
      attacker.buffs = [...(attacker.buffs||[]), { ...dmg.attackerBuff, _fresh:true }];
    }
    if(defender.hp<=0){
      /* 防守方阵亡：攻击方占据目标位置，防守方入阵亡名单，触发被动 */
      histEntry.actualCaptured=defender;
      pushCaptured(defender);
      if(state.gameMode==='pve'&&state.currentPlayer===state.aiColor) speakTaunt(pick(B_TAUNTS.capture));
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
        passivesOnCaptured(victimChar, capturerChar, defender);
      }
      /* v16: 同归于尽 — 攻击方也阵亡，入阵亡名单并清空位置（之前攻击方 hp<=0 仍占据棋盘） */
      if(attacker.hp<=0){
        histEntry.actualAttackerCaptured=attacker;
        pushCaptured(attacker);
        state.board[to.r][to.c]=null; /* 攻击方也移出棋盘 */
        speakTaunt('同归于尽！');
      }
    }else if(attacker.hp<=0){
      /* 攻击方阵亡：防守方留守原地，攻击方入阵亡名单 */
      histEntry.actualCaptured=attacker;
      state.board[to.r][to.c]=defender;
      pushCaptured(attacker);
    }else{
      /* 双方存活：攻击方退回原位，双方带伤留在棋盘上 */
      histEntry.actualCaptured=null;
      state.board[from.r][from.c]=attacker;
      state.board[to.r][to.c]=defender;
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
    if(state.silenceTurns>0&&state.currentPlayer===state.aiColor){
      state.silenceTurns--;
    }
    // B王洞察：玩家走完后解除禁制（只持续一回合）
    if(state.playerCannotCapture&&state.currentPlayer===state.playerColor){
      state.playerCannotCapture=false;
    }
    /* v17: 对方禁吃解除（被禁吃方走完后清除，只持续一回合） */
    if(state.oppCannotCapture&&state.currentPlayer===so){
      state.oppCannotCapture=false;
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
    if(state.extraMove>0){
      state.extraMove--;
      state.currentPlayer=so;
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
    /* v16: 递减一次性技能标记（之前只写不读，导致技能效果永久残留） */
    if(state.aoeLockdownTurns>0) state.aoeLockdownTurns--;
    if(state.oppSlowTurns>0) state.oppSlowTurns--;
    if(state.oppPassiveDisabled>0) state.oppPassiveDisabled--;
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
      speakTaunt('标准答案！对方被迫按你的答案行棋！','opp');
      setTimeout(()=>{ doMove(cm.from,cm.to); },800);
      return;
    }
    // B王·指鹿为马：玩家回合开始时强制走指定的一步
    if(!state.gameOver&&state.playerConfusedMove&&state.currentPlayer===state.playerColor){
      const cm=state.playerConfusedMove;
      state.playerConfusedMove=null;
      speakTaunt('被指鹿为马了！只能按本王的意思走...');
      setTimeout(()=>{ doMove(cm.from,cm.to); },800);
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
          state.blackCaptured.push(piece);
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
    } else if(state.roundsSinceAISkill>=3) aiSkip=maybeAISkill();
    if(aiSkip){
      state.aiThinking=false; showThinking(false);
      updateTurnIndicator();
      return;
    }
    let depth=diff.depth;
    if(state.skillActive==='weaken'||state.weakenedAITurns>0) depth=Math.max(1,depth-2);
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
      // 破妄之眼沉默：30%概率走"艺术走法"（随机走）
      if(state.silenceTurns>0&&Math.random()<0.3&&legalMoves.length>0){
        const m=legalMoves[Math.floor(Math.random()*legalMoves.length)];
        move={from:{r:m.fr,c:m.fc},to:{r:m.tr,c:m.tc}};
        speakTaunt('沉默干扰！本王走错了...','opp');
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
  if(state.skillActive==='ironwall') return false;
  /* v5.0 多阵营/4v4：技能系统暂未适配多玩家，禁用主动技能以保持稳定 */
  if(state.gameMode==='faction'||state.gameMode==='4v4') return false;
  if(state.gameMode==='three'){
    if(state.currentPlayer!==state.playerColor) return false;
    /* v19: 读取选中技能实际 CD，不再硬编码 3 */
    const skill=getActiveSkillForCurrentPlayer();
    const baseCd=(skill&&skill.cd)||3;
    const threshold=Math.max(1, baseCd + (state.bkingCdIncrease||0) - (state.skillCdReduce||0));
    const cd=state.threeHeroCDs[state.threeHeroIndex]||0;
    return cd>=threshold;
  }
  /* v16: 根据选中技能实际 cd 判断就绪，不再硬编码 3 */
  const skill=getActiveSkillForCurrentPlayer();
  const baseCd=(skill&&skill.cd)||3;
  /* 仙帝威压 +1 CD；掀桌之神/天道因果 -1（最低 1） */
  const threshold=Math.max(1, baseCd + (state.bkingCdIncrease||0) - (state.skillCdReduce||0));
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    if(state.gameMode==='online'&&state.currentPlayer!==netMyColor) return false;
    /* v17: PVP 技能封锁检查 — 对方释放 silence 后，被封锁方不能用技能
       oppSkillBlockedColor 在 silenceTurns 耗尽前持续封锁（与 PVE 一致） */
    if(state.oppSkillBlockedColor===state.currentPlayer&&state.silenceTurns>0) return false;
    const cd=state.currentPlayer===RED?state.roundsSincePlayerSkill:state.roundsSinceP2Skill;
    return cd>=threshold;
  }
  /* PVE */
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
   PVP: oppSkillBlockedColor=对方颜色（对方回合不能用技能） */
function blockOppSkill(){
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    state.oppSkillBlockedColor = oppColor();
  } else {
    state.aiSkillBlocked = true;
  }
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
          def:PIECE_STATS[T.PAWN].def
        };
        return;
      }
    }
  }
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
      break;
    case 'rollcall': // 王昕·课堂点名（展示B王3步路线+B王不能吃子）
      {
        const plan=buildAIRoutePlan(3);
        if(plan.length>0) showRoutePlan(plan,'#2d5a3d','B');
        state.skillActive='shield'; // B王不能吃子（忙着回答问题）
      }
      break;
    case 'teleport': // 周子翰·江山易主（传送己方棋子到任意空位）
      state.teleportMode=true;
      speakTaunt('选择一颗己方棋子进行乾坤挪移！','self');
      break;
    case 'ironwall': // 三金·狂战之怒（v13: 挂 ironwall+attackBoost buff 到选中棋子，2回合）
      state.skillActive='ironwall';
      state.ironwallTarget=null;
      speakTaunt('选择一颗己方棋子激发狂战之怒！','self');
      break;
    case 'disguise': // 鸡哥·完美伪装（互换位置+混乱攻击）
      state.disguiseMode=true;
      speakTaunt('选择一颗己方棋子进行伪装！','self');
      break;
    case 'weaken': // ikun·唱跳rap（三回合弱化）
      state.skillActive='weaken';
      state.weakenedAITurns=3;
      break;
    case 'revive': // 胡浩·浩然正气（复活两颗+额外回合）
      {
        const cap=myCaptured();
        let revived=0;
        while(cap.length>0&&revived<2){
          const piece=cap.pop();
          let placed=false;
          /* 红方从底部放置，黑方从顶部放置 */
          const rs=myColor()===RED?ROWS-1:0;
          const re=myColor()===RED?-1:ROWS;
          const st=myColor()===RED?-1:1;
          for(let r=rs;r!==re&& !placed;r+=st) for(let c=0;c<COLS&&!placed;c++)
            if(!state.board[r][c]){ state.board[r][c]={...piece,player:myColor()}; placed=true; }
          revived++;
        }
        state.extraMove=1;
      }
      break;
    case 'lockdown': // 解宇轩·因果律锁（锁定对方一颗棋子3回合不能移动）
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
        if(cand.length===0){ speakTaunt('对方无可锁定棋子！','self'); return; }
        // 选择价值最高的对方棋子锁定
        cand.sort((a,b)=>PIECE_VALUE[b.type]-PIECE_VALUE[a.type]);
        const target=cand[0];
        state.lockedPiece={r:target.r,c:target.c};
        state.lockTurns=3;
        speakTaunt(`因果律锁！${PIECE_CHAR[oc===RED?'red':'black'][target.type]}被禁锢3回合！`,'self');
      }
      break;
    case 'catch': // 陆星辰·异常捕获（对方下回合不能吃子+己方下回合连走两步）
      state.catchActive=true;
      state.skillActive='catch-shield'; // 对方下回合不能吃子
      speakTaunt('异常捕获！你的攻击已被try-catch！下回合我连走两步！','self');
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
        if(safe.length===0){ speakTaunt('对方无路可走！','self'); return; }
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
      }
      break;
    case 'awe': // 仙帝Alice·命定因果（对方弃最强子+仙帝命定3步路线+对方不能吃子）
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
      }
      break;
    case 'silence': // 刘雪沛·破妄之眼（沉默B王3回合+30%走错概率）
      state.silenceTurns=3;
      blockOppSkill(); // v17: 统一封锁对方技能（PVP/PVE）
      speakTaunt('破妄之眼！B王，你的装逼到此为止！3回合内无法使用奇术！','self');
      break;
    case 'logic_silence': // 解宇轩·逻辑沉默（沉默2回合+对方下回合无法吃子）
      state.silenceTurns=2;
      blockOppSkill();
      state.oppCannotCapture=true; /* v19: 新增 — 对方下回合禁吃 */
      speakTaunt('逻辑沉默！2回合内你无法使用奇术，且下回合无法吃子！','self');
      break;
    case 'flip': // 大汉棋圣·掀桌不玩了（回溯3步+保留先手）
      {
        // 使用棋盘快照回溯最多3步
        const steps=Math.min(3, state.boardSnapshots.length);
        if(steps>0){
          // 回溯到3步前的状态
          for(let i=0;i<steps;i++){
            const lastIdx=state.boardSnapshots.length-1;
            state.boardSnapshots.splice(lastIdx,1);
          }
          state.board=cloneBoard(state.boardSnapshots[state.boardSnapshots.length-1]||state.board);
          // 回退历史记录
          for(let i=0;i<steps;i++){
            if(state.history.length>0){
              const last=state.history.pop();
              state.moveCount=Math.max(0,state.moveCount-1);
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
      break;
    case 'flex': // B王·装逼时刻（撤销对手一步+额外走一步）
      {
        const opponent=state.currentPlayer===RED?BLACK:RED;
        if(state.history.length>=1){
          let lastOpp=null;
          for(let i=state.history.length-1;i>=0;i--){ if(state.history[i].player===opponent){ lastOpp=state.history[i]; break; } }
          if(lastOpp){
            state.board[lastOpp.from.r][lastOpp.from.c]=lastOpp.piece;
            state.board[lastOpp.to.r][lastOpp.to.c]=lastOpp.captured;
            if(lastOpp.captured){
              if(lastOpp.captured.player===RED) state.redCaptured.pop();
              else state.blackCaptured.pop();
            }
            const idx=state.history.indexOf(lastOpp);
            state.history.splice(idx,1);
            state.moveCount--;
            removeLastHistoryEntry();
            state.currentPlayer=state.currentPlayer; // 保持当前回合
            state.lastMove=state.history.length>0?{from:state.history[state.history.length-1].from,to:state.history[state.history.length-1].to}:null;
            state.extraMove=1; // 额外一回合
          }
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
          renderAll(); updateCapturedDisplay();
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
        }
      }
      break;
    case 'combo': // 罗伦杰·连环斩（吃1子后再吃1子）
      {
        const mc=myColor();
        const oc=oppColor();
        const myMoves=getLegalAIMoves(state.board,mc);
        const captureMoves=myMoves.filter(m=>state.board[m.tr][m.tc]&&state.board[m.tr][m.tc].player===oc);
        if(captureMoves.length===0){
          speakTaunt('连环斩需要先吃一子！','self');
          return;
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
            speakTaunt('连环斩！双杀！','self');
          }
        },600);
      }
      break;
    /* ===== v10: 补全替代主动技能（actives[1]/actives[2]）===== */

    /* 侯智博·暗度陈仓：沉默对方2回合+对方下回合攻击-30% */
    case 'flank':
      state.silenceTurns=2;
      addTeamBuff(state.board, oppColor(), 'weakness', 0.3, 1); /* v17: 对方全体攻击-30%（buff系统） */
      blockOppSkill(); /* v17: 统一封锁对方技能 */
      speakTaunt('暗度陈仓！沉默两回合，攻势亦减！','self');
      break;
    /* 侯智博·奇兵破阵：全场禁锢对方1回合+己方连走2步 */
    case 'ambush':
      state.aoeLockdownTurns=1;
      state.extraMove=1;
      speakTaunt('奇兵破阵！全军禁锢！我连走两步！','self');
      break;

    /* 王昕·妙语嘲讽：对方下回合移动力-50%+攻击-25% */
    case 'mock':
      state.oppSlowTurns=1;
      addTeamBuff(state.board, oppColor(), 'weakness', 0.25, 1); /* v17: 对方全体攻击-25%（buff系统） */
      speakTaunt('妙语嘲讽！慢慢来，攻击也弱了！','self');
      break;
    /* 王昕·考试突击：己方全体护盾(80)+连走2步 */
    case 'quiz':
      /* v19: 改用 buff 系统使护盾生效（原 state.teamShield 只写不读） */
      addTeamBuff(state.board, myColor(), 'shield', 80, 3);
      state.extraMove=1;
      speakTaunt('考试突击！全员护盾，再走两步！','self');
      break;

    /* 周子翰·优雅闪烁：己方棋子瞬移+下回合攻击+30% */
    case 'elegant':
      /* v13: 瞬移后由 selectPiece 处理，瞬移完成时挂 attackBoost buff */
      state.teleportMode=true;
      state.teleportBuff=0.3; /* 保留兼容：瞬移完成后挂 buff */
      speakTaunt('优雅闪烁！选一颗棋子瞬移！','self');
      break;
    /* 周子翰·乾坤大挪移：互换双方各1子+己方连走2步
       v19：改为两阶段选棋（先敌方一子→再己方一子），修复互换方向错误等恶性 Bug */
    case 'grandshift':
      state.swapMode=true;
      state.swapPhase='enemy';
      state.swapTargetA=null;
      state.extraMove=1;
      speakTaunt('乾坤大挪移！先选敌方一颗棋子！','self');
      break;

    /* 三金·嗜血斩杀（v13: 挂 executeMark buff 到价值最高的己方攻击棋子，下次攻击+50%伤害） */
    case 'execute':
      {
        const mc=myColor();
        const cand=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type!==T.KING&&p.type!==T.ADVISOR&&p.type!==T.ELEPHANT){
            cand.push({r,c,type:p.type,piece:p});
          }
        }
        if(cand.length===0){ speakTaunt('无可标记棋子！','self'); return; }
        /* 选价值最高的己方棋子作为攻击者 */
        cand.sort((a,b)=>PIECE_VALUE[b.type]-PIECE_VALUE[a.type]);
        const t=cand[0];
        addBuff(t.piece, 'executeMark', 0.5, 1);
        speakTaunt('嗜血斩杀！'+PIECE_CHAR[mc===RED?'red':'black'][t.type]+'攻击+50%，下次必中！','self');
      }
      break;
    /* 三金·兄弟连斩（v13: 挂 attackBoost buff 到己方全体，2回合；吃子后可再走） */
    case 'barrage':
      addTeamBuff(state.board, myColor(), 'attackBoost', 24, 2); /* +40% 基础攻击约等于 +24 */
      state.barrageActive=true; /* 吃子后可再走 */
      speakTaunt('兄弟连斩！全军攻击+40%，持续2回合！','self');
      break;

    /* 鸡哥·分身幻象：召唤1个己方兵（HP100）到空位 */
    case 'illusion':
      summonPawnForColor(myColor(), 100);
      speakTaunt('分身幻象！新的棋子登场！','self');
      break;
    /* 鸡哥·虚晃一枪：对方下回合攻击打偏+全体无法移动 */
    case 'feint':
      state.oppMissNext=true;
      state.aoeLockdownTurns=1;
      speakTaunt('虚晃一枪！全军打偏，无法移动！','self');
      break;

    /* ikun·节奏掌控：对方下回合移动力-50%+沉默1回合 */
    case 'rhythm':
      state.oppSlowTurns=1;
      state.silenceTurns=1;
      blockOppSkill(); /* v17: 统一封锁对方技能 */
      speakTaunt('节奏掌控！跟不上我的节奏吧！','self');
      break;
    /* ikun·全给你（v13: 挂 reflect buff 到己方全体，3回合） */
    case 'allyours':
      addTeamBuff(state.board, myColor(), 'reflect', 0.5, 3);
      state.extraMove=1;
      speakTaunt('全给你！反弹五成，连走两步！','self');
      break;

    /* 胡浩·正道护体（v13: 挂 shield+defenseBoost buff 到选中棋子） */
    case 'shield':
      state.shieldMode=true; /* 进入选择棋子模式 */
      state.shieldAmount=100;
      state.shieldDefBuff=0.3;
      speakTaunt('正道护体！选一颗棋子加护盾！','self');
      break;
    /* 胡浩·万法归一（v13: 复活+挂 attackBoost buff 到己方全体，2回合） */
    case 'unity':
      {
        const cap=myCaptured();
        let revived=0;
        while(cap.length>0&&revived<3){
          const piece=cap.pop();
          const rs=myColor()===RED?ROWS-1:0;
          const re=myColor()===RED?-1:ROWS;
          const st=myColor()===RED?-1:1;
          let placed=false;
          for(let r=rs;r!==re&&!placed;r+=st) for(let c=0;c<COLS&&!placed;c++)
            if(!state.board[r][c]){ state.board[r][c]={...piece,player:myColor()}; placed=true; }
          revived++;
        }
        addTeamBuff(state.board, myColor(), 'attackBoost', 12, 2); /* +20% 约等于 +12 */
        speakTaunt('万法归一！复活+全军攻击+20%，持续2回合！','self');
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
      break;

    /* 陆星辰·Debug扫描（v13: 挂 executeMark buff 到价值最高的己方攻击棋子，下次攻击+50%伤害） */
    case 'debug':
      {
        const mc=myColor();
        const cand=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type!==T.KING&&p.type!==T.ADVISOR&&p.type!==T.ELEPHANT){
            cand.push({r,c,type:p.type,piece:p});
          }
        }
        if(cand.length===0){ speakTaunt('无Bug可扫！','self'); return; }
        cand.sort((a,b)=>PIECE_VALUE[b.type]-PIECE_VALUE[a.type]);
        const t=cand[0];
        addBuff(t.piece, 'executeMark', 0.5, 1);
        speakTaunt('Debug扫描！'+PIECE_CHAR[mc===RED?'red':'black'][t.type]+'攻击+50%，下次必中！','self');
      }
      break;
    /* 陆星辰·系统崩溃：对方全体沉默2回合+下回合不能移动 */
    case 'crash':
      state.silenceTurns=2;
      blockOppSkill(); /* v17: 统一封锁对方技能 */
      state.aoeLockdownTurns=1;
      speakTaunt('系统崩溃！全员沉默+禁锢！','self');
      break;

    /* 唐昊博涵·翻书作弊（v13: 看穿+挂 shield buff 到己方全体） */
    case 'cheat':
      {
        const plan=buildAIRoutePlan(2);
        if(plan.length>0) showRoutePlan(plan,'#8a6b3a','唐');
        addTeamBuff(state.board, myColor(), 'shield', 60, 2); /* 护盾60，2回合 */
        speakTaunt('翻书作弊！答案我都看到了，全军护盾！','self');
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
        if(cand.length===0){ speakTaunt('无目标可禁锢！','self'); return; }
        cand.sort((a,b)=>PIECE_VALUE[b.type]-PIECE_VALUE[a.type]);
        const t=cand[0];
        state.lockedPiece={r:t.r,c:t.c};
        state.lockTurns=2;
        speakTaunt('仙帝降临！尔等禁锢2回合！','self');
      }
      break;
    /* 仙帝Alice·仙帝审判：全场真实伤害60+对方被动失效3回合 */
    case 'judgment':
      {
        const oc=oppColor();
        let killed=0;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc){
            p.hp-=60; /* 真实伤害60 */
            if(p.hp<=0){
              state.board[r][c]=null;
              pushCaptured(p);
              killed++;
            }
          }
        }
        state.oppPassiveDisabled=3; /* 对方被动失效3回合 */
        speakTaunt(`仙帝审判！真实伤害60，被动封锁3回合！斩杀${killed}子！`,'self');
        renderAll();
      }
      break;

    /* 刘雪沛·洞察标记：标记B王1子，下次攻击必中+50%伤害 */
    case 'mark':
      {
        const oc=oppColor();
        const cand=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING) cand.push({r,c,type:p.type});
        }
        if(cand.length===0){ speakTaunt('无目标可标记！','self'); return; }
        cand.sort((a,b)=>PIECE_VALUE[b.type]-PIECE_VALUE[a.type]);
        const t=cand[0];
        /* v19: 改用 buff 系统使标记生效（原 state.executeMark 只写不读） */
        addBuff(state.board[t.r][t.c], 'executeMark', 0.5, 1);
        speakTaunt('洞察标记！已锁定，下次必中+50%！','self');
      }
      break;
    /* 刘雪沛·克星之刃：全场沉默B王2回合+B王防御-30% */
    case 'nemesis':
      state.silenceTurns=2;
      blockOppSkill(); /* v17: 统一封锁对方技能 */
      addTeamBuff(state.board, oppColor(), 'defReduce', 0.3, 1); /* v17: 对方全体防御-30%（buff系统） */
      speakTaunt('克星之刃！全员沉默，防御崩塌！','self');
      break;

    /* 大汉棋圣·豪迈冲撞：减速B王全体+攻击-15% */
    case 'charge':
      state.oppSlowTurns=1;
      addTeamBuff(state.board, oppColor(), 'weakness', 0.15, 1); /* v17: 对方全体攻击-15%（buff系统） */
      speakTaunt('豪迈冲撞！全军减速，攻势亦减！','self');
      break;
    /* 大汉棋圣·棋圣降临：回溯5步+B王下回合不能吃子+额外回合 */
    case 'saint':
      {
        const steps=Math.min(5, state.boardSnapshots.length);
        if(steps>0){
          for(let i=0;i<steps;i++){
            const lastIdx=state.boardSnapshots.length-1;
            state.boardSnapshots.splice(lastIdx,1);
          }
          state.board=cloneBoard(state.boardSnapshots[state.boardSnapshots.length-1]||state.board);
          for(let i=0;i<steps;i++){
            if(state.history.length>0){
              state.history.pop();
              state.moveCount=Math.max(0,state.moveCount-1);
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
        renderAll(); updateCapturedDisplay();
      }
      break;

    /* 刘佳伟·稳如泰山：己方1子护盾+防御+25% */
    case 'steadfast':
      state.shieldMode=true;
      state.shieldAmount=80;
      state.shieldDefBuff=0.25;
      speakTaunt('稳如泰山！选一颗棋子加护盾！','self');
      break;
    /* 刘佳伟·后发制人（v13: 挂 reflect buff 到己方全体，3回合）
       v19: 对方全体挂 weakness buff（每回合-10%攻击，3回合），替代失效的 state.oppAtkDecayPerTurn */
    case 'counter':
      addTeamBuff(state.board, myColor(), 'reflect', 0.4, 3);
      addTeamBuff(state.board, oppColor(), 'weakness', 0.1, 3); /* 对方全体攻击-10%，3回合 */
      speakTaunt('后发制人！反弹四成，攻势渐衰！','self');
      break;

    /* 袁清山·隐遁闪烁：己方1子瞬移到空位+下回合无法被锁定 */
    case 'blink':
      state.teleportMode=true;
      state.teleportUntrackable=true; /* 瞬移后下回合无法被锁定 */
      speakTaunt('隐遁闪烁！选一颗棋子瞬移！','self');
      break;
    /* 袁清山·龙跃九天（v13: 挂 attackBoost buff 到己方全体，2回合） */
    case 'leap':
      addTeamBuff(state.board, myColor(), 'attackBoost', 24, 2); /* +40% 约 +24 */
      state.skillActive='shield'; /* B王下回合不能吃子 */
      speakTaunt('龙跃九天！全军攻击+40%，持续2回合！','self');
      break;

    /* 罗伦杰·破甲突袭：标记B王1子，下次攻击必中且无视防御 */
    case 'pierce':
      {
        const oc=oppColor();
        const cand=[];
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===oc&&p.type!==T.KING) cand.push({r,c,type:p.type});
        }
        if(cand.length===0){ speakTaunt('无目标可破甲！','self'); return; }
        cand.sort((a,b)=>PIECE_VALUE[b.type]-PIECE_VALUE[a.type]);
        const t=cand[0];
        /* v19: 改用 buff 系统使破甲生效（原 state.pierceMark 只写不读） */
        addBuff(state.board[t.r][t.c], 'executeMark', 0.5, 1); /* 必中+50% */
        addBuff(state.board[t.r][t.c], 'defReduce', 1.0, 1);   /* 防御归零 */
        speakTaunt('破甲突袭！已标记，下次必中且无视防御！','self');
      }
      break;
    /* 罗伦杰·无尽连斩（v13: 挂 attackBoost buff 到己方全体+连击机制） */
    case 'storm':
      addTeamBuff(state.board, myColor(), 'attackBoost', 18, 2); /* +30% 约 +18 */
      state.stormActive=3; /* 最多3步额外 */
      speakTaunt('无尽连斩！全军攻击+30%，吃一子再走一步！','self');
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
        if(!weakest){ speakTaunt('无可献祭之子！','self'); return; }
        if(!strongest){ speakTaunt('敌方无子可诛！','self'); return; }
        const dmg=Math.max(1, (weakest.p.maxHp||weakest.p.hp||100));
        const sac=state.board[weakest.r][weakest.c];
        state.board[weakest.r][weakest.c]=null;
        pushCaptured(sac);
        const tgt=state.board[strongest.r][strongest.c];
        tgt.hp -= dmg;
        speakTaunt('噬蛊祭道！以'+PIECE_CHAR[mc===RED?'red':'black'][sac.type]+'献祭，敌'+PIECE_CHAR[oc===RED?'red':'black'][tgt.type]+'受'+dmg+'真实伤害！','self');
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
        if(!strongest){ speakTaunt('无可标记之猎物！','self'); return; }
        addBuff(strongest.p, 'defReduce', 1.0, 3); /* 防御归零（无视防御） */
        addBuff(strongest.p, 'preyMark', 1, 3); /* 猎物标记：被吃时触发回血 */
        speakTaunt('算计连环！'+PIECE_CHAR[oc===RED?'red':'black'][strongest.p.type]+'已成猎物，三回合内必诛！','self');
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
        if(!target){ speakTaunt('无可感化之敌！','self'); return; }
        const t=state.board[target.r][target.c];
        t.player=mc; /* 阵营反转，万物皆为我用 */
        t.buffs=[]; /* 清除原阵营所有 buff */
        speakTaunt('大爱无疆...你的'+PIECE_CHAR[oc===RED?'red':'black'][t.type]+'，归我了。','self');
        updateCapturedDisplay(); renderAll();
      }
      break;

    /* B王·装逼领域：3回合对方攻击-30%+防御-30% */
    case 'domain':
      addTeamBuff(state.board, oppColor(), 'weakness', 0.3, 3); /* v17: 对方全体攻击-30%，3回合 */
      addTeamBuff(state.board, oppColor(), 'defReduce', 0.3, 3); /* v17: 对方全体防御-30%，3回合 */
      state.domainTurns=3;
      speakTaunt('装逼领域！气场压制全场！','self');
      break;
    /* B王·以退为进·本王版：撤销己方1步+额外走2步 */
    case 'selfreverse':
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
          state.extraMove=2; /* 额外走2步 */
          speakTaunt('以退为进？本王退着走都能赢你！','self');
          renderAll(); updateCapturedDisplay();
        }
      }
      break;

    default:
      /* 未知技能 ID：提示并安全退出 */
      speakTaunt('技能未实现：'+(activeSkill?activeSkill.name:sid),'self');
      break;
  }

  // 技能冷却：重置计数并锁定生效回合（生效回合不解冷却）
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
  updateSkillDisplay(); updateCapturedDisplay(); renderAll();

  // 偷天换日：撤销B王后B王重走
  if(sid==='rewind'&&state.currentPlayer===state.aiColor&&!state.gameOver){
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
  // 概率：优先用 data.js 中的 skillChance，回退到旧逻辑
  /* v16: 应用仙帝威压/三英B王光环对释放概率的修正 */
  let chance=diff.skillChance!==undefined?diff.skillChance:(state.difficulty==='easy'?0.4:state.difficulty==='medium'?0.5:0.6);
  chance -= (state.bkingSkillChanceReduce||0);
  chance = Math.max(0.05, Math.min(0.95, chance));
  if(Math.random()>=chance){ return false; }
  speakTaunt(pick(diff.skillLines));
  // 轮换技能：若 data.js 定义了 skills 数组则轮换，否则用单一 skill
  const pool=(diff.skills&&diff.skills.length>0)?diff.skills.map(s=>s.id):[diff.skill.id];
  const skillId=pool[Math.floor(Math.random()*pool.length)];
  switch(skillId){
    case 'mock':
      // 嘲讽：仅说话
      break;
    case 'reverse':
      // 赖皮：撤销玩家最近一步，并获得额外一回合
      if(state.history.length>=1){
        let lastP=null;
        for(let i=state.history.length-1;i>=0;i--){ if(state.history[i].player===state.playerColor){ lastP=state.history[i]; break; } }
        if(lastP){
          state.board[lastP.from.r][lastP.from.c]=lastP.piece;
          state.board[lastP.to.r][lastP.to.c]=lastP.captured;
          if(lastP.captured){ if(lastP.captured.player===BLACK) state.blackCaptured.pop(); else state.redCaptured.pop(); }
          const idx=state.history.indexOf(lastP);
          state.history.splice(idx,1);
          state.moveCount--;
          removeLastHistoryEntry();
          state.lastMove=state.history.length>0?{from:state.history[state.history.length-1].from,to:state.history[state.history.length-1].to}:null;
          state.aiExtraMoves=1; // AI额外一回合
          updateSkillDisplay(); updateCapturedDisplay(); renderAll();
        }
      }
      break;
    case 'confuse':
      // 指鹿为马：忽悠玩家下回合走一步随机棋（不耗费AI回合）
      {
        const mc=state.playerColor;
        const allMoves=getLegalAIMoves(state.board,mc);
        if(allMoves.length>0){
          const m=allMoves[Math.floor(Math.random()*allMoves.length)];
          state.playerConfusedMove={from:{r:m.fr,c:m.fc},to:{r:m.tr,c:m.tc}};
          speakTaunt('指鹿为马！下回合你只能走本王指定的这步！');
        }
      }
      break;
    case 'foresight':
      // 洞察：额外移动一颗棋子，并下回合玩家无法吃子
      state.aiExtraMoves=1;
      state.playerCannotCapture=true;
      break;
    case 'seize':
      // 先手夺人：直接吃掉玩家价值最高的非将棋子（不耗回合）
      {
        const mc=state.playerColor;
        const ai=state.aiColor;
        let best=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(p&&p.player===mc&&p.type!==T.KING){
            const v=PIECE_VALUE[p.type];
            if(!best||v>best.v) best={r,c,v,p};
          }
        }
        if(best){
          // 找一颗能吃掉它的AI棋子（按价值从小到大，用最弱的子吃最强的子）
          const atks=[];
          for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
            const a=state.board[r][c];
            if(a&&a.player===ai){
              const ms=getPieceMoves(state.board,r,c).filter(m=>m.row===best.r&&m.col===best.c);
              if(ms.length>0) atks.push({fr:r,fc:c,v:PIECE_VALUE[a.type]});
            }
          }
          if(atks.length>0){
            atks.sort((a,b)=>a.v-b.v);
            const atk=atks[0];
            const cap=state.board[best.r][best.c];
            state.board[best.r][best.c]=state.board[atk.fr][atk.fc];
            state.board[atk.fr][atk.fc]=null;
            if(cap.player===RED) state.redCaptured.push(cap); else state.blackCaptured.push(cap);
            state.lastMove={from:{r:atk.fr,c:atk.fc},to:{r:best.r,c:best.c}};
            speakTaunt('先手夺人！本王直接收下你的'+PIECE_CHAR[cap.player===RED?'red':'black'][cap.type]+'！');
            updateCapturedDisplay(); renderAll();
          }
        }
      }
      break;
    case 'swap':
      // 偷梁换柱：互换B王最弱的子和玩家最强的子的位置（非将）
      {
        const mc=state.playerColor, ai=state.aiColor;
        let pBest=null,aWorst=null;
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
          const p=state.board[r][c];
          if(!p) continue;
          if(p.player===mc&&p.type!==T.KING){
            if(!pBest||PIECE_VALUE[p.type]>PIECE_VALUE[pBest.p.type]) pBest={r,c,p};
          }
          if(p.player===ai&&p.type!==T.KING){
            if(!aWorst||PIECE_VALUE[p.type]<PIECE_VALUE[aWorst.p.type]) aWorst={r,c,p};
          }
        }
        if(pBest&&aWorst){
          /* v19: 保存快照+历史+校验飞将，原缺失导致回溯/悔棋错乱 */
          const tmpB=cloneBoard(state.board);
          const t=tmpB[pBest.r][pBest.c];
          tmpB[pBest.r][pBest.c]=tmpB[aWorst.r][aWorst.c];
          tmpB[aWorst.r][aWorst.c]=t;
          /* AI 偷梁换柱互换两枚非王棋子，不会产生飞将（王未动且中间子结构变化有限），仍校验己方王安全 */
          if(kingsFacing(tmpB)||isInCheck(tmpB,ai)){ speakTaunt('偷梁换柱？时机未到！'); break; }
          state.boardSnapshots.push(cloneBoard(state.board));
          if(state.boardSnapshots.length>6) state.boardSnapshots.shift();
          const tmp=state.board[pBest.r][pBest.c];
          state.board[pBest.r][pBest.c]=state.board[aWorst.r][aWorst.c];
          state.board[aWorst.r][aWorst.c]=tmp;
          state.lastMove={from:{r:aWorst.r,c:aWorst.c},to:{r:pBest.r,c:pBest.c}};
          state.moveCount++;
          addHistoryEntry(state.board[pBest.r][pBest.c],{r:aWorst.r,c:aWorst.c},{r:pBest.r,c:pBest.c},null);
          speakTaunt('偷梁换柱！你的'+PIECE_CHAR[pBest.p.player===RED?'red':'black'][pBest.p.type]+'已被本王换走！');
          renderAll();
        }
      }
      break;
  }
  state.roundsSinceAISkill=0; state.aiSkillLock=true;
  updateSkillDisplay();
  return false;
}

/* ===== UI ===== */
function updateTurnIndicator(){
  const ti=document.getElementById('turn-indicator');
  const t=ti.querySelector('.turn-text');
  if(state.gameMode==='pvp'||state.gameMode==='online'){
    const char=getCurrentChar();
    if(state.currentPlayer===RED){ ti.classList.remove('black'); t.textContent=`红方·${char.name}行棋`; }
    else{ ti.classList.add('black'); t.textContent=`黑方·${char.name}行棋`; }
  } else if(state.gameMode==='faction'||state.gameMode==='4v4'){
    /* v5.0 多阵营：显示"颜色·角色名 行棋" */
    const char=getCurrentChar();
    const colorLabel=colorDisplayName(state.currentPlayer);
    ti.classList.toggle('black', state.currentPlayer===BLACK||state.currentPlayer===GREEN);
    t.textContent=`${colorLabel}·${char?char.name:'?'}行棋`;
  } else {
    if(state.currentPlayer===state.playerColor){ ti.classList.remove('black'); t.textContent='轮到你了'; }
    else{ ti.classList.add('black'); t.textContent='B王行棋'; }
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
  if(state.gameMode==='three'){
    /* v19: 读取选中技能实际 CD，不再硬编码 3 */
    const baseCd=(sk&&sk.cd)||3;
    const threshold=Math.max(1, baseCd + (state.bkingCdIncrease||0) - (state.skillCdReduce||0));
    cdLeft=Math.max(0,threshold-(state.threeHeroCDs[state.threeHeroIndex]||0));
  } else {
    /* v16: CD 与 canUseSkill 同步，按选中技能 cd 计算 */
    const baseCd=(sk&&sk.cd)||3;
    const threshold=Math.max(1, baseCd + (state.bkingCdIncrease||0) - (state.skillCdReduce||0));
    const counter = (state.gameMode==='pvp'||state.gameMode==='online')
      ? (state.currentPlayer===RED?state.roundsSincePlayerSkill:state.roundsSinceP2Skill)
      : state.roundsSincePlayerSkill;
    cdLeft=Math.max(0, threshold-counter);
  }
  if(cdLeft===0){ btn.disabled=false; cdText.textContent='就绪'; }
  else{ btn.disabled=true; cdText.textContent=`冷却 ${cdLeft}`; }
  /* v17: PVP 被封锁（沉默）时禁用技能按钮并提示 */
  if((state.gameMode==='pvp'||state.gameMode==='online')
     &&state.oppSkillBlockedColor===state.currentPlayer&&state.silenceTurns>0){
    btn.disabled=true;
    cdText.textContent=`沉默 ${state.silenceTurns}回`;
  }
  if(state.swapMode||state.skillActive==='ironwall'||state.teleportMode||state.disguiseMode){ btn.disabled=false; btn.classList.add('active'); cdText.textContent='选棋子'; }
  else btn.classList.remove('active');
  // 三英战B王：渲染武将面板
  renderThreeHeroesPanel();

  if(state.gameMode==='pvp'){
    /* v11: 显示对方选中的主动技能（非默认 skill） */
    const oppActiveSkill = state.currentPlayer===RED ? state.pvpBlackActiveSkill : state.pvpRedActiveSkill;
    const p2Char=state.currentPlayer===RED?CHARACTERS[state.pvpBlackChar]:CHARACTERS[state.pvpRedChar];
    const oppSkill = oppActiveSkill || p2Char.skill;
    document.getElementById('ai-skill-name').textContent=oppSkill.name;
    const dotsEl=document.getElementById('ai-skill-dots');
    /* v16: 圆点数 = 对方技能 cd，与玩家侧 CD 逻辑一致 */
    const oppCd=(oppSkill&&oppSkill.cd)||3;
    const oppCounter = state.currentPlayer===RED ? state.roundsSinceP2Skill : state.roundsSincePlayerSkill;
    const p2CDLeft=Math.max(0, oppCd-oppCounter);
    let html='';
    for(let i=0;i<oppCd;i++) html+=`<div class="scd-dot ${i<(oppCd-p2CDLeft)?'filled':''}"></div>`;
    dotsEl.innerHTML=html;
  } else {
    const diff=DIFFICULTIES[state.difficulty];
    document.getElementById('ai-skill-name').textContent=diff.skill.name;
    const dotsEl=document.getElementById('ai-skill-dots');
    const aiCDLeft=Math.max(0,3-state.roundsSinceAISkill);
    let html='';
    for(let i=0;i<3;i++) html+=`<div class="scd-dot ${i<(3-aiCDLeft)?'filled':''}"></div>`;
    dotsEl.innerHTML=html;
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
  // 记录本局结果，供手动保存按钮使用
  state.lastResult = playerWins ? 'win' : 'lose';
  state.lastResultReason = reason;
  // 保存复盘
  saveReplay(playerWins, reason);
  /* v4.0 故事模式进度推进 */
  if(state.storyChapterId&&playerWins){
    const nextCh=state.storyChapterId+1;
    if(nextCh>storyProgress){
      if(nextCh<=STORY_CHAPTERS.length){
        storyProgress=nextCh;
      } else {
        /* 通关终章：标记故事模式完成（progress > 章节数） */
        storyProgress=STORY_CHAPTERS.length+1;
      }
      localStorage.setItem('bky_story_progress',String(storyProgress));
    }
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
/* v4.0 故事模式角色解锁系统 */
function getUnlockedChars(){
  // Default: chapter 1 unlocks (initial 3)
  let unlocked = new Set(['houzhibo','zhouzihan','luxingchen']);
  // Read story progress
  const progress = parseInt(localStorage.getItem('bky_story_progress')||'1');
  // Unlock characters from completed chapters (up to progress-1, since progress is next chapter to play)
  for(let i=1; i<progress && i<=STORY_CHAPTERS.length; i++){
    const ch = STORY_CHAPTERS.find(c=>c.id===i);
    if(ch && ch.unlockChars){
      ch.unlockChars.forEach(id=>unlocked.add(id));
    }
  }
  // If all chapters completed (progress > 7), unlock hidden characters
  if(progress > STORY_CHAPTERS.length){
    unlocked.add('bking');
    unlocked.add('alice');
    unlocked.add('daaixianzun');
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
  document.getElementById('detail-skill-name').textContent=ch.skill.name;
  document.getElementById('detail-skill-desc').textContent=ch.skill.desc;
  document.getElementById('detail-skill-cd').textContent='冷却 '+ch.skill.cd+' 回合';
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
function startNewGame(){
  /* v4.0 重置被动状态 */
  if(typeof resetPassives==='function') resetPassives();
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
  /* v17: PVP 通用技能封锁标记重置 */
  state.oppSkillBlockedColor=null;
  /* v16: 重置一次性技能标记（之前未在 startNewGame 中重置，跨局残留） */
  state.oppMissNext=false;
  state.aoeLockdownTurns=0;
  state.oppSlowTurns=0;
  state.oppPassiveDisabled=0;
  state.barrageActive=false;
  state.bkingCdIncrease=0;
  state.bkingSkillChanceReduce=0;
  state.skillCdReduce=0;
  state.immuneFirstTurn=false;
  state.reflectFirstTurn=0;
  state.dodgeNext=false;
  state.attackBoost=0;
  state.bkingAtkDebuff=0;
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
/* B王技能 ID → 中文名映射（避免图鉴中出现英文 ID） */
const CODEX_SKILL_LABEL = {
  mock:'装逼', reverse:'赖皮', confuse:'指鹿为马', foresight:'装逼洞察',
  seize:'先手夺人', swap:'偷梁换柱', domain:'领域压制', selfreverse:'自我撤销'
};
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
      <li><b>核心（帅/将）</b>：HP 300 / ATK 25 / DEF 30 — 被吃即败</li>
      <li><b>进攻（车/马）</b>：车 HP180/ATK60 / 马 HP150/ATK50 — 攻击无视防守30%防御（破甲）</li>
      <li><b>远程（炮）</b>：HP 120 / ATK 55 / DEF 12 — 打非远程不掉血</li>
      <li><b>防守（仕/相）</b>：HP 100 / ATK 15 / DEF 35 — 被非炮攻击时，攻击方获「虚弱」buff（下回合攻击-30%）</li>
      <li><b>特殊（兵/卒）</b>：HP 200 / ATK 45 / DEF 10 — 受非帅攻击只受50%伤害；打帅+50%伤害</li>
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
      <li><b>故事模式</b>：7章剧情，逐章解锁角色。初始仅3角色可选</li>
    </ul></section>
    <section class="guide-section"><h3>选将流程</h3><ol class="guide-list">
      <li>选择模式 → 进入选将屏</li>
      <li>PVP模式：双方先Ban位禁用角色，再依次选将</li>
      <li>点击角色卡片查看详情：背景/奇术/属性/台词/被动</li>
      <li>从<b>3个主动技能中选1个</b> + 从<b>2个被动技能中选1个</b></li>
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
    <section class="guide-section"><h3>技能系统</h3><p>每个角色有<b>3个主动技能（选1）</b>和<b>2个被动技能（选1）</b>。主动技能需冷却（CD 3-6回合），被动技能自动触发（光环/被吃/吃子/周期/首回合/免疫）。</p>
    <p><b>玩家技能</b>：主动技能由玩家手动释放，PVE中作用于AI，PVP中作用于对手。</p>
    <p><b>B王（AI）技能</b>：按难度自动释放，玩家无法选择。详见"B王技能详解"。</p></section>
    <section class="guide-section"><h3>故事模式解锁</h3><p>初始仅3角色可选，每通关一章解锁新角色。全部通关后解锁隐藏角色：B王、仙帝Alice、大爱仙尊（古月方源）。</p></section>
    </div>`;
  } else if(guide==='bking'){
    html+=`<div class="guide-page"><h2 class="guide-title">B王技能详解</h2>
    <p class="guide-note">B王是AI专属角色，<b>玩家无法选择</b>。其技能按难度分级，由AI自动释放。</p>`;
    Object.keys(DIFFICULTIES).forEach(k=>{
      const d=DIFFICULTIES[k];
      const pool=d.skills.map(s=>`<b>${CODEX_SKILL_LABEL[s.id]||s.id}</b>：${s.desc||s.name}`).join('<br>');
      html+=`<section class="guide-section"><h3>${d.name} · ${d.title}</h3>
      <p>思考深度 ${d.depth} · 技能释放概率 ${Math.round(d.skillChance*100)}%</p>
      <p class="guide-skill-pool">${pool}</p></section>`;
    });
    html+=`<section class="guide-section"><h3>B王额外被动（仅王者装）</h3>
    <p><b>${BKING_EXTRA_PASSIVE.name}</b>（${CODEX_TRIGGER_LABEL[BKING_EXTRA_PASSIVE.trigger]||BKING_EXTRA_PASSIVE.trigger}）：${BKING_EXTRA_PASSIVE.desc}</p></section>`;
    const thb=THREE_HEROES_BKING;
    html+=`<section class="guide-section"><h3>三英战B王 · 极限强化</h3>
    <p>思考深度 ${thb.depth}（+2） · 技能释放概率 ${Math.round(thb.skillChance*100)}% · 每${thb.comboTurns}回合连环双杀 · 被吃${Math.round(thb.revengeChance*100)}%反吃</p>`;
    thb.extraPassives.forEach(p=>{
      html+=`<p class="guide-skill-pool"><b>${p.name}</b>（${CODEX_TRIGGER_LABEL[p.trigger]||p.trigger}）：${p.desc}</p>`;
    });
    html+='</section>';
    html+=`<section class="guide-section"><h3>B王阵营说明</h3><p>B王阵营已移除鸡哥，主动技能增加至5个。B王技能在被刘雪沛·破妄之眼沉默时<b>禁用</b>。</p></section>`;
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
      <li><b>青铜装</b>：B王仅会装逼（无实战技能），正常对弈即可</li>
      <li><b>钻石装</b>：B王会「赖皮」撤销你一步 + 「指鹿为马」强制你走指定步。建议选刘雪沛沉默</li>
      <li><b>王者装</b>：B王会「先手夺人」白吃你强子 + 「偷梁换柱」互换强弱子。务必选沉默或回溯角色</li>
    </ul></section>
    <section class="guide-section"><h3>三英模式要点</h3><ul class="guide-list">
      <li>B王极大幅度强化（思考深度+2，每3回合连环双杀，被吃30%反吃）</li>
      <li>三将<b>自动轮换</b>，轮换时buff随之改变</li>
      <li>建议选<b>沉默+回溯+感化</b>组合：刘雪沛+仙帝Alice+古月方源</li>
      <li>注意：三英模式禁选B王（避免逻辑悖论）</li>
    </ul></section>
    </div>`;
  }
  body.innerHTML=html;
  const backBtn=document.getElementById('codex-back');
  if(backBtn) backBtn.addEventListener('click',renderCodexGrid);
}
function renderCodexDetail(cid){
  const ch=CHARACTERS[cid];
  if(!ch) return;
  const body=document.getElementById('boss-info-body');
  const trig=(t)=>CODEX_TRIGGER_LABEL[t]||t;
  /* AI专属/玩家可选 标识 */
  const isBking = cid==='bking';
  const roleTag = isBking
    ? '<span class="codex-ai-tag">AI 专属 · 玩家不可选</span>'
    : '<span class="codex-player-tag">玩家可选</span>';
  let html='<button class="btn-ghost codex-back-btn" id="codex-back">‹ 返回列表</button>';
  html+=`<div class="codex-detail-head" style="--char-color:${ch.color}">
    <div class="codex-detail-portrait"><div class="codex-portrait-svg">${getPortrait(cid,ch.color,ch.glow)}</div></div>
    <div class="codex-detail-info">
      <h3 class="codex-detail-name">${ch.name}${roleTag}</h3>
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
  html+=`<div class="boss-section"><h3>奇术 · 共 ${skillList.length} 个（3选1）</h3>`;
  skillList.forEach((s,i)=>{
    const tag = s.target==='aoe' ? '<span class="sk-tag">全范围</span>' : '<span class="sk-tag">单体</span>';
    html+=`<div class="boss-skill-card"><span class="sk-name">${s.name}</span>${tag}<span class="sk-diff">冷却 ${s.cd} 回合</span>
    <div class="sk-desc">${s.desc}</div></div>`;
  });
  html+='</div>';
  /* 被动 */
  html+='<div class="boss-section"><h3>被动技能（二选一）</h3>';
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
  /* 台词 */
  if(ch.skillLines&&ch.skillLines.length){
    html+='<div class="boss-section"><h3>台词</h3><div class="codex-lines">';
    ch.skillLines.slice(0,4).forEach(line=>{ html+=`<div class="codex-line">"${line}"</div>`; });
    html+='</div></div>';
  }
  /* B王专属：三难度技能池 + 三英强化 + 克制策略 */
  if(cid==='bking'){
    html+='<div class="boss-section"><h3>B王三难度技能池</h3>';
    Object.keys(DIFFICULTIES).forEach(k=>{
      const d=DIFFICULTIES[k];
      const pool=d.skills.map(s=>CODEX_SKILL_LABEL[s.id]||s.id).join('、');
      html+=`<div class="boss-skill-card"><span class="sk-name">${d.name}</span><span class="sk-diff">${d.title}</span><div class="sk-desc">思考深度 ${d.depth} · 技能池：${pool} · 释放概率 ${Math.round(d.skillChance*100)}%</div></div>`;
    });
    html+='</div>';
    html+=`<div class="boss-section"><h3>B王额外被动（仅王者装）</h3>
      <div class="boss-passive-card"><b>${BKING_EXTRA_PASSIVE.name}</b> · ${trig(BKING_EXTRA_PASSIVE.trigger)}：${BKING_EXTRA_PASSIVE.desc}</div></div>`;
    const thb=THREE_HEROES_BKING;
    html+='<div class="boss-section"><h3>三英战B王 · 极限强化</h3>';
    html+=`<div class="boss-skill-card"><span class="sk-name">思考深度 ${thb.depth}</span><span class="sk-diff">+2</span><div class="sk-desc">技能释放概率 ${Math.round(thb.skillChance*100)}% · 每${thb.comboTurns}回合连环双杀 · 被吃${Math.round(thb.revengeChance*100)}%反吃</div></div>`;
    thb.extraPassives.forEach(p=>{
      html+=`<div class="boss-passive-card"><b>${p.name}</b> · ${trig(p.trigger)}：${p.desc}</div>`;
    });
    html+='</div>';
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
    if(ch.unlockChars && ch.unlockChars.length>0){
      html+=`<p class="story-unlock">解锁：${ch.unlockChars.map(c=>CHARACTERS[c]?CHARACTERS[c].name:c).join('、')}</p>`;
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
  /* 展示剧情 */
  const body=document.getElementById('story-body');
  let html=`<div class="boss-section"><h3>${ch.title}</h3><p style="font-size:13px;color:var(--ink-soft)">${ch.desc}</p></div>`;
  html+='<div class="boss-section"><h3>剧情</h3>';
  ch.intro.forEach(line=>{ html+=`<div class="story-intro-line">${line}</div>`; });
  html+='</div>';
  document.getElementById('story-nav').innerHTML=`<button class="btn-ghost" id="story-back-list">返回章节</button><button class="btn-primary" id="story-start">开始战斗</button>`;
  body.innerHTML=html;
  document.getElementById('story-back-list').addEventListener('click',showStoryMenu);
  document.getElementById('story-start').addEventListener('click',()=>{
    document.getElementById('story-overlay').classList.remove('show');
    /* 进入战斗 */
    state.gameMode = ch.threeHeroes?'three':'pve';
    state.difficulty = ch.difficulty;
    state.storyChapterId = chId;
    if(ch.threeHeroes){
      threePicks=[];
      document.getElementById('char-select-title').textContent=ch.title+' · 三英择将';
      document.getElementById('char-select-desc').textContent='选择3位武将讨伐B王极限形态';
      renderCharacterCards();
      showScreen('screen-character');
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
  const selected=skillState.selected[charId]?.passive||0;
  opts.innerHTML=ch.passives.map((p,i)=>`
    <div class="passive-card${i===selected?' selected':''}" data-pv="${i}">
      <div><span class="pv-name">${p.name}</span><span class="pv-trigger">${p.trigger}</span></div>
      <div class="pv-desc">${p.desc}</div>
    </div>`).join('');
  opts.querySelectorAll('[data-pv]').forEach(el=>{
    el.addEventListener('click',()=>{
      const idx=parseInt(el.dataset.pv);
      if(!skillState.selected[charId]) skillState.selected[charId]={active:0,passive:0};
      skillState.selected[charId].passive=idx;
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

  /* 渲染主动技能（3选1） */
  const activesEl=document.getElementById('skill-select-actives');
  const actives=(ch.actives&&ch.actives.length)?ch.actives:[ch.skill];
  const selActive=skillState.selected[charId]?.active||0;
  activesEl.innerHTML=actives.map((a,i)=>`
    <div class="skill-select-item${i===selActive?' selected':''}" data-type="active" data-idx="${i}">
      <div class="skill-item-name">${a.name}</div>
      <div class="skill-item-desc">${a.desc}</div>
      <div class="skill-item-cd">CD: ${a.cd}回合</div>
    </div>`).join('');

  /* 渲染被动技能（2选1） */
  const passivesEl=document.getElementById('skill-select-passives');
  const passives=(ch.passives&&ch.passives.length)?ch.passives:[];
  if(passives.length===0){
    passivesEl.innerHTML='<div class="skill-select-empty">该角色暂无被动技能</div>';
  } else {
    const selPassive=skillState.selected[charId]?.passive||0;
    passivesEl.innerHTML=passives.map((p,i)=>`
      <div class="skill-select-item${i===selPassive?' selected':''}" data-type="passive" data-idx="${i}">
        <div class="skill-item-name">${p.name}<span class="skill-item-trigger">${p.trigger||''}</span></div>
        <div class="skill-item-desc">${p.desc}</div>
      </div>`).join('');
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
      skillState.selected[charId].passive=idx;
      passivesEl.querySelectorAll('.skill-select-item').forEach((m,i)=>{
        m.classList.toggle('selected', i===idx);
      });
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
document.querySelectorAll('.difficulty-card').forEach(card=>{
  card.addEventListener('click',()=>{
    document.querySelectorAll('.difficulty-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    selectedDifficulty=card.dataset.difficulty;
  });
});

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
document.getElementById('btn-undo').addEventListener('click',undoLastMove);
document.getElementById('btn-restart').addEventListener('click',startNewGame);
document.getElementById('btn-th-switch').addEventListener('click',()=>{
  // 循环切换到下一个武将
  const next=(state.threeHeroIndex+1)%state.threeHeroes.length;
  switchThreeHero(next);
});
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
  const saveData={
    version:'1.0',
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
    lastMove:state.lastMove
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
    state.playerCannotCapture=false;
    state.aiExtraMoves=0;
    state.dodgeTarget=null;
    state.disguiseMode=false;
    state.aweActive=false;
    state.awePieces=[];
    state.ironwallTarget=null; state.ironwallTurns=0;
    state.teleportMode=false;
    state.lockedPiece=null; state.lockTurns=0;
    state.catchActive=false;
    state.controlActive=false; state.controlledMove=null;
    state.silenceTurns=0;
    state.playerConfusedMove=null;
    state.playerSkillLock=false; state.p2SkillLock=false; state.aiSkillLock=false;
    state.skillOwnerColor=null;
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

/* ===== 新手教程系统 ===== */
const TUTORIAL_STEPS = [
  { title:'欢迎', content:'欢迎来到博弈之王！这是一款融合角色技能与兵种相克的中国象棋。本教程共8步，带你快速上手。' },
  { title:'模式与解锁', content:'游戏模式：故事模式（初始仅3角色，通关解锁更多，全通关解锁B王/仙帝/大爱仙尊）；PVP（始终开放，含Ban位）；阵营模式（多色互相攻伐）；三英战B王。PVE需完成故事模式后解锁。点击模式卡片直接进入。' },
  { title:'选棋与操作菜单', content:'点击己方棋子弹出操作菜单：选择"进攻"进入移动模式，选择"详情"查看棋子属性（HP/攻防/兵种/Buff）。选将屏点击角色卡片会弹出技能选择面板。' },
  { title:'移动与吃子', content:'选中棋子后，绿色圆点表示可移动位置，红色圆圈表示可吃子位置。点击目标位置即可移动。吃子时双方互相结算伤害，只有HP归零棋子才被移除。' },
  { title:'兵种相克', content:'7种兵种相克：炮(远程)打非远程不掉血；车/马(进攻)无视30%防御；兵(特殊)受非帅攻击只受50%伤害；非炮打相/士(防守)攻击方获虚弱buff；兵打帅+50%伤害。合理利用相克是制胜关键。' },
  { title:'HP与战斗体系', content:'每个棋子有HP/攻击/防御：帅(300/25/30)、车(180/60/20)、马(150/50/18)、炮(120/55/12)、相/士(100/15/35)、兵(200/45/10)。血条颜色随HP变化（绿→黄→红）。虚弱buff显示"虛"字。' },
  { title:'角色属性与技能选择', content:'选将时点击角色卡片弹出技能面板：3个主动技能选1（金色高亮）+ 2个被动技能选1（朱红高亮）。角色属性（攻/防/智）影响棋子战斗加成。技能CD一般为3-5回合，B王有5个主动技能。' },
  { title:'Buff与棋子合并', content:'技能产生的Buff双方HUD都会显示（虚弱/护盾/沉默/禁锢等）。部分技能会产生棋子合并（如分身/复活），合并时HP叠加，攻防取较高值，Buff合并去重。祝你在博弈之王的棋盘上所向披靡！' }
];
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
