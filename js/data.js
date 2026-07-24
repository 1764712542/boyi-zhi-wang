/* ============================================
   data.js — 博弈之王 · 数据层 v4.0 (Dota2 化大修)
   常量 / 18角色 / 3难度 / 被动技能 / 阵容 / 故事章节
   每角色: 1主动 + 2被动(二选一)
   ============================================ */
'use strict';

/* ===== 基础常量 ===== */
const COLS = 9, ROWS = 10;
const RED = 'red', BLACK = 'black';
const BLUE = 'blue', GREEN = 'green';
const PLAYER_COLORS = [RED, BLACK, BLUE, GREEN];
const T = { KING:'k', ADVISOR:'a', ELEPHANT:'e', HORSE:'h', ROOK:'r', CANNON:'c', PAWN:'p' };
const PIECE_CHAR = {
  red:   { k:'帥', a:'仕', e:'相', h:'馬', r:'車', c:'炮', p:'兵' },
  black: { k:'將', a:'士', e:'象', h:'馬', r:'車', c:'砲', p:'卒' },
  blue:  { k:'帥', a:'仕', e:'相', h:'馬', r:'車', c:'炮', p:'兵' },
  green: { k:'將', a:'士', e:'象', h:'馬', r:'車', c:'砲', p:'卒' }
};
/* 多阵营棋子配色（渲染时按颜色取色） */
const COLOR_PIECE_COLOR = {
  red:   '#b8302a',
  black: '#2a2520',
  blue:  '#3a6b8a',
  green: '#4a7c4a'
};
const PIECE_VALUE = { k:10000, r:900, h:400, c:450, a:200, e:200, p:100 };
/* 兵种类型分类 */
const PIECE_TYPE = {
  k: 'core',      // 帅/将 - 核心单位
  r: 'striker',   // 车 - 进攻单位
  h: 'striker',   // 马 - 进攻单位
  c: 'remote',    // 炮 - 远程单位
  a: 'defender',  // 仕/士 - 防守单位
  e: 'defender',  // 相/象 - 防守单位
  p: 'special'    // 兵/卒 - 特殊单位（血高攻高）
};

/* 兵种中文名 */
const PIECE_TYPE_NAME = {
  core: '核心',
  striker: '进攻',
  remote: '远程',
  defender: '防守',
  special: '特殊'
};

/* 棋子战斗属性（策略游戏化：HP / 攻击 / 防御 / 兵种类型）
   v12: HP 再次降低约 40%，加速游戏节奏（避免一局过长）
   atk/def 保持不变；角色属性加成（charAtk/charDef/charInt）由 engine.js 注入 */
const PIECE_STATS = {
  k: { hp: 180,  atk: 25,  def: 30, type: 'core' },      // 帅/将
  r: { hp: 110,  atk: 60,  def: 20, type: 'striker' },   // 车
  h: { hp: 90,   atk: 50,  def: 18, type: 'striker' },   // 马
  c: { hp: 75,   atk: 55,  def: 12, type: 'remote' },    // 炮
  a: { hp: 60,   atk: 15,  def: 35, type: 'defender' },  // 仕/士
  e: { hp: 60,   atk: 15,  def: 35, type: 'defender' },  // 相/象
  p: { hp: 120,  atk: 45,  def: 10, type: 'special' }    // 兵/卒（血高攻高）
};
const PALACE = {
  red:   { r0:7, r1:9, c0:3, c1:5 },
  black: { r0:0, r1:2, c0:3, c1:5 },
  /* 多阵营模式：blue/green 在棋盘左右两侧中部，避免与 red/black 九宫重叠 */
  blue:  { r0:4, r1:6, c0:0, c1:2 },
  green: { r0:3, r1:5, c0:6, c1:8 }
};
const CANVAS_W = 560, CANVAS_H = 660;
const CELL = 60, PAD = 40, PIECE_RADIUS = 25;

/* 被动触发时机常量 */
const PASSIVE_TRIGGER = {
  TURN_START: 'turn_start',     // 回合开始
  ON_CAPTURE: 'on_capture',     // 己方吃子时
  ON_CAPTURED: 'on_captured',   // 己方被吃时
  ON_SKILL: 'on_skill',         // 释放技能时
  AURA: 'aura',                 // 光环（持续）
  PERIODIC: 'periodic',         // 周期性
  IMMUNE: 'immune'              // 免疫型
};

/* ===== 18 角色 · 1主动 + 2被动(二选一) ===== */
const CHARACTERS = {
  houzhibo: {
    name:'侯智博', char:'侯', title:'智计百出', color:'#b8302a', glow:'rgba(184,48,42,0.5)',
    desc:'善以奇兵破阵，攻势如潮，谋略无双',
    stats:{ atk:92, def:55, int:90 },
    faction:'strategist',
    skill:{ id:'rewind', name:'偷天换日', desc:'撤销B王最近一步棋，迫其重走，并获得一额外回合 [单体]', cd:3, target:'single' },
    skillLines:['偷天换日！这步不算！','且慢，让本座重来','棋局未定，何谈胜负','乾坤颠倒，日月重光'],
    loseLines:['智者千虑必有一失...','此局算计不如B王','罢了，下次再战','谋事在人，成事在天'],
    speech:['智计百出？在B王面前不过是小聪明','这点手段也敢班门弄斧？','让本王看看你还有什么花招','你的计谋本王早已看穿'],
    actives:[
      { id:'rewind', name:'偷天换日', desc:'撤销B王最近一步棋，迫其重走，并获得一额外回合 [单体]', cd:3, target:'single' },
      { id:'flank', name:'暗度陈仓', desc:'沉默B王2回合无法使用技能，且B王下回合攻击-20% [单体]', cd:3, target:'single' },
      { id:'ambush', name:'奇兵破阵', desc:'全场禁锢B王棋子1回合，己方连走两步 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_strategy', name:'谋定后动', trigger:PASSIVE_TRIGGER.AURA, desc:'首步预判+10%准确度，每局开始看穿B王下1步' },
      { id:'p_chain', name:'连环计', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'吃子后下回合可连走两步' }
    ]
  },
  wangxin: {
    name:'王昕', char:'王', title:'幽默风趣', color:'#2d5a3d', glow:'rgba(45,90,61,0.5)',
    desc:'任课老师，妙语连珠，笑声中暗藏杀机',
    stats:{ atk:72, def:88, int:90 },
    faction:'strategist',
    skill:{ id:'rollcall', name:'课堂点名', desc:'点名B王回答问题：展示B王下一步走法，且B王下回合无法吃子 [单体]', cd:3, target:'single' },
    skillLines:['来，B王同学，你来回答一下这步棋怎么走','谁在下棋时走神了？B王你来说说','这个棋局啊，就好比一道送分题','B王同学，你的棋艺还需要加强啊'],
    loseLines:['哈哈哈，输了输了，下课！','这局就当给大家当反面教材了','B王同学棋艺不错，下次老师请教你'],
    speech:['王老师？在本王面前你也敢摆老师的架子？','课堂点名？本王从来不上课','幽默风趣？你的幽默本王不觉得好笑'],
    actives:[
      { id:'rollcall', name:'课堂点名', desc:'点名B王回答问题：展示B王下一步走法，且B王下回合无法吃子 [单体]', cd:3, target:'single' },
      { id:'mock', name:'妙语嘲讽', desc:'减速B王：下回合B王无法移动远距离，且攻击-15% [单体]', cd:3, target:'single' },
      { id:'quiz', name:'考试突击', desc:'己方全体获得护盾吸收下次伤害，且己方下回合连走两步 [全范围]', cd:4, target:'aoe' }
    ],
    passives:[
      { id:'p_teach', name:'因材施教', trigger:PASSIVE_TRIGGER.AURA, desc:'己方仕、相防御+15%，更难被吃' },
      { id:'p_joke', name:'妙语连珠', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每3回合嘲讽一次，B王下回合攻击-20%' }
    ]
  },
  zhouzihan: {
    name:'周子翰', char:'周', title:'风度翩翩', color:'#3a6b8a', glow:'rgba(58,107,138,0.5)',
    desc:'棋风优雅，布局控场，江山易主',
    stats:{ atk:80, def:75, int:95 },
    faction:'strategist',
    skill:{ id:'teleport', name:'江山易主', desc:'将一颗己方棋子传送到任意空位，重新布局（不能吃子） [单体]', cd:3, target:'single' },
    skillLines:['江山易主，乾坤挪移！','运筹帷幄，一子定乾坤','本座布局，由我主宰'],
    loseLines:['风度...终究敌不过实力','布局再妙也有破绽'],
    speech:['风度翩翩？不过是虚有其表','你的江山能撑多久？','优雅的棋风？破绽百出'],
    actives:[
      { id:'teleport', name:'江山易主', desc:'将一颗己方棋子传送到任意空位，重新布局（不能吃子） [单体]', cd:3, target:'single' },
      { id:'elegant', name:'优雅闪烁', desc:'己方一颗棋子瞬移到指定位置，且该子下回合攻击+30% [单体]', cd:3, target:'single' },
      { id:'grandshift', name:'乾坤大挪移', desc:'互换双方各一颗棋子位置，且己方下回合连走两步 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_plan', name:'运筹帷幄', trigger:PASSIVE_TRIGGER.AURA, desc:'开局多看2步路线，全局展示B王首步' },
      { id:'p_elegant', name:'风度翩翩', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'被吃时30%闪避，棋子保留' }
    ]
  },
  sanjin: {
    name:'三金', char:'金', title:'狂战之怒', color:'#c47544', glow:'rgba(196,117,68,0.6)',
    desc:'兄弟义气，以攻代守，极具进攻性——三金的字典里没有"退让"',
    stats:{ atk:95, def:62, int:70 },
    faction:'brother',
    skill:{ id:'ironwall', name:'狂战之怒', desc:'2回合内攻击+50%，可连走两步，且吃子后回血1子（复活） [单体]', cd:4, target:'single' },
    skillLines:['狂战之怒！攻！攻！攻！','兄弟我从不退让！','以攻代守，一击毙命！','你以为能挡住我？做梦！','三金的字典里没有退让！'],
    loseLines:['兄弟...这次攻不动了...','狂战...也有力竭之时','罢了，下次再战'],
    speech:['铜墙铁壁？本王偏要破你的防','让你进攻？本王直接破防','兄弟义气？在本王面前不值一提'],
    actives:[
      { id:'ironwall', name:'狂战之怒', desc:'2回合内攻击+50%，可连走两步，且吃子后回血1子（复活） [单体]', cd:4, target:'single' },
      { id:'execute', name:'嗜血斩杀', desc:'标记B王一颗棋子，下次攻击必中且+50%伤害 [单体]', cd:3, target:'single' },
      { id:'barrage', name:'兄弟连斩', desc:'本回合内所有己方棋子攻击+40%，且吃子后可再走一步 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_brother', name:'兄弟义气', trigger:PASSIVE_TRIGGER.AURA, desc:'己方棋子少于8颗时攻击+30%（绝境狂暴）' },
      { id:'p_attack', name:'以攻代守', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'吃子时立刻回血1子（复活最近被吃的己方棋子）' }
    ]
  },
  jige: {
    name:'鸡哥', char:'鸡', title:'完美伪装', color:'#6b4c8a', glow:'rgba(107,76,138,0.5)',
    desc:'舞步迷惑，完美伪装，虚实难辨',
    stats:{ atk:80, def:70, int:82 },
    faction:'bking',
    skill:{ id:'disguise', name:'完美伪装', desc:'互换两颗己方棋子位置，B王下次攻击打偏，且真身反击吃掉攻击者 [单体]', cd:4, target:'single' },
    skillLines:['完美伪装！你打不中我！','鸡你太美！看你怎么选！','伪装启动，虚实难辨！','这舞步，你看得懂吗？'],
    loseLines:['伪装被看穿了...','舞步乱了...','鸡哥这次伪装失败了...'],
    speech:['完美伪装？本王一眼看穿','你的舞步？不过是瞎蹦跶','鸡哥？让你变成烤鸡'],
    actives:[
      { id:'disguise', name:'完美伪装', desc:'互换两颗己方棋子位置，B王下次攻击打偏，且真身反击吃掉攻击者 [单体]', cd:4, target:'single' },
      { id:'illusion', name:'分身幻象', desc:'复制己方一颗棋子（属性减半）到空位，3回合后消失 [单体]', cd:3, target:'single' },
      { id:'feint', name:'虚晃一枪', desc:'全场迷惑：B王下回合攻击打偏，且B王所有棋子下回合无法移动 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_dodge', name:'虚实难辨', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'被吃时30%打偏，攻击失败' },
      { id:'p_clone', name:'影分身', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每5回合召唤1颗己方兵到空位' }
    ]
  },
  ikun: {
    name:'ikun', char:'K', title:'唱跳rap', color:'#b8945a', glow:'rgba(184,148,90,0.5)',
    desc:'两年半练习生，灵动多变，节奏掌控',
    stats:{ atk:75, def:70, int:85 },
    faction:'bking',
    skill:{ id:'weaken', name:'唱跳篮球', desc:'B王三回合内思考深度降至最低，且每回合30%概率走"艺术走法" [单体]', cd:3, target:'single' },
    skillLines:['唱跳rap篮球！全给你！','两年半不是白练的','我的节奏你跟不上','鸡你太美~跟上我的节奏！'],
    loseLines:['练习...还不够','节奏被打乱了'],
    speech:['唱跳rap篮球？先过我这关','两年半练习？本王修炼千年','你的rap只是噪音'],
    actives:[
      { id:'weaken', name:'唱跳篮球', desc:'B王三回合内思考深度降至最低，且每回合30%概率走"艺术走法" [单体]', cd:3, target:'single' },
      { id:'rhythm', name:'节奏掌控', desc:'减速B王：B王下回合无法移动远距离，且沉默1回合 [单体]', cd:3, target:'single' },
      { id:'allyours', name:'全给你', desc:'3回合内反弹B王50%伤害，且己方下回合连走两步 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_rhythm', name:'律动本能', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每4回合加速，下回合连走两步' },
      { id:'p_rebound', name:'反震本能', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'被吃时反弹30%伤害，对方下回合攻-20%' }
    ]
  },
  huhao: {
    name:'胡浩', char:'胡', title:'浩然正气', color:'#4a7c59', glow:'rgba(74,124,89,0.5)',
    desc:'堂堂正正，以正道碾压，正气凛然',
    stats:{ atk:90, def:90, int:75 },
    faction:'brother',
    skill:{ id:'revive', name:'浩然正气', desc:'复活最近两颗被吃的己方棋子，并获得额外一回合 [单体]', cd:4, target:'single' },
    skillLines:['浩然正气！起死回生','正道不灭，棋魂不散','以正克邪，万法归一'],
    loseLines:['正气...终究败给了权谋','堂堂正正也赢不了B王'],
    speech:['浩然正气？棋盘之上无正气','堂堂正正？本王偏要阴你','正道之力？不堪一击'],
    actives:[
      { id:'revive', name:'浩然正气', desc:'复活最近两颗被吃的己方棋子，并获得额外一回合 [单体]', cd:4, target:'single' },
      { id:'shield', name:'正道护体', desc:'己方一颗棋子获得护盾，吸收下次伤害，且防御+30% [单体]', cd:3, target:'single' },
      { id:'unity', name:'万法归一', desc:'复活所有被吃己方棋子（最多3颗），且己方全体攻击+20% [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_shield', name:'金刚护体', trigger:PASSIVE_TRIGGER.IMMUNE, desc:'免疫一次吃子（每局1次）' },
      { id:'p_unity', name:'万法归宗', trigger:PASSIVE_TRIGGER.AURA, desc:'己方将受保护，将军时对方需多吃1子才能将死' }
    ]
  },
  xieyuxuan: {
    name:'解宇轩', char:'解', title:'逻辑大师', color:'#8a4c6b', glow:'rgba(138,76,107,0.5)',
    desc:'逻辑推理天下无双，因果律锁',
    stats:{ atk:85, def:75, int:99 },
    faction:'immortal',
    skill:{ id:'lockdown', name:'因果律锁', desc:'锁定对方一颗棋子3回合无法移动，且锁定期间该子可被己方吃掉 [单体]', cd:3, target:'single' },
    skillLines:['因果律锁！这颗子已无路可走','逻辑闭环，禁锢生效','变量已归零，因果已定'],
    loseLines:['逻辑...也有推理失败的时候','前提错了，结论自然错'],
    speech:['逻辑大师？本王不讲逻辑','你的推理？前提就是错的','因果必然？本王就是那个意外'],
    actives:[
      { id:'lockdown', name:'因果律锁', desc:'锁定对方一颗棋子3回合无法移动，且锁定期间该子可被己方吃掉 [单体]', cd:3, target:'single' },
      { id:'logic_silence', name:'逻辑沉默', desc:'沉默B王2回合无法使用技能，且B王下回合无法吃子 [单体]', cd:3, target:'single' },
      { id:'logicblast', name:'逻辑爆破', desc:'全场禁锢B王所有棋子1回合，且B王下回合无法使用技能 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_logic', name:'逻辑闭环', trigger:PASSIVE_TRIGGER.AURA, desc:'首回合看穿对方价值最高的非将棋子' },
      { id:'p_deduce', name:'演绎推理', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'吃子后看穿对方下2步走法' }
    ]
  },
  luxingchen: {
    name:'陆星辰', char:'陆', title:'代码大师', color:'#4c6b8a', glow:'rgba(76,107,138,0.5)',
    desc:'以代码重构棋盘，异常捕获',
    stats:{ atk:78, def:85, int:92 },
    faction:'strategist',
    skill:{ id:'catch', name:'异常捕获', desc:'对方下回合无法吃子（被catch），且己方下回合连走两步 [单体]', cd:3, target:'single' },
    skillLines:['异常捕获！已try-catch！','找到Bug了！你的攻击无效！','catch成功，下回合双倍执行！'],
    loseLines:['遇到无法Debug的异常...','这段代码没法修了'],
    speech:['代码大师？看看你的代码量','debug？本王就是那个Bug','重构棋盘？你重构不了本王'],
    actives:[
      { id:'catch', name:'异常捕获', desc:'对方下回合无法吃子（被catch），且己方下回合连走两步 [单体]', cd:3, target:'single' },
      { id:'debug', name:'代码扫描', desc:'标记B王一颗棋子，下次攻击必中且+50%伤害 [单体]', cd:3, target:'single' },
      { id:'crash', name:'系统崩溃', desc:'B王全体棋子沉默2回合，且B王下回合无法移动 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_debug', name:'除错本能', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每5回合清除对方1个增益效果' },
      { id:'p_refactor', name:'重构', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'己方子被吃时20%概率复活' }
    ]
  },
  tangboyuhan: {
    name:'唐昊博涵', char:'唐', title:'全班第一', color:'#8a6b3a', glow:'rgba(138,107,58,0.5)',
    desc:'成绩碾压全场，标准答案在手',
    stats:{ atk:82, def:84, int:88 },
    faction:'strategist',
    skill:{ id:'control', name:'标准答案', desc:'操控对方走一步对你有利的棋（不能吃你的子） [单体]', cd:3, target:'single' },
    skillLines:['标准答案！这步我来替你走！','全班第一，你的走法我说了算','答案已定，你无权更改'],
    loseLines:['这题超纲了...','考试范围之外的知识...'],
    speech:['全班第一？本王全校第一','翻书作弊？本王就是教科书','标准答案？本王就是答案'],
    actives:[
      { id:'control', name:'标准答案', desc:'操控对方走一步对你有利的棋（不能吃你的子） [单体]', cd:3, target:'single' },
      { id:'cheat', name:'翻书作弊', desc:'看穿B王下2步走法，且己方一颗棋子获得护盾 [单体]', cd:3, target:'single' },
      { id:'exam', name:'考试突击', desc:'操控B王下2步走法，且B王下回合无法吃子 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_knowledge', name:'知识点', trigger:PASSIVE_TRIGGER.AURA, desc:'看穿对方下2步走法路线' },
      { id:'p_fullmark', name:'满分', trigger:PASSIVE_TRIGGER.AURA, desc:'己方炮、马攻击+15%' }
    ]
  },
  alice: {
    name:'仙帝Alice', char:'仙', title:'仙帝重生', color:'#9b59b6', glow:'rgba(155,89,182,0.75)',
    desc:'仙帝转世重修，一念定乾坤。独门仙法「天罚」极具进攻性——剥夺B王最强子，命定3步，下回合双杀',
    stats:{ atk:99, def:99, int:99 },
    faction:'immortal',
    skill:{ id:'awe', name:'仙帝·天罚', desc:'独门仙法：B王被迫献出最强一子（非将）；命定B王接下来3步路线；下回合仙帝连走两步；剥夺B王被动2回合 [单体]', cd:5, target:'single' },
    skillLines:['仙帝·天罚！尔等棋路，皆在本座掌中！','本座一念，尔等皆跪！','凡俗蝼蚁，敢挡仙帝之威？','你的走法，由本座书写！','天罚已降，无可更改！'],
    loseLines:['仙帝...也有陨落之时...','威压...被打破了...','不可能！本仙帝怎么会输！'],
    speech:['仙帝重生？在本王面前不过是重修的小仙','命定因果？本王的棋路岂容你书写','仙帝？本王让你重新修炼'],
    actives:[
      { id:'awe', name:'仙帝·天罚', desc:'独门仙法：B王被迫献出最强一子（非将）；命定B王接下来3步路线；下回合仙帝连走两步；剥夺B王被动2回合 [单体]', cd:5, target:'single' },
      { id:'descent', name:'仙帝降临', desc:'禁锢B王一颗棋子2回合无法行动，且该子可被己方吃掉 [单体]', cd:4, target:'single' },
      { id:'judgment', name:'仙帝审判', desc:'全场审判：B王所有棋子受到真实伤害（无视防御），且B王被动失效3回合 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_pressure', name:'仙帝威压', trigger:PASSIVE_TRIGGER.AURA, desc:'B王技能CD+1回合，技能释放概率-15%' },
      { id:'p_samsara', name:'天道轮回', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每3回合复活1颗己方被吃棋子' }
    ]
  },
  liuqi: {
    name:'大汉棋圣', char:'汉', title:'掀桌之圣', color:'#8b4513', glow:'rgba(139,69,19,0.6)',
    desc:'刘启化身，棋风豪迈不羁，一言不合掀桌重来',
    stats:{ atk:90, def:68, int:78 },
    faction:'hermit',
    skill:{ id:'flip', name:'掀桌不玩了', desc:'掀翻棋桌！回溯3步棋局，双方各回原位，本方保留先手 [单体]', cd:5, target:'single' },
    skillLines:['掀桌！老子不玩了！','这盘不算！重来！','大汉棋圣，掀桌无敌！','不爽就掀，这才是豪迈！'],
    loseLines:['掀桌也救不了我...','这桌掀得...把自己掀翻了'],
    speech:['掀桌？在本王面前你掀不起风浪','大汉棋圣？不过是个莽夫','掀桌子？本王让你连桌子都看不到'],
    actives:[
      { id:'flip', name:'掀桌不玩了', desc:'掀翻棋桌！回溯3步棋局，双方各回原位，本方保留先手 [单体]', cd:5, target:'single' },
      { id:'charge', name:'豪迈冲撞', desc:'减速B王全体棋子：下回合无法移动远距离，且攻击-15% [全范围]', cd:3, target:'aoe' },
      { id:'saint', name:'棋圣降临', desc:'回溯5步棋局，且B王下回合无法吃子，本方获得额外回合 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_bold', name:'豪迈', trigger:PASSIVE_TRIGGER.IMMUNE, desc:'免疫沉默、禁锢类技能' },
      { id:'p_flipgod', name:'掀桌之神', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'上回合若吃子，本回合主动技能CD-1' }
    ]
  },
  liuxuepei: {
    name:'刘雪沛', char:'雪', title:'B王克星', color:'#5b8def', glow:'rgba(91,141,239,0.65)',
    desc:'冰雪聪慧，洞察一切虚伪，专破装逼之术',
    stats:{ atk:84, def:88, int:96 },
    faction:'immortal',
    skill:{ id:'silence', name:'破妄之眼', desc:'沉默B王3回合无法使用技能，且每回合30%走错；对B王伤害+50% [单体]', cd:4, target:'single' },
    skillLines:['破妄之眼！你的装逼到此为止！','沉默！在我面前你装不起来','我看穿了你一切手段','B王？在我面前只是个笑话'],
    loseLines:['克星...也有失手的时候','B王的装逼超出了我的计算'],
    speech:['B王克星？在本王面前不过是虚名','破妄之眼？本王让你破不了','看穿本王？你太天真了'],
    actives:[
      { id:'silence', name:'破妄之眼', desc:'沉默B王3回合无法使用技能，且每回合30%走错；对B王伤害+50% [单体]', cd:4, target:'single' },
      { id:'mark', name:'洞察标记', desc:'标记B王一颗棋子，下次攻击必中且+50%伤害 [单体]', cd:3, target:'single' },
      { id:'nemesis', name:'克星之刃', desc:'全场沉默B王2回合，且B王所有棋子防御-30% [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_insight', name:'洞察', trigger:PASSIVE_TRIGGER.AURA, desc:'看穿B王当前技能CD与下步走法' },
      { id:'p_nemesis', name:'克星', trigger:PASSIVE_TRIGGER.AURA, desc:'对B王造成的伤害+50%（吃B王子时额外吃1子）' }
    ]
  },
  bking: {
    name:'B王', char:'B', title:'装逼之王', color:'#2a2520', glow:'rgba(42,37,32,0.6)',
    desc:'自诩天下第一，气场凌人，棋盘之上唯我独尊',
    stats:{ atk:90, def:72, int:82 },
    faction:'bking',
    skill:{ id:'flex', name:'装逼时刻', desc:'撤销对手最近一步棋，并额外走一步，还嘲讽一番 [单体]', cd:4, target:'single' },
    skills:[
      { id:'flex', name:'装逼时刻', desc:'撤销对手最近一步棋，并额外走一步，还嘲讽一番 [单体]', cd:4, target:'single' },
      { id:'domain', name:'装逼领域', desc:'3回合内对手攻击-30%、防御-30%，B王气场压制全场 [全范围]', cd:5, target:'all' },
      { id:'selfreverse', name:'以退为进·本王版', desc:'撤销己方最近1步并额外走2步，本王退着走都能赢你 [单体]', cd:3, target:'single' },
      { id:'seize', name:'先手夺人', desc:'用最弱的子白吃玩家最强子，还嘲讽"看到没？本王的弱子都能吃你强子" [单体]', cd:4, target:'single' },
      { id:'swap', name:'偷梁换柱', desc:'互换双方一个强弱子的位置，本王偷梁换柱你都不知道 [单体]', cd:4, target:'single' }
    ],
    actives:[
      { id:'flex', name:'装逼时刻', desc:'撤销对手最近一步棋，并额外走一步，还嘲讽一番 [单体]', cd:4, target:'single' },
      { id:'domain', name:'装逼领域', desc:'3回合内对手攻击-30%、防御-30%，B王气场压制全场 [全范围]', cd:5, target:'all' },
      { id:'selfreverse', name:'以退为进·本王版', desc:'撤销己方最近1步并额外走2步，本王退着走都能赢你 [单体]', cd:3, target:'single' }
    ],
    skillLines:[
      '看到没？这就是本王的实力！','你们这群凡人，懂什么叫棋艺？','这步棋，本王三百年前就算到了',
      '在B王的领域里，你连呼吸都是错的！','气场全开！你的攻防都被本王压制！','这就是B王领域的力量，颤抖吧！',
      '退着走都能赢你，本王就是这么强！','以退为进？这是本王发明的战术！','退一步海阔天空，进一步碾压你！',
      '看到没？本王的弱子都能吃你强子！','先手夺人！你最强的子也逃不过！','本王随便一颗小卒都能斩你大将！',
      '偷梁换柱！你都不知道自己被换了！','你的强子？现在归本王管了！','换位思考？本王直接换你位置！'
    ],
    loseLines:['不可能...这绝不可能！本王怎么会输！','本王...居然输给了凡人？','一定是系统bug！本王要求重赛！'],
    speech:['B王？你也配叫B王？','装逼？在本王面前你只是个弟弟'],
    passives:[
      { id:'p_aura', name:'装逼光环', trigger:PASSIVE_TRIGGER.AURA, desc:'对手攻击-10%，持续全场' },
      { id:'p_shameless', name:'厚颜无耻', trigger:PASSIVE_TRIGGER.IMMUNE, desc:'免疫1次沉默/禁锢（每局1次）' }
    ]
  },
  /* ===== 新增 4 角色 ===== */
  liujiawei: {
    name:'刘佳伟', char:'佳', title:'稳健派', color:'#5a7c4a', glow:'rgba(90,124,74,0.5)',
    desc:'稳如泰山，以退为进，后发制人',
    stats:{ atk:85, def:88, int:80 },
    faction:'brother',
    skill:{ id:'retreat', name:'以退为进', desc:'撤销己方最近1步，对方下回合无法吃子（被己方退步迷惑） [单体]', cd:3, target:'single' },
    skillLines:['以退为进！看你怎么应对！','退一步，海阔天空','稳如泰山，后发制人'],
    loseLines:['稳健...也有失守的时候','退得太多，退无可退'],
    speech:['稳健派？在本王面前你稳不住','以退为进？退着退着就没了','泰山？本王让你变成泥石流'],
    actives:[
      { id:'retreat', name:'以退为进', desc:'撤销己方最近1步，对方下回合无法吃子（被己方退步迷惑） [单体]', cd:3, target:'single' },
      { id:'steadfast', name:'稳如泰山', desc:'己方一颗棋子获得护盾，吸收下次伤害，且防御+25% [单体]', cd:3, target:'single' },
      { id:'counter', name:'后发制人', desc:'3回合内反弹B王40%伤害，且B王每回合攻击-10% [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_stable', name:'不动如山', trigger:PASSIVE_TRIGGER.AURA, desc:'己方将防御+20%，更难被将死' },
      { id:'p_revenge', name:'退步反击', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'被吃时反吃对方1颗价值相当的子' }
    ]
  },
  yuanqingshan: {
    name:'袁清山', char:'清', title:'隐士', color:'#4a6b5a', glow:'rgba(74,107,90,0.5)',
    desc:'隐居山林，潜龙勿用，厚积薄发',
    stats:{ atk:78, def:90, int:88 },
    faction:'hermit',
    skill:{ id:'hidden', name:'潜龙勿用', desc:'隐藏己方价值最高的非将棋子3回合（B王无法看到/锁定/吃它） [单体]', cd:4, target:'single' },
    skillLines:['潜龙勿用！你找不到我！','隐士之术，深藏不露','龙跃之时，一鸣惊人'],
    loseLines:['隐忍...终究有限','潜龙...还没跃就结束了'],
    speech:['隐士？在本王面前你藏不住','潜龙勿用？本王直接把你挖出来','隐居？本王让你无处可藏'],
    actives:[
      { id:'hidden', name:'潜龙勿用', desc:'隐藏己方价值最高的非将棋子3回合（B王无法看到/锁定/吃它） [单体]', cd:4, target:'single' },
      { id:'blink', name:'隐遁闪烁', desc:'己方一颗棋子瞬移到指定空位，且该子下回合无法被锁定 [单体]', cd:3, target:'single' },
      { id:'leap', name:'龙跃九天', desc:'己方全体攻击+40%，且B王下回合无法吃子 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_hide', name:'隐忍', trigger:PASSIVE_TRIGGER.AURA, desc:'首回合免疫所有技能' },
      { id:'p_leap', name:'龙跃', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'3回合后攻击+40%，持续2回合' }
    ]
  },
  luolunjie: {
    name:'罗伦杰', char:'罗', title:'连击大师', color:'#a04030', glow:'rgba(160,64,48,0.6)',
    desc:'连环斩击，以攻代守，连击破甲',
    stats:{ atk:94, def:65, int:78 },
    faction:'brother',
    skill:{ id:'combo', name:'连环斩', desc:'本回合吃1子后，立刻再吃1子（连环斩击），且破防无视防御 [单体]', cd:3, target:'single' },
    skillLines:['连环斩！一刀接一刀！','连击！破甲！再斩！','你以为只吃一子？天真！','斩铁断金，连击不停！'],
    loseLines:['连击...被打断了','斩不动了...'],
    speech:['连击大师？本王让你连不起来','连环斩？本王直接断你连','破甲？本王的甲你破不了'],
    actives:[
      { id:'combo', name:'连环斩', desc:'本回合吃1子后，立刻再吃1子（连环斩击），且破防无视防御 [单体]', cd:3, target:'single' },
      { id:'pierce', name:'破甲突袭', desc:'标记B王一颗棋子，下次攻击必中且无视防御 [单体]', cd:3, target:'single' },
      { id:'storm', name:'无尽连斩', desc:'本回合己方每吃1子可再走一步（最多3步），且攻击+30% [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_chainatk', name:'连击', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'吃子后下回合攻击+20%' },
      { id:'p_break', name:'斩铁', trigger:PASSIVE_TRIGGER.AURA, desc:'攻击无视对方防御增益（破防）' }
    ]
  },
  daaixianzun: {
    name:'大爱仙尊', char:'爱', title:'方源真身', color:'#d4af37', glow:'rgba(212,175,55,0.8)',
    desc:'古月方源化身，冷漠无情、极度利己、算计无双，为达目的不择手段；大爱无疆不过是弱者的墓志铭',
    stats:{ atk:99, def:99, int:99 },
    faction:'immortal',
    skill:{ id:'sacrifice', name:'噬蛊祭道', desc:'献祭己方最弱棋子，对敌方最强棋子造成真实伤害（无视防御）；若击杀则己方全体回血 [单体]', cd:4, target:'single' },
    skillLines:['众生皆可为我所用','算计，是强者的特权','你的价值，到此为止','大爱无疆...不过是弱者的墓志铭','古月方源...这才是我的真名'],
    loseLines:['算无遗策...竟有此变','棋子用尽，天命已终','这局，是我低估了你'],
    speech:['古月方源？不过是个会算计的小人','你的大爱？本王看着就想笑','蛊师？在本王面前不过是戏法'],
    actives:[
      { id:'sacrifice',  name:'噬蛊祭道', desc:'献祭己方价值最低的非王棋子，对敌方价值最高的非王棋子造成等同于献祭棋子最大生命值的真实伤害（无视防御）；若击杀目标，己方全体回复40HP [单体]', cd:4, target:'single' },
      { id:'prey',       name:'算计连环', desc:'标记敌方价值最高的非王棋子为"猎物"，3回合内其防御归零（无视防御）；猎物被吃时己方全体回复其最大生命值40% [单体]', cd:5, target:'single' },
      { id:'conversion', name:'大爱无疆', desc:'将敌方攻击力最高的非王棋子"感化"为己方阵营，生命/攻防保持不变，清除其所有buff；万物皆为我用 [单体]', cd:6, target:'single' }
    ],
    passives:[
      { id:'p_ironheart', name:'铁石心肠', trigger:PASSIVE_TRIGGER.IMMUNE,    desc:'首回合己方全体免疫所有伤害；方源受到的技能效果首回合无效' },
      { id:'p_gumaster',  name:'蛊师本能', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'己方棋子被吃时，己方全体回复25HP，方源获得攻击+10%（2回合，可叠加3层）' }
    ]
  }
};

/* ===== 3 个难度（互联网装逼等级） · B王极大加强 ===== */
const DIFFICULTIES = {
  easy: {
    name:'B王 · 青铜装', title:'萌新装逼', depth:3, randomChance:0.3,
    skill:{ id:'mock', name:'装逼', desc:'装X嘲讽，顺便偷看一眼你的弱点 [单体]', target:'single' },
    skills:[ {id:'mock', target:'single'} ],
    skillChance:0.35,
    bkingPassives:['p_aura'], /* 青铜装仅1被动 */
    skillLines:['啊这...就这水平？','本王随便玩玩都比你强','你们这群凡人，懂什么叫棋艺？','就这？也敢来挑战本王？'],
    winLines:['果然，凡人就是凡人','本王随便下下就赢了','这局赢得毫无成就感'],
    loseLines:['哼，本王只是让着你','运气好罢了，本王根本没认真','本王今天状态不好，下次虐爆你']
  },
  medium: {
    name:'B王 · 钻石装', title:'熟练装逼', depth:4, randomChance:0.1,
    skill:{ id:'reverse', name:'赖皮', desc:'撤销你最近一步棋，并获得额外一回合 [单体]', target:'single' },
    skills:[ {id:'reverse', target:'single'}, {id:'confuse', target:'single'} ],
    skillChance:0.55,
    bkingPassives:['p_aura','p_shameless'], /* 钻石装2被动 */
    skillLines:['等等！这步不算！本王没看清','你这步有问题！重来！','本王不同意你这么走！','你以为能瞒过本王的法眼？'],
    winLines:['看到没？这就是本王的实力','你们这群凡人，永远追不上本王','本王随便操作都是神级走位'],
    loseLines:['居然...被你蒙对了','这步棋本王确实大意了','下次绝不会给你这个机会']
  },
  hard: {
    name:'B王 · 王者装', title:'特级装逼', depth:6, randomChance:0,
    skill:{ id:'foresight', name:'装逼洞察', desc:'看穿你的意图，额外走一步，且你下回合无法吃子 [单体]', target:'single' },
    skills:[ {id:'foresight', target:'single'}, {id:'seize', target:'single'}, {id:'swap', target:'single'}, {id:'domain', target:'all'}, {id:'selfreverse', target:'single'} ],
    skillChance:0.7,
    bkingPassives:['p_aura','p_shameless','p_kingaura'], /* 王者装3被动 */
    skillLines:['本王早就知道你要这么走！','你的一切都在本王的掌控之中！','棋盘之上，本王就是神！','这步棋，本王三百年前就算到了'],
    winLines:['看到没？这就是王者的实力','凡人，永远无法理解本王的境界','本王的棋艺，已经达到了化境'],
    loseLines:['不可能...这绝不可能！本王怎么会输！','本王...居然输给了凡人？','一定是系统bug！本王要求重赛！']
  }
};

/* B王 王者装额外被动 */
const BKING_EXTRA_PASSIVE = {
  id:'p_kingaura', name:'王者气场', trigger:PASSIVE_TRIGGER.AURA, desc:'B王技能CD-1回合，且释放概率+10%'
};

/* ===== 三英战B王 · B王极限强化 ===== */
const THREE_HEROES_BKING = {
  depth: 8,              /* 思考深度 +2 */
  skillChance: 0.85,     /* 技能释放概率极高 */
  comboTurns: 4,         /* 每4回合连环双杀 */
  revengeChance: 0.3,    /* 被吃时30%反吃 */
  passives: ['p_aura','p_shameless','p_kingaura','p_combo','p_revenge'],
  extraPassives: [
    { id:'p_combo', name:'连环双杀', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每4回合B王连走两步' },
    { id:'p_revenge', name:'天命所归', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'B王被吃时30%概率反吃对方' }
  ]
};

/* ===== B王通用话语 ===== */
const B_TAUNTS = {
  start:['哟，又来一个挑战者？本王等着呢','欢迎来到本王的棋盘，凡人','这局，本王让你先出手，免得说本王欺负人','就这？也敢挑战本王？'],
  thinking:['本王正在思考，你们凡人不懂','这步棋...本王早已料到','你以为本王在思考？其实本王在装逼','让本王想想，怎么虐你才比较有观赏性'],
  capture:['本王收下了！','这子归本王了，感谢馈赠','不过是区区一子，本王根本不在乎','看到没？这就是实力的差距'],
  check:['将军！凡人，你慌了吗？','退无可退了吧？认输吧！','本王随便走一步都是将军，羡慕吗？','将死只是时间问题，你还挣扎什么？'],
  react:['哼，雕虫小技！','就这？本王根本不放在眼里','你以为这招对本王有用？','可笑，真是可笑','本王早有防备，休想得逞','这点手段也想撼动本王？']
};

/* ===== 阵营定义 ===== */
const FORMATIONS = {
  bking:     { name:'B王阵营', color:'#2a2520', desc:'装逼为王，以势压人', members:['bking','ikun','liuqi','liuxuepei'] },
  immortal:  { name:'仙帝阵营', color:'#9b59b6', desc:'仙法无垠，天罚降临', members:['alice','daaixianzun','liuxuepei','xieyuxuan'] },
  strategist:{ name:'谋士阵营', color:'#3a6b8a', desc:'运筹帷幄，谋定后动', members:['houzhibo','zhouzihan','luxingchen','tangboyuhan'] },
  brother:   { name:'兄弟阵营', color:'#c47544', desc:'兄弟义气，以攻代守', members:['sanjin','huhao','liujiawei','luolunjie'] },
  hermit:    { name:'隐士阵营', color:'#4a6b5a', desc:'隐忍待机，厚积薄发', members:['yuanqingshan','wangxin','liuxuepei','liuqi'] }
};

/* ===== 故事模式章节（参考逸剑风云诀） ===== */
const STORY_CHAPTERS = [
  {
    id:1, title:'第一章 · 初遇B王', desc:'初入棋途，遭遇B王青铜装',
    enemy:'bking', difficulty:'easy', hp:3,
    unlockChars:['houzhibo','zhouzihan','luxingchen'],
    intro:['少年初入棋途，偶遇自封"装逼之王"的B王','B王：哟，又来一个送菜的？本王等着呢','少年：哼，装什么装，来战！'],
    win:['B王：哼，本王只是让着你','运气好罢了，本王根本没认真','少年心中暗下决心，一定要变强...']
  },
  {
    id:2, title:'第二章 · 智斗', desc:'侯智博、周子翰、陆星辰加入',
    enemy:'bking', difficulty:'medium', hp:3,
    unlockChars:['tangboyuhan'],
    intro:['侯智博：少年，智斗B王需用谋略，我助你一臂之力','周子翰：布局之道，由我传授','陆星辰：让我Debug B王的漏洞','B王：雕虫小技！本王根本不放在眼里'],
    win:['B王：居然...被你蒙对了','侯智博：此局算计得当，但B王还有更强形态','少年：还有更强形态？']
  },
  {
    id:3, title:'第三章 · 兄弟义气', desc:'三金、胡浩加入，B王钻石装',
    enemy:'bking', difficulty:'medium', hp:4,
    unlockChars:['sanjin','huhao'],
    intro:['三金：兄弟！以攻代守，跟我冲！','胡浩：浩然正气，正道不灭！','B王：钻石装逼，本王的实力又上一层！','三金：狂战之怒！攻！攻！攻！'],
    win:['B王：下次绝不会给你这个机会','三金：兄弟，B王没那么容易对付','胡浩：正道还需更强大的力量']
  },
  {
    id:4, title:'第四章 · 破妄', desc:'刘雪沛加入，揭示B王弱点',
    enemy:'bking', difficulty:'hard', hp:4,
    unlockChars:['liuxuepei'],
    intro:['刘雪沛：我看穿了你一切手段，B王','刘雪沛：你的装逼，在我面前不过是笑话','B王：王者装逼！本王早就知道你要这么走！','刘雪沛：破妄之眼！你的装逼到此为止！'],
    win:['刘雪沛：B王的弱点在于他的被动','刘雪沛：需要仙帝之力才能彻底剥夺','少年：仙帝...？']
  },
  {
    id:5, title:'第五章 · 仙帝降临', desc:'仙帝Alice加入，对抗B王王者装',
    enemy:'bking', difficulty:'hard', hp:5,
    unlockChars:['alice'],
    intro:['仙帝Alice：凡俗蝼蚁，敢挡仙帝之威？','Alice：B王，你的棋路，由本座书写','B王：装逼？在本王面前你只是个弟弟！','Alice：仙帝·天罚！尔等皆跪！'],
    win:['B王：不可能！本王怎么会输！','Alice：仙帝之力，岂是装逼可挡','少年：但B王还有终极形态...']
  },
  {
    id:6, title:'第六章 · 大爱无疆', desc:'大爱仙尊加入，最终战三英B王极限态',
    enemy:'bking', difficulty:'hard', hp:6, threeHeroes:true,
    unlockChars:['daaixianzun','luolunjie','liujiawei'],
    intro:['大爱仙尊：本座降临，大爱无疆！','大爱仙尊：造物主之力，岂是凡俗可挡？','B王：三英战B王！本王极限形态，被动全开！','大爱仙尊：全屏沉默！众生皆寂！'],
    win:['B王：不可能...这绝不可能！','大爱仙尊：大爱普度，棋局归宁','少年：终于...讨伐B王成功...']
  },
  {
    id:7, title:'终章 · 讨伐B王', desc:'全阵容 vs B王终极形态',
    enemy:'bking', difficulty:'hard', hp:8, threeHeroes:true, finale:true,
    unlockChars:['bking','yuanqingshan','wangxin','ikun','liuqi'],
    intro:['全员：讨伐B王！','B王：终极形态！本王就是神！','仙帝Alice：天罚！','大爱仙尊：大爱！','刘雪沛：破妄！','B王：来吧！让本王看看你们的极限！'],
    win:['B王：本王...装逼失败了...','全员：胜利！','少年：B王的时代，终结了','（全剧终）']
  }
];

/* ===== 语音配置 ===== */
const VOICE_PROFILES = {
  houzhibo:    { pitch: 0.9,  rate: 1.0,  lang: 'zh-CN' },
  wangxin:     { pitch: 1.1,  rate: 1.1,  lang: 'zh-CN' },
  zhouzihan:   { pitch: 0.95, rate: 0.95, lang: 'zh-CN' },
  sanjin:      { pitch: 0.78, rate: 1.15, lang: 'zh-CN' },
  jige:        { pitch: 1.15, rate: 1.1,  lang: 'zh-CN' },
  ikun:        { pitch: 1.2,  rate: 1.3,  lang: 'zh-CN' },
  huhao:       { pitch: 0.8,  rate: 0.9,  lang: 'zh-CN' },
  xieyuxuan:   { pitch: 1.0,  rate: 0.9,  lang: 'zh-CN' },
  luxingchen:  { pitch: 1.05, rate: 1.0,  lang: 'zh-CN' },
  tangboyuhan: { pitch: 1.0,  rate: 1.0,  lang: 'zh-CN' },
  alice:       { pitch: 0.7,  rate: 0.82, lang: 'zh-CN' },
  bking:       { pitch: 0.75, rate: 1.05, lang: 'zh-CN' },
  liuqi:       { pitch: 0.6,  rate: 1.1,  lang: 'zh-CN' },
  liuxuepei:   { pitch: 1.15, rate: 1.0,  lang: 'zh-CN' },
  liujiawei:   { pitch: 0.92, rate: 0.95, lang: 'zh-CN' },
  yuanqingshan:{ pitch: 0.95, rate: 0.88, lang: 'zh-CN' },
  luolunjie:   { pitch: 0.82, rate: 1.12, lang: 'zh-CN' },
  daaixianzun: { pitch: 0.68, rate: 0.8,  lang: 'zh-CN' }
};

/* ===== 角色BGM主题 =====
   motif：引用 audio.js 中 MOTIFS 乐句库的 key（按情绪分类），
   不指定时回退到 mood 字段。 */
const BGM_THEMES = {
  houzhibo:    { scale: [0,2,4,7,9],   root: 261.63, tempo: 0.5,  wave: 'triangle', mood: 'strategic',  motif: 'strategic' },
  wangxin:     { scale: [0,2,4,7,9],   root: 293.66, tempo: 0.42, wave: 'sine',     mood: 'playful',    motif: 'energetic' },
  zhouzihan:   { scale: [0,2,3,5,7],   root: 311.13, tempo: 0.55, wave: 'sine',     mood: 'elegant',    motif: 'ambient' },
  sanjin:      { scale: [0,2,5,7,10],  root: 246.94, tempo: 0.4,  wave: 'sawtooth', mood: 'aggressive', motif: 'aggressive' },
  jige:        { scale: [0,3,5,7,10],  root: 277.18, tempo: 0.4,  wave: 'sawtooth', mood: 'mysterious', motif: 'wild' },
  ikun:        { scale: [0,2,4,7,9],   root: 329.63, tempo: 0.33, wave: 'square',   mood: 'energetic',  motif: 'energetic' },
  huhao:       { scale: [0,2,4,5,7],   root: 220.00, tempo: 0.58, wave: 'triangle', mood: 'righteous',  motif: 'strategic' },
  xieyuxuan:   { scale: [0,2,4,7,11],  root: 277.18, tempo: 0.5,  wave: 'sine',     mood: 'analytical', motif: 'ambient' },
  luxingchen:  { scale: [0,2,3,7,8],   root: 261.63, tempo: 0.45, wave: 'square',   mood: 'digital',    motif: 'energetic' },
  tangboyuhan: { scale: [0,2,4,7,9],   root: 311.13, tempo: 0.5,  wave: 'triangle', mood: 'scholarly',  motif: 'ambient' },
  alice:       { scale: [0,2,4,7,9],   root: 196.00, tempo: 0.65, wave: 'sine',     mood: 'celestial',  motif: 'celestial' },
  bking:       { scale: [0,1,3,6,8],   root: 174.61, tempo: 0.48, wave: 'sawtooth', mood: 'imposing',   motif: 'imposing' },
  liuqi:       { scale: [0,2,5,7,10],  root: 164.81, tempo: 0.38, wave: 'square',   mood: 'wild',       motif: 'wild' },
  liuxuepei:   { scale: [0,3,5,7,10],  root: 293.66, tempo: 0.5,  wave: 'sine',     mood: 'sharp',      motif: 'aggressive' },
  liujiawei:   { scale: [0,2,4,7,9],   root: 277.18, tempo: 0.55, wave: 'triangle', mood: 'steadfast',  motif: 'strategic' },
  yuanqingshan:{ scale: [0,2,4,5,7],   root: 233.08, tempo: 0.7,  wave: 'sine',     mood: 'hermit',     motif: 'ambient' },
  luolunjie:   { scale: [0,2,5,7,10],  root: 220.00, tempo: 0.38, wave: 'sawtooth', mood: 'combo',      motif: 'aggressive' },
  daaixianzun: { scale: [0,2,4,7,9],   root: 174.61, tempo: 0.68, wave: 'sine',     mood: 'celestial',  motif: 'celestial' }
};
const MENU_THEME = { scale: [0,2,4,7,9], root: 220.00, tempo: 0.8, wave: 'sine', mood: 'ambient', motif: 'ambient' };

/* ===== 全局暴露（兼容 window 作用域） ===== */
if (typeof window !== 'undefined') {
  window.PIECE_TYPE = PIECE_TYPE;
  window.PIECE_TYPE_NAME = PIECE_TYPE_NAME;
  window.PIECE_STATS = PIECE_STATS;
}
