/* ============================================
   data.js — 博弈之王 · 数据层 v4.0 (Dota2 化大修)
   常量 / 多角色（动态 Object.keys(CHARACTERS).length）/ 3难度 / 被动技能 / 阵容 / 故事章节
   每角色: 主动技能（普通选1/B王选3）+ 被动技能（数量>2时选2，否则选1）
   ============================================ */
'use strict';

/* ===== 基础常量 ===== */
const COLS = 9, ROWS = 10;
const RED = 'red', BLACK = 'black';
const BLUE = 'blue', GREEN = 'green';
const PLAYER_COLORS = [RED, BLACK, BLUE, GREEN];
const T = { KING:'k', ADVISOR:'a', ELEPHANT:'e', HORSE:'h', ROOK:'r', CANNON:'c', PAWN:'p' };

/* ===== 构建版本开关（v39 新增） =====
   INTERNAL_BUILD=true → 内测版（玩家 B王 显示名「薛贺洲」，露骨风格分支）
   INTERNAL_BUILD=false → 公开版（玩家 B王 显示名「B王」，标准风格）
   切换方式：在 index.html 加载 data.js 前注入 <script>window.INTERNAL_BUILD=true;</script>
   或在 server.py 启动时设置环境变量（推荐用 query 参数 ?internal=1 控制） */
const INTERNAL_BUILD = (typeof globalThis !== 'undefined' && globalThis.INTERNAL_BUILD) || false;
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

/* 英雄类型（Dota2风格）
   v10-skill-redesign: 角色按力量/敏捷/智力分类，影响 HP/def/atk/技能伤害/CD/移速
   v27-hero-rebalance: 三系加成重新平衡
     - 力量系：HP+25%, def+15%（略降避免过肉），反击伤害+20%（贴身肉搏强）
     - 敏捷系：atk+20%, 移速+1, 闪避+10%（补偿脆皮）
     - 智力系：技能伤害+50%, CD-1, 普攻附带 int×0.3 真实伤害（补偿普攻弱势） */
const HERO_TYPE = {
  STRENGTH: 'strength',    // 力量系：HP+25%, def+15%, 反击+20%
  AGILITY: 'agility',      // 敏捷系：atk+20%, 移速+1, 闪避+10%
  INTELLECT: 'intellect'   // 智力系：技能+50%, CD-1, 普攻附带int×0.3真伤
};

/* 英雄类型加成系数（engine.js getCharBonus 读取）
   v27 字段说明：
     - hpMul:        棋子 maxHp 乘数（在 createPiece 时应用）
     - defMul:       角色 def 加成乘数（注入 charDef）
     - atkMul:       角色 atk 加成乘数（注入 charAtk）
     - skillDmgMul:  技能伤害乘数（applyIntToSkillDamage 应用）
     - cdReduce:     技能 CD 减少回合数
     - extraMoveRange: 敏捷系额外移动力（马/兵特殊规则用）
     - dodgeChance:  敏捷系被动闪避概率（calcDamage 中预检）
     - counterMul:   力量系反击伤害乘数（calcDamage 中应用）
     - atkTrueDmgMul: 智力系普攻真实伤害系数（int × atkTrueDmgMul）
*/
const HERO_TYPE_BONUS = {
  strength: { hpMul: 1.25, defMul: 1.15, atkMul: 1.0, skillDmgMul: 1.0, cdReduce: 0, counterMul: 1.2 },
  agility:  { hpMul: 1.0,  defMul: 1.0,  atkMul: 1.2, skillDmgMul: 1.0, cdReduce: 0, extraMoveRange: 1, dodgeChance: 0.10 },
  intellect:{ hpMul: 1.0,  defMul: 1.0,  atkMul: 1.0, skillDmgMul: 1.5, cdReduce: 1, atkTrueDmgMul: 0.3 }
};

/* 棋子战斗属性（策略游戏化：HP / 攻击 / 防御 / 兵种类型）
   v12: HP 再次降低约 40%，加速游戏节奏（避免一局过长）
   atk/def 保持不变；角色属性加成（charAtk/charDef/charInt）由 engine.js 注入
   v28-piece-diversity: 7 兵种极大差异化（参考 Dota2/LoL/火焰纹章）
   - 士/相不再同质化：士=贴身护卫(高def反击型)，相=远程支援(反制概率型)
   - 帅强化为指挥核心（HP/atk/def 全面提升）
   - 兵定位为特殊战士（高HP持久战）
   v29-cavalry-buff: 马 HP 100→110（小幅增强生存，配合骑兵闪避25%）
   v30-rebalance: 炮车削弱、马增强、兵微调
   - 车: HP 120→110, atk 90→80（降低玻璃大炮的爆发）
   - 炮: atk 80→72（降低远程压制力，给马生存空间）
   - 马: HP 110→120, atk 60→72（大幅增强，与炮车抗衡）
   - 兵: atk 50→55（微增，强化特殊战士定位） */
const PIECE_STATS = {
  k: { hp: 260,  atk: 50,  def: 55, type: 'core' },      // 帅 — 指挥核心
  r: { hp: 110,  atk: 80,  def: 10, type: 'striker' },   // 车 — 玻璃大炮（v36: def 0→10，避免1击残血）
  h: { hp: 120,  atk: 72,  def: 20, type: 'striker' },   // 马 — 刺客
  c: { hp: 80,   atk: 65,  def: 12, type: 'remote' },    // 炮 — 远程（v36: atk 72→65，解决开局打马过强）
  a: { hp: 100,  atk: 30,  def: 75, type: 'defender' },  // 士 — 贴身护卫
  e: { hp: 100,  atk: 35,  def: 65, type: 'defender' },  // 相 — 远程支援
  p: { hp: 110,  atk: 55,  def: 15, type: 'special' }    // 兵 — 特殊战士（v36: HP 140→110，避免过肉）
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

/* v31: 天气系统 — 4 种全局天气，每种持续 3~5 回合，对全局产生不同影响 */
const WEATHER_TYPES = {
  sunny: {
    id: 'sunny', name: '晴', icon: '☀',
    desc: '阳光普照，所有棋子攻击+5%',
    effect: { atkMul: 1.05, defMul: 1.0, rangedMul: 1.0, dodgeAdj: 0 }
  },
  rain: {
    id: 'rain', name: '雨', icon: '☂',
    desc: '雨幕遮蔽，炮(远程)伤害-20%，敏捷系闪避+5%',
    effect: { atkMul: 1.0, defMul: 1.0, rangedMul: 0.8, dodgeAdj: 0.05 }
  },
  fog: {
    id: 'fog', name: '雾', icon: '☁',
    desc: '雾气弥漫，相/象(防守)防御+30%，所有人命中率-10%',
    effect: { atkMul: 1.0, defMul: 1.0, defenderDefMul: 1.3, hitChance: 0.9 }
  },
  wind: {
    id: 'wind', name: '风', icon: '✦',
    desc: '风起云涌，车/马(进攻)攻击+10%',
    effect: { atkMul: 1.0, strikerAtkMul: 1.1 }
  }
};
const WEATHER_KEYS = ['sunny','rain','fog','wind'];
const WEATHER_DURATION_MIN = 3;
const WEATHER_DURATION_MAX = 5;

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

/* ===== 角色注册表（动态数量，禁止硬编码具体数字） ===== */
const CHARACTERS = {
  houzhibo: {
    name:'侯智博', char:'侯', title:'智计百出', color:'#b8302a', glow:'rgba(184,48,42,0.5)',
    desc:'善以奇兵破阵，攻势如潮，谋略无双',
    stats:{ atk:90, def:70, int:80 },
    heroType:HERO_TYPE.AGILITY,
    faction:'strategist',
    skill:{ id:'rewind', name:'偷天换日', desc:'撤销B王最近一步棋，迫其重走，并获得一额外回合 [单体]', cd:2, target:'single' },
    skillLines:['偷天换日！这步不算！','且慢，让本座重来','棋局未定，何谈胜负','乾坤颠倒，日月重光'],
    loseLines:['智者千虑必有一失...','此局算计不如B王','罢了，下次再战','谋事在人，成事在天'],
    speech:['智计百出？在B王面前不过是小聪明','这点手段也敢班门弄斧？','让本王看看你还有什么花招','你的计谋本王早已看穿'],
    actives:[
      { id:'rewind', name:'偷天换日', desc:'撤销B王最近一步棋，迫其重走，并获得一额外回合 [单体]', cd:2, target:'single' },
      { id:'flank', name:'暗度陈仓', desc:'沉默B王2回合无法使用技能，且对方全体棋子下回合攻击-20% [单体]', cd:2, target:'single' },
      { id:'ambush', name:'奇兵破阵', desc:'全场禁锢B王棋子1回合，己方连走两步 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_strategy', name:'奇兵突袭', trigger:PASSIVE_TRIGGER.AURA, desc:'每回合开始25%概率：己方攻击最高的非帅棋子获得攻击+30%（1回合），目标棋盘高亮提示' },
      { id:'p_chain', name:'连环计', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'吃子后下回合可连走两步' }
    ]
  },
  wangxin: {
    name:'王昕', char:'王', title:'幽默风趣', color:'#2d5a3d', glow:'rgba(45,90,61,0.5)',
    desc:'任课老师，妙语连珠，笑声中暗藏杀机',
    stats:{ atk:85, def:78, int:88 },
    heroType:HERO_TYPE.INTELLECT,
    faction:'strategist',
    skill:{ id:'rollcall', name:'课堂点名', desc:'点名B王回答问题：B王棋子下回合无法吃子（被点名压制），且B王的车、马棋子攻击-15%（1回合） [单体]', cd:2, target:'single' },
    skillLines:['来，B王同学，你来回答一下这步棋怎么走','谁在下棋时走神了？B王你来说说','这个棋局啊，就好比一道送分题','B王同学，你的棋艺还需要加强啊'],
    loseLines:['哈哈哈，输了输了，下课！','这局就当给大家当反面教材了','B王同学棋艺不错，下次老师请教你'],
    speech:['王老师？在本王面前你也敢摆老师的架子？','课堂点名？本王从来不上课','幽默风趣？你的幽默本王不觉得好笑'],
    actives:[
      { id:'rollcall', name:'课堂点名', desc:'点名B王回答问题：B王棋子下回合无法吃子（被点名压制），且B王的车、马棋子攻击-15%（1回合） [单体]', cd:2, target:'single' },
      { id:'mock', name:'妙语嘲讽', desc:'减速B王：下回合对方全体棋子移动距离≤1，且攻击-15% [单体]', cd:2, target:'single' },
      { id:'quiz', name:'考试突击', desc:'己方全体棋子获得护盾吸收100伤害，且己方下回合连走两步 [全范围]', cd:3, target:'aoe' }
    ],
    passives:[
      { id:'p_teach', name:'因材施教', trigger:PASSIVE_TRIGGER.AURA, desc:'仕、相防御+15点（2回合）' },
      { id:'p_joke', name:'妙语连珠', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每3回合嘲讽一次，对方全体棋子下回合攻击-20%' }
    ]
  },
  zhouzihan: {
    name:'周子翰', char:'周', title:'风度翩翩', color:'#3a6b8a', glow:'rgba(58,107,138,0.5)',
    desc:'棋风优雅，布局控场，江山易主',
    stats:{ atk:88, def:80, int:75 },
    heroType:HERO_TYPE.STRENGTH,
    faction:'strategist',
    skill:{ id:'teleport', name:'江山易主', desc:'将一颗己方棋子传送到任意空位，重新布局（不能吃子） [单体]', cd:2, target:'single' },
    skillLines:['江山易主，乾坤挪移！','运筹帷幄，一子定乾坤','本座布局，由我主宰'],
    loseLines:['风度...终究敌不过实力','布局再妙也有破绽'],
    speech:['风度翩翩？不过是虚有其表','你的江山能撑多久？','优雅的棋风？破绽百出'],
    actives:[
      { id:'teleport', name:'江山易主', desc:'将一颗己方棋子传送到任意空位，重新布局（不能吃子） [单体]', cd:2, target:'single' },
      { id:'elegant', name:'优雅闪烁', desc:'己方一颗棋子瞬移到指定位置，且该子下回合攻击+30%并获得50点护盾 [单体]', cd:2, target:'single' },
      { id:'grandshift', name:'乾坤大挪移', desc:'互换双方各一颗棋子位置，且己方下回合连走两步 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_plan', name:'布局精算', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'己方棋子被吃时，己方所有棋子获得36点护盾（2回合）' },
      { id:'p_elegant', name:'风度翩翩', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'被吃时30%闪避，棋子保留' }
    ]
  },
  sanjin: {
    name:'三金', char:'金', title:'狂战之怒', color:'#c47544', glow:'rgba(196,117,68,0.6)',
    desc:'兄弟义气，以攻代守，极具进攻性——三金的字典里没有"退让"',
    stats:{ atk:92, def:82, int:75 },
    heroType:HERO_TYPE.STRENGTH,
    faction:'brother',
    skill:{ id:'ironwall', name:'狂战之怒', desc:'选己方一颗车或马激发狂战：该棋子3回合内攻击+60%，可连走三步，且吃子后复活最近被吃的己方棋子 [单体]', cd:3, target:'single' },
    skillLines:['狂战之怒！攻！攻！攻！','兄弟我从不退让！','以攻代守，一击毙命！','你以为能挡住我？做梦！','三金的字典里没有退让！'],
    loseLines:['兄弟...这次攻不动了...','狂战...也有力竭之时','罢了，下次再战'],
    speech:['铜墙铁壁？本王偏要破你的防','让你进攻？本王直接破防','兄弟义气？在本王面前不值一提'],
    actives:[
      { id:'ironwall', name:'狂战之怒', desc:'选己方一颗车或马激发狂战：该棋子3回合内攻击+60%，可连走三步，且吃子后复活最近被吃的己方棋子 [单体]', cd:3, target:'single' },
      { id:'execute', name:'嗜血斩杀', desc:'选己方一颗棋子激发杀意，该棋子下次攻击+50%伤害 [单体]', cd:2, target:'single' },
      { id:'barrage', name:'兄弟连斩', desc:'本回合内所有己方棋子攻击+40%，且吃子后可再走一步 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_brother', name:'兄弟义气', trigger:PASSIVE_TRIGGER.AURA, desc:'己方棋子数<8时，全体棋子攻击+30点（2回合）' },
      { id:'p_attack', name:'以攻代守', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'吃子时立刻复活最近被吃的己方棋子' }
    ]
  },
  jige: {
    name:'鸡哥', char:'鸡', title:'完美伪装', color:'#6b4c8a', glow:'rgba(107,76,138,0.5)',
    desc:'舞步迷惑，完美伪装，虚实难辨',
    stats:{ atk:88, def:72, int:78 },
    heroType:HERO_TYPE.AGILITY,
    faction:'bking',
    skill:{ id:'disguise', name:'完美伪装', desc:'互换两颗己方棋子位置，B王棋子下次攻击打偏，且真身反击吃掉攻击者 [单体]', cd:3, target:'single' },
    skillLines:['完美伪装！你打不中我！','鸡你太美！看你怎么选！','伪装启动，虚实难辨！','这舞步，你看得懂吗？'],
    loseLines:['伪装被看穿了...','舞步乱了...','鸡哥这次伪装失败了...'],
    speech:['完美伪装？本王一眼看穿','你的舞步？不过是瞎蹦跶','鸡哥？让你变成烤鸡'],
    actives:[
      { id:'disguise', name:'完美伪装', desc:'互换两颗己方棋子位置，B王棋子下次攻击打偏，且真身反击吃掉攻击者 [单体]', cd:3, target:'single' },
      { id:'illusion', name:'分身幻象', desc:'召唤一个 150 HP 的兵卒为你作战，持续到被吃或对局结束 [单体]', cd:2, target:'single' },
      { id:'feint', name:'虚晃一枪', desc:'全场迷惑：对方车、马、炮下回合攻击打偏 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_dodge', name:'虚实难辨', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'被吃时30%打偏，攻击失败' },
      { id:'p_clone', name:'影分身', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每5回合召唤1颗己方兵到空位' }
    ]
  },
  ikun: {
    name:'ikun', char:'K', title:'唱跳rap', color:'#b8945a', glow:'rgba(184,148,90,0.5)',
    desc:'两年半练习生，灵动多变，节奏掌控',
    stats:{ atk:86, def:72, int:78 },
    heroType:HERO_TYPE.AGILITY,
    faction:'bking',
    skill:{ id:'weaken', name:'唱跳篮球', desc:'B王三回合内思考深度降至最低，且每回合30%概率走"艺术走法" [单体]', cd:2, target:'single' },
    skillLines:['唱跳rap篮球！全给你！','两年半不是白练的','我的节奏你跟不上','鸡你太美~跟上我的节奏！'],
    loseLines:['练习...还不够','节奏被打乱了'],
    speech:['唱跳rap篮球？先过我这关','两年半练习？本王修炼千年','你的rap只是噪音'],
    actives:[
      { id:'weaken', name:'唱跳篮球', desc:'B王三回合内思考深度降至最低，且每回合30%概率走"艺术走法" [单体]', cd:2, target:'single' },
      { id:'rhythm', name:'节奏掌控', desc:'减速B王：对方全体棋子下回合无法移动远距离，沉默1回合，且对方全体棋子攻击-20%（1回合） [单体]', cd:2, target:'single' },
      { id:'allyours', name:'全给你', desc:'3回合内反弹B王棋子50%伤害，且己方下回合连走两步 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_rhythm', name:'律动本能', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每4回合加速，下回合连走两步' },
      { id:'p_rebound', name:'反震本能', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'被吃时反弹30%伤害，对方全体棋子下回合攻-20%' }
    ]
  },
  huhao: {
    name:'胡浩', char:'胡', title:'浩然正气', color:'#4a7c59', glow:'rgba(74,124,89,0.5)',
    desc:'堂堂正正，以正道碾压，正气凛然',
    stats:{ atk:90, def:85, int:75 },
    heroType:HERO_TYPE.STRENGTH,
    faction:'brother',
    skill:{ id:'revive', name:'浩然正气', desc:'复活最近两颗被吃的己方棋子，并获得额外一回合 [单体]', cd:3, target:'single' },
    skillLines:['浩然正气！起死回生','正道不灭，棋魂不散','以正克邪，万法归一'],
    loseLines:['正气...终究败给了权谋','堂堂正正也赢不了B王'],
    speech:['浩然正气？棋盘之上无正气','堂堂正正？本王偏要阴你','正道之力？不堪一击'],
    actives:[
      { id:'revive', name:'浩然正气', desc:'复活最近两颗被吃的己方棋子，并获得额外一回合 [单体]', cd:3, target:'single' },
      { id:'shield', name:'正道护体', desc:'己方一颗帅或将获得护盾，吸收下次伤害，且该棋子防御+30% [单体]', cd:2, target:'single' },
      { id:'unity', name:'万法归一', desc:'复活所有被吃己方棋子（最多3颗），且己方全体棋子攻击+20% [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_shield', name:'金刚护体', trigger:PASSIVE_TRIGGER.IMMUNE, desc:'免疫一次吃子（每局1次）' },
      { id:'p_unity', name:'万法归宗', trigger:PASSIVE_TRIGGER.AURA, desc:'己方将每回合获得80点护盾（2回合）' }
    ]
  },
  xieyuxuan: {
    name:'解宇轩', char:'解', title:'逻辑大师', color:'#8a4c6b', glow:'rgba(138,76,107,0.5)',
    desc:'逻辑推理天下无双，因果律锁',
    stats:{ atk:92, def:75, int:95 },
    heroType:HERO_TYPE.INTELLECT,
    faction:'immortal',
    skill:{ id:'lockdown', name:'因果律锁', desc:'锁定对方一颗棋子4回合无法移动，且锁定期间该子可被己方吃掉 [单体]', cd:2, target:'single' },
    skillLines:['因果律锁！这颗子已无路可走','逻辑闭环，禁锢生效','变量已归零，因果已定'],
    loseLines:['逻辑...也有推理失败的时候','前提错了，结论自然错'],
    speech:['逻辑大师？本王不讲逻辑','你的推理？前提就是错的','因果必然？本王就是那个意外'],
    actives:[
      { id:'lockdown', name:'因果律锁', desc:'锁定对方一颗棋子4回合无法移动，且锁定期间该子可被己方吃掉 [单体]', cd:2, target:'single' },
      { id:'logic_silence', name:'逻辑沉默', desc:'沉默B王3回合无法使用技能，且B王的车、马棋子下回合无法吃子 [单体]', cd:2, target:'single' },
      { id:'logicblast', name:'逻辑爆破', desc:'全场禁锢B王的车、马棋子1回合，且B王下回合无法使用技能 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_logic', name:'逻辑压制', trigger:PASSIVE_TRIGGER.AURA, desc:'每回合开始：对方攻防最高的棋子被「虚弱」（攻击-25%，1回合）' },
      { id:'p_deduce', name:'演绎推理', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'吃子后展示对方下2步走法' }
    ]
  },
  luxingchen: {
    name:'陆星辰', char:'陆', title:'代码大师', color:'#4c6b8a', glow:'rgba(76,107,138,0.5)',
    desc:'以代码重构棋盘，异常捕获',
    stats:{ atk:90, def:75, int:80 },
    heroType:HERO_TYPE.AGILITY,
    faction:'strategist',
    skill:{ id:'catch', name:'异常捕获', desc:'对方全体棋子下回合无法吃子（被catch），且己方下回合连走两步 [单体]', cd:2, target:'single' },
    skillLines:['异常捕获！已try-catch！','找到Bug了！你的攻击无效！','catch成功，下回合双倍执行！'],
    loseLines:['遇到无法Debug的异常...','这段代码没法修了'],
    speech:['代码大师？看看你的代码量','debug？本王就是那个Bug','重构棋盘？你重构不了本王'],
    actives:[
      { id:'catch', name:'异常捕获', desc:'对方全体棋子下回合无法吃子（被catch），且己方下回合连走两步 [单体]', cd:2, target:'single' },
      { id:'debug', name:'代码扫描', desc:'选己方一颗棋子扫描弱点，该棋子下次攻击+50%伤害 [单体]', cd:2, target:'single' },
      { id:'crash', name:'系统崩溃', desc:'B王的车、马、炮棋子沉默2回合，且B王下回合无法移动 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_debug', name:'除错本能', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每5回合清除对方1个增益效果' },
      { id:'p_refactor', name:'重构', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'己方子被吃时20%概率复活' }
    ]
  },
  tangboyuhan: {
    name:'唐昊博涵', char:'唐', title:'全班第一', color:'#8a6b3a', glow:'rgba(138,107,58,0.5)',
    desc:'成绩碾压全场，标准答案在手',
    stats:{ atk:88, def:75, int:92 },
    heroType:HERO_TYPE.INTELLECT,
    faction:'strategist',
    skill:{ id:'control', name:'标准答案', desc:'操控对方走一步对你有利的棋（不能吃你的子） [单体]', cd:2, target:'single' },
    skillLines:['标准答案！这步我来替你走！','全班第一，你的走法我说了算','答案已定，你无权更改'],
    loseLines:['这题超纲了...','考试范围之外的知识...'],
    speech:['全班第一？本王全校第一','翻书作弊？本王就是教科书','标准答案？本王就是答案'],
    actives:[
      { id:'control', name:'标准答案', desc:'操控对方走一步对你有利的棋（不能吃你的子） [单体]', cd:2, target:'single' },
      { id:'cheat', name:'翻书作弊', desc:'己方所有棋子获得护盾（吸收80点伤害，3回合）+攻击+20%（2回合），且己方仕、相防御+20（3回合） [全范围]', cd:2, target:'aoe' },
      { id:'exam', name:'考试突击', desc:'操控B王下2步走法，且对方全体棋子下回合无法吃子 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_knowledge', name:'题海战术', trigger:PASSIVE_TRIGGER.AURA, desc:'每回合开始：己方血量最低的棋子回复30HP' },
      { id:'p_fullmark', name:'满分', trigger:PASSIVE_TRIGGER.AURA, desc:'己方炮、马攻击+15点' }
    ]
  },
  alice: {
    name:'仙帝Alice', char:'仙', title:'仙帝重生', color:'#9b59b6', glow:'rgba(155,89,182,0.75)',
    desc:'仙帝转世重修，一念定乾坤。独门仙法「天罚」极具进攻性——剥夺B王最强子，命定3步，下回合双杀',
    stats:{ atk:90, def:88, int:95 },
    heroType:HERO_TYPE.INTELLECT,
    faction:'immortal',
    skill:{ id:'awe', name:'仙帝·天罚', desc:'独门仙法：B王被迫献出最强一子（非将）；命定B王接下来3步路线；下回合仙帝连走两步；剥夺B王被动2回合 [单体]', cd:5, target:'single' },
    skillLines:['仙帝·天罚！尔等棋路，皆在本座掌中！','本座一念，尔等皆跪！','凡俗蝼蚁，敢挡仙帝之威？','你的走法，由本座书写！','天罚已降，无可更改！'],
    loseLines:['仙帝...也有陨落之时...','威压...被打破了...','不可能！本仙帝怎么会输！'],
    speech:['仙帝重生？在本王面前不过是重修的小仙','命定因果？本王的棋路岂容你书写','仙帝？本王让你重新修炼'],
    actives:[
      { id:'awe', name:'仙帝·天罚', desc:'独门仙法：B王被迫献出最强一子（非将）；命定B王接下来3步路线；下回合仙帝连走两步；剥夺B王被动2回合 [单体]', cd:5, target:'single' },
      { id:'descent', name:'仙帝降临', desc:'禁锢对方一颗棋子2回合无法行动，且该子可被己方吃掉 [单体]', cd:4, target:'single' },
      { id:'judgment', name:'仙帝审判', desc:'全场审判：B王所有棋子受到真实伤害（无视防御），且B王被动失效2回合 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_pressure', name:'仙帝威压', trigger:PASSIVE_TRIGGER.AURA, desc:'B王技能CD+1回合，技能释放概率-15%' },
      { id:'p_samsara', name:'天道轮回', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每3回合复活1颗己方被吃棋子' }
    ]
  },
  liuqi: {
    name:'大汉棋圣', char:'汉', title:'掀桌之圣', color:'#8b4513', glow:'rgba(139,69,19,0.6)',
    desc:'刘启化身，棋风豪迈不羁，一言不合掀桌重来',
    stats:{ atk:92, def:82, int:75 },
    heroType:HERO_TYPE.STRENGTH,
    faction:'hermit',
    skill:{ id:'flip', name:'掀桌不玩了', desc:'掀翻棋桌！回溯3步棋局，双方各回原位，本方保留先手 [单体]', cd:5, target:'single' },
    skillLines:['掀桌！老子不玩了！','这盘不算！重来！','大汉棋圣，掀桌无敌！','不爽就掀，这才是豪迈！'],
    loseLines:['掀桌也救不了我...','这桌掀得...把自己掀翻了'],
    speech:['掀桌？在本王面前你掀不起风浪','大汉棋圣？不过是个莽夫','掀桌子？本王让你连桌子都看不到'],
    actives:[
      { id:'flip', name:'掀桌不玩了', desc:'掀翻棋桌！回溯3步棋局，双方各回原位，本方保留先手 [单体]', cd:5, target:'single' },
      { id:'charge', name:'豪迈冲撞', desc:'对方全体棋子下回合移动距离≤1，且攻击-15% [全范围]', cd:3, target:'aoe' },
      { id:'saint', name:'棋圣降临', desc:'回溯5步棋局，且对方全体棋子下回合无法吃子，本方获得额外回合 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_bold', name:'豪迈', trigger:PASSIVE_TRIGGER.IMMUNE, desc:'免疫沉默、禁锢类技能' },
      { id:'p_flipgod', name:'掀桌之神', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'上回合若吃子，本回合主动技能CD-1' }
    ]
  },
  liuxuepei: {
    name:'刘雪沛', char:'雪', title:'B王克星', color:'#5b8def', glow:'rgba(91,141,239,0.65)',
    desc:'冰雪聪慧，洞察一切虚伪，专破显摆之术',
    stats:{ atk:88, def:82, int:95 },
    heroType:HERO_TYPE.INTELLECT,
    faction:'immortal',
    skill:{ id:'silence', name:'破妄之眼', desc:'沉默B王4回合无法使用技能，且每回合30%走错；对B王棋子造成的伤害+50% [单体]', cd:3, target:'single' },
    skillLines:['破妄之眼！你的显摆到此为止！','沉默！在我面前你装不起来','我看穿了你一切手段','B王？在我面前只是个笑话'],
    loseLines:['克星...也有失手的时候','B王的显摆超出了我的计算'],
    speech:['B王克星？在本王面前不过是虚名','破妄之眼？本王让你破不了','看穿本王？你太天真了'],
    actives:[
      { id:'silence', name:'破妄之眼', desc:'沉默B王4回合无法使用技能，且每回合30%走错；对B王棋子造成的伤害+50% [单体]', cd:3, target:'single' },
      { id:'mark', name:'洞察标记', desc:'标记对方一颗棋子，下次攻击必中且+50%伤害 [单体]', cd:2, target:'single' },
      { id:'nemesis', name:'克星之刃', desc:'全场沉默B王2回合，且对方全体棋子防御-30% [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_insight', name:'破妄气场', trigger:PASSIVE_TRIGGER.AURA, desc:'B王所有棋子攻击-15%（光环，持续全场）' },
      { id:'p_nemesis', name:'克星', trigger:PASSIVE_TRIGGER.AURA, desc:'对B王棋子造成的伤害+50%（吃B王棋子时额外吃1子）' }
    ]
  },
  bking: {
    /* v39: 玩家版 B王 削弱至 S 级（92/82/92 → 90/80/85），与电脑版不同级；
       内测版（INTERNAL_BUILD=true）显示名「薛贺洲」并启用露骨风格分支 */
    name: (typeof INTERNAL_BUILD!=='undefined' && INTERNAL_BUILD) ? '薛贺洲' : 'B王',
    char:'B', title:'七宗罪化身', color:'#2a2520', glow:'rgba(42,37,32,0.6)',
    desc:'集齐典型反面特质：七宗罪化身——傲慢、嫉妒、暴怒、懒惰、贪婪、暴食、色欲。班里的"自封王者"，爱装腔作势、自以为是。嘴硬心软，输了也要嘴上赢一回',
    stats:{ atk:90, def:80, int:85 },
    heroType:HERO_TYPE.INTELLECT,
    faction:'bking',
    /* v30: B王技能重设计 — 七宗罪体系（7个主动技能）
       玩家可选版（PVP）：选将时从7个主动中选3个，从5个被动中选2个
       AI版（故事模式/PVE）：根据难度，技能数量递增（非3选1）
         - 青铜装（简单）：1主动+1被动
         - 钻石装（中等）：3主动+3被动
         - 王者装（困难）：5主动+5被动（全部被动可用）
         - 三英战B王：7主动全开+5被动全开+额外强化
       技能描述原则：针对棋子而非角色
         - "B王下次攻击+30%" → 错误（B王是角色不是棋子）
         - "B王的一颗棋子下次攻击+30%" → 正确
         - "对方全体棋子攻击-25%" → 正确
       七宗罪对应技能：
       - 傲慢(arrogance): 气场压制对方全体棋子攻击
       - 嫉妒(envy): 复制对方一个被动技能
       - 暴怒(wrath): 己方全体棋子进入狂暴
       - 懒惰(sloth): 让对方全体棋子无法移动远距离
       - 贪婪(greedy): 窃取对方棋子buff
       - 暴食(gluttony): 吞噬己方一颗棋子获得其属性
       - 色欲(lust): 诱惑对方一颗棋子倒戈 */
    skill:{ id:'arrogance', name:'傲慢·目中无人', desc:'B王气场压制：对方全体棋子下回合攻击-25%，且B王攻击最高的棋子下次攻击+30% [全范围]', cd:3, target:'all' },
    skills:[
      { id:'arrogance', name:'傲慢·目中无人', desc:'B王气场压制：对方全体棋子下回合攻击-25%，且B王攻击最高的棋子下次攻击+30% [全范围]', cd:3, target:'all' },
      { id:'envy', name:'嫉妒·东施效颦', desc:'复制对方被动技能给己方全体棋子（持续3回合），让对方失去该被动 [全范围]', cd:4, target:'all' },
      { id:'wrath', name:'暴怒·怒火中烧', desc:'B王全体棋子进入狂暴：3回合内攻击+50%但防御-30%，且每次攻击附带20真实伤害 [全范围]', cd:4, target:'all' },
      { id:'sloth', name:'懒惰·拖泥带水', desc:'对方全体棋子2回合内移动距离≤1格，且攻击-20% [全范围]', cd:3, target:'all' },
      { id:'greedy', name:'贪婪·夺人所爱', desc:'窃取对方一颗棋子的永久buff给己方对应棋子，且B王的帅回复30%最大HP [单体]', cd:3, target:'single' },
      { id:'gluttony', name:'暴食·吞噬同袍', desc:'吞噬己方一颗非王棋子，B王的帅获得其50%HP和攻击（永久），且下次攻击+40% [单体]', cd:5, target:'single' },
      { id:'lust', name:'色欲·魅惑人心', desc:'诱惑对方一颗非王棋子倒戈1回合（该子下回合归B王控制），且该子攻击-30% [单体]', cd:5, target:'single' }
    ],
    actives:[
      { id:'arrogance', name:'傲慢·目中无人', desc:'B王气场压制：对方全体棋子下回合攻击-25%，且B王攻击最高的棋子下次攻击+30% [全范围]', cd:3, target:'all' },
      { id:'envy', name:'嫉妒·东施效颦', desc:'复制对方被动技能给己方全体棋子（持续3回合），让对方失去该被动 [全范围]', cd:4, target:'all' },
      { id:'wrath', name:'暴怒·怒火中烧', desc:'B王全体棋子进入狂暴：3回合内攻击+50%但防御-30%，且每次攻击附带20真实伤害 [全范围]', cd:4, target:'all' },
      { id:'sloth', name:'懒惰·拖泥带水', desc:'对方全体棋子2回合内移动距离≤1格，且攻击-20% [全范围]', cd:3, target:'all' },
      { id:'greedy', name:'贪婪·夺人所爱', desc:'窃取对方一颗棋子的永久buff给己方对应棋子，且B王的帅回复30%最大HP [单体]', cd:3, target:'single' },
      { id:'gluttony', name:'暴食·吞噬同袍', desc:'吞噬己方一颗非王棋子，B王的帅获得其50%HP和攻击（永久），且下次攻击+40% [单体]', cd:5, target:'single' },
      { id:'lust', name:'色欲·魅惑人心', desc:'诱惑对方一颗非王棋子倒戈1回合（该子下回合归B王控制），且该子攻击-30% [单体]', cd:5, target:'single' }
    ],
    skillLines:[
      '傲慢！本王就是天！你们这些棋手不够本王看！','目中无人？本王眼中只有胜利！',
      '嫉妒？本王只是借来用用！','你的本事？现在是我的了！',
      '暴怒！本王要毁了一切！','怒火中烧，你承受不住！','让本王撕碎你的防线！',
      '懒惰？这叫以逸待劳！','急什么？慢慢来，本王等得起！',
      '贪婪！这子归本王了！','你的buff？现在是我的了！',
      '暴食！吞噬一切！','你的力量，本王收下了！','吃饱了才有力气显摆！',
      '色欲！让本王看看你的忠心！','倒戈吧！跟着本王才有前途！','魅惑人心，本王最在行！'
    ],
    loseLines:['不可能...这绝不可能！本王怎么会输！','本王...居然输给了凡人？','一定是系统bug！本王要求重赛！','七宗罪都败了？这世界疯了！'],
    speech:['B王？你也配叫B王？','显摆？在本王面前你只是个新手','你以为你能看穿本王？天真！'],
    passives:[
      { id:'p_aura', name:'傲慢光环', trigger:PASSIVE_TRIGGER.AURA, desc:'光环：对方全体棋子攻击-10%，持续全场（傲慢本色）' },
      { id:'p_shameless', name:'厚颜无耻', trigger:PASSIVE_TRIGGER.IMMUNE, desc:'免疫：每局2次免疫沉默+免疫禁锢（无赖本色）' },
      { id:'p_greedy', name:'贪婪本性', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'己方棋子吃子时，B王攻击最高的棋子下次攻击+15%（可叠加2层）' },
      { id:'p_stupid_luck', name:'愚蠢运气', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'B王棋子被吃时25%概率反吃对方（愚蠢本色，运气好）' },
      { id:'p_bking_insight', name:'自视清高', trigger:PASSIVE_TRIGGER.TURN_START, desc:'每回合开始时，B王全体棋子攻击+5%（永久，递增）' }
    ]
  },
  /* ===== 新增 4 角色 ===== */
  liujiawei: {
    name:'刘佳伟', char:'佳', title:'稳健派', color:'#5a7c4a', glow:'rgba(90,124,74,0.5)',
    desc:'稳如泰山，以退为进，后发制人',
    stats:{ atk:88, def:85, int:78 },
    heroType:HERO_TYPE.STRENGTH,
    faction:'brother',
    skill:{ id:'retreat', name:'以退为进', desc:'撤销己方最近1步，对方棋子下回合无法吃子（被己方退步迷惑） [单体]', cd:2, target:'single' },
    skillLines:['以退为进！看你怎么应对！','退一步，海阔天空','稳如泰山，后发制人'],
    loseLines:['稳健...也有失守的时候','退得太多，退无可退'],
    speech:['稳健派？在本王面前你稳不住','以退为进？退着退着就没了','泰山？本王让你变成泥石流'],
    actives:[
      { id:'retreat', name:'以退为进', desc:'撤销己方最近1步，对方车、马下回合无法吃子（被己方退步迷惑） [单体]', cd:2, target:'single' },
      { id:'steadfast', name:'稳如泰山', desc:'己方一颗帅或将获得护盾，吸收下次伤害，且该棋子防御+25% [单体]', cd:2, target:'single' },
      { id:'counter', name:'后发制人', desc:'3回合内反弹B王棋子50%伤害，且对方全体棋子每回合攻击-15%（可叠加） [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_stable', name:'不动如山', trigger:PASSIVE_TRIGGER.AURA, desc:'己方帅防御+20点' },
      { id:'p_revenge', name:'退步反击', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'被吃时反吃对方1颗价值相当的子，且对方下回合全体棋子攻击-15%' }
    ]
  },
  yuanqingshan: {
    name:'袁清山', char:'清', title:'隐士', color:'#4a6b5a', glow:'rgba(74,107,90,0.5)',
    desc:'隐居山林，潜龙勿用，厚积薄发',
    stats:{ atk:88, def:75, int:78 },
    heroType:HERO_TYPE.AGILITY,
    faction:'hermit',
    skill:{ id:'hidden', name:'潜龙勿用', desc:'隐藏己方价值最高的棋子3回合（B王无法看到/锁定/吃它） [单体]', cd:3, target:'single' },
    skillLines:['潜龙勿用！你找不到我！','隐士之术，深藏不露','龙跃之时，一鸣惊人'],
    loseLines:['隐忍...终究有限','潜龙...还没跃就结束了'],
    speech:['隐士？在本王面前你藏不住','潜龙勿用？本王直接把你挖出来','隐居？本王让你无处可藏'],
    actives:[
      { id:'hidden', name:'潜龙勿用', desc:'隐藏己方价值最高的棋子3回合（B王无法看到/锁定/吃它） [单体]', cd:3, target:'single' },
      { id:'blink', name:'隐遁闪烁', desc:'己方一颗车或马瞬移到指定空位，且该子下回合无法被锁定 [单体]', cd:2, target:'single' },
      { id:'leap', name:'龙跃九天', desc:'己方全体棋子攻击+40%(2回合)，且B王棋子下回合无法吃子，己方帅获得50点护盾 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_hide', name:'隐忍', trigger:PASSIVE_TRIGGER.AURA, desc:'首回合免疫所有技能' },
      { id:'p_leap', name:'龙跃', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'3回合后下次攻击+40%' }
    ]
  },
  luolunjie: {
    name:'罗伦杰', char:'罗', title:'连击大师', color:'#a04030', glow:'rgba(160,64,48,0.6)',
    desc:'连环斩击，以攻代守，连击破甲',
    stats:{ atk:90, def:70, int:78 },
    heroType:HERO_TYPE.AGILITY,
    faction:'brother',
    skill:{ id:'combo', name:'连环斩', desc:'本回合己方车或马吃1子后，立刻再吃1子（连环斩击），且破防无视防御；该棋子连击成功后攻击+20%（1回合） [单体]', cd:2, target:'single' },
    skillLines:['连环斩！一刀接一刀！','连击！破甲！再斩！','你以为只吃一子？天真！','斩铁断金，连击不停！'],
    loseLines:['连击...被打断了','斩不动了...'],
    speech:['连击大师？本王让你连不起来','连环斩？本王直接断你连','破甲？本王的甲你破不了'],
    actives:[
      { id:'combo', name:'连环斩', desc:'本回合己方车或马吃1子后，立刻再吃1子（连环斩击），且破防无视防御；该棋子连击成功后攻击+20%（1回合） [单体]', cd:2, target:'single' },
      { id:'pierce', name:'破甲突袭', desc:'标记对方一颗棋子，下次攻击必中且无视防御 [单体]', cd:2, target:'single' },
      { id:'storm', name:'无尽连斩', desc:'本回合己方每吃1子可再走一步（最多3步），且己方棋子攻击+40%（2回合） [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_chainatk', name:'连击', trigger:PASSIVE_TRIGGER.ON_CAPTURE, desc:'吃子后下回合攻击+30%（可叠加2层）' },
      { id:'p_break', name:'斩铁', trigger:PASSIVE_TRIGGER.AURA, desc:'攻击无视对方防御增益（破防）' }
    ]
  },
  daaixianzun: {
    name:'大爱仙尊', char:'爱', title:'方源真身', color:'#d4af37', glow:'rgba(212,175,55,0.8)',
    desc:'古月方源化身，冷漠无情、极度利己、算计无双，为达目的不择手段；大爱无疆不过是弱者的墓志铭',
    stats:{ atk:90, def:88, int:95 },
    heroType:HERO_TYPE.INTELLECT,
    faction:'immortal',
    skill:{ id:'sacrifice', name:'噬蛊祭道', desc:'献祭己方价值最低的非王棋子，对敌方价值最高的非王棋子造成等同于献祭棋子最大生命值的真实伤害（无视防御）；若击杀目标，己方全体棋子回复40HP [单体]', cd:4, target:'single' },
    skillLines:['众生皆可为我所用','算计，是强者的特权','你的价值，到此为止','大爱无疆...不过是弱者的墓志铭','古月方源...这才是我的真名'],
    loseLines:['算无遗策...竟有此变','棋子用尽，天命已终','这局，是我低估了你'],
    speech:['古月方源？不过是个会算计的小人','你的大爱？本王看着就想笑','蛊师？在本王面前不过是戏法'],
    actives:[
      { id:'sacrifice',  name:'噬蛊祭道', desc:'献祭己方价值最低的非王棋子，对敌方价值最高的非王棋子造成等同于献祭棋子最大生命值的真实伤害（无视防御）；若击杀目标，己方全体棋子回复40HP [单体]', cd:4, target:'single' },
      { id:'prey',       name:'算计连环', desc:'标记敌方价值最高的非王棋子为"猎物"，3回合内其防御归零（无视防御）；猎物被吃时己方全体棋子回复其最大生命值40% [单体]', cd:5, target:'single' },
      { id:'conversion', name:'大爱无疆', desc:'将敌方攻击力最高的非王棋子"感化"为己方阵营，生命/攻防保持不变，清除其所有buff；万物皆为我用 [单体]', cd:6, target:'single' }
    ],
    passives:[
      { id:'p_ironheart', name:'铁石心肠', trigger:PASSIVE_TRIGGER.IMMUNE,    desc:'首回合己方全体棋子免疫所有伤害；己方棋子受到的技能效果首回合无效' },
      { id:'p_gumaster',  name:'蛊师本能', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'己方棋子被吃时，己方全体棋子回复25HP，己方攻击最高的棋子获得攻击+10%（2回合，可叠加3层）' }
    ]
  },
  empire: {
    name:'帝国元首', char:'帝', title:'铁血独裁', color:'#7a4a2a', glow:'rgba(122,74,42,0.5)',
    desc:'铁腕独裁，闪电战专家，以生存空间之名碾压一切',
    stats:{ atk:93, def:78, int:90 },
    heroType:HERO_TYPE.INTELLECT,
    faction:'bking',
    skill:{ id:'blitz', name:'闪电战', desc:'己方车、马棋子攻击+30%（2回合），且己方所有棋子连走2步 [全范围]', cd:4, target:'aoe' },
    skillLines:['闪电战！全军出击！','生存空间，吾等必取','第三帝国，千年不朽','元首令已下，绝不退缩'],
    loseLines:['柏林...终究陷落','帝国...覆灭矣'],
    speech:['闪电战？本王早看穿你的战术','独裁？在本王面前不过是把戏','第三帝国？不过是黄粱一梦'],
    actives:[
      { id:'blitz', name:'闪电战', desc:'己方车、马棋子攻击+30%（2回合），且己方所有棋子连走2步 [全范围]', cd:4, target:'aoe' },
      { id:'lebensraum', name:'生存空间', desc:'己方棋子数<12时，召唤2个兵到空位，且己方全体棋子攻击+25%（2回合） [全范围]', cd:5, target:'aoe' },
      { id:'fuhrer', name:'元首令', desc:'全场禁锢对方棋子1回合，己方连走3步，且己方全体棋子攻击+50%（1回合） [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_discipline', name:'铁血纪律', trigger:PASSIVE_TRIGGER.AURA, desc:'永久光环：己方棋子数<10时，全体棋子攻击+15点（永久）' },
      { id:'p_reich', name:'第三帝国', trigger:PASSIVE_TRIGGER.AURA, desc:'永久光环：己方所有棋子防御+20点，HP+30（永久）' }
    ]
  },
  broly: {
    name:'布罗利', char:'布', title:'传说赛亚人', color:'#4a8a3a', glow:'rgba(74,138,58,0.5)',
    desc:'传说中的超级赛亚人，野性好战，气之压制无可匹敌，越战越强',
    stats:{ atk:95, def:85, int:55 },
    heroType:HERO_TYPE.STRENGTH,
    faction:'bking',
    skill:{ id:'rampage', name:'狂暴冲击', desc:'对敌方最强子造成250%伤害+击退至随机空位 [单体]', cd:4, target:'single' },
    skillLines:['啊！！！','暴动！','气之压制！','传说中的赛亚人！','你的气在我面前毫无意义'],
    loseLines:['这不可能...','传说...终结了'],
    speech:['传说中的赛亚人？不过是传说罢了','气之压制？本王免疫','布罗利？让你见识真正的力量'],
    actives:[
      { id:'rampage', name:'狂暴冲击', desc:'对敌方最强子造成250%伤害+击退至随机空位 [单体]', cd:4, target:'single' },
      { id:'awaken', name:'传说觉醒', desc:'变身超赛：己方所有棋子获得"溢出的气"buff（每回合+5%攻击+5%防御，递增，永久）+立即恢复30%HP [全范围]', cd:5, target:'aoe' },
      { id:'eruption', name:'气弹喷发', desc:'对敌方全体棋子造成100真实伤害+沉默1回合+击退1颗敌方子至随机空位 [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_overcharge', name:'溢出的气', trigger:PASSIVE_TRIGGER.AURA, desc:'永久光环：本方棋子每回合增长5%攻击力和5%防御力（递增，永久）' },
      { id:'p_legend', name:'传说体质', trigger:PASSIVE_TRIGGER.AURA, desc:'永久光环：每局1次，给己方帅加免疫1回合' }
    ]
  },
  /* ===== v29: 新增 3 角色 — 张树灿/张毓芝/刘锋 ===== */
  zhangshucan: {
    name:'张树灿', char:'树', title:'内敛深沉', color:'#4a5a4a', glow:'rgba(74,90,74,0.55)',
    desc:'性格内敛，话少但招招致命。沉默中蕴藏杀机，越是安静越要警惕',
    stats:{ atk:88, def:84, int:80 },
    heroType:HERO_TYPE.STRENGTH,
    faction:'strategist',
    skill:{ id:'silence_aura', name:'沉默气场', desc:'沉默B王2回合无法使用技能，且B王棋子下次攻击-20% [单体]', cd:3, target:'single' },
    skillLines:['……','沉默是金，言语是银','少说多做，一击致命','话多无益，且看此招','安静，让我思考'],
    loseLines:['……','沉默失败了','还是话说太多'],
    speech:['内敛？不过是装深沉','沉默？本王让你说不出话','少废话，看本王碾压你'],
    actives:[
      { id:'silence_aura', name:'沉默气场', desc:'沉默B王2回合无法使用技能，且B王棋子下次攻击-20% [单体]', cd:3, target:'single' },
      { id:'gather_strength', name:'内敛蓄势', desc:'选己方一颗棋子蓄势，2回合后下次攻击+80%（蓄势期间该子攻击-30%） [单体]', cd:3, target:'single' },
      { id:'still_water', name:'静水流深', desc:'3回合内己方全体棋子攻击+20%，且每回合恢复30HP [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_introverted', name:'内敛气场', trigger:PASSIVE_TRIGGER.AURA, desc:'光环：己方全体棋子防御+15点（内敛本色，稳固防守）' },
      { id:'p_deep_thought', name:'深思熟虑', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每3回合为己方帅添加50点护盾（2回合）' }
    ]
  },
  zhangyuzhi: {
    name:'张毓芝', char:'芝', title:'中庸之道', color:'#5a8a7a', glow:'rgba(90,138,122,0.55)',
    desc:'性格平和稳重，攻守平衡，不偏不倚。中庸之道，看似平淡实为大智',
    stats:{ atk:86, def:84, int:88 },
    heroType:HERO_TYPE.INTELLECT,
    faction:'strategist',
    skill:{ id:'balance', name:'均衡之力', desc:'己方全体棋子攻击+15%防御+15%（2回合），中庸之道 [全范围]', cd:3, target:'aoe' },
    skillLines:['均衡之道，攻守相宜','不偏不倚，是为中庸','过刚易折，过柔则弱','平衡方能持久','看似平淡，实则大智'],
    loseLines:['平衡被打破了','中庸也有失效时','过犹不及啊'],
    speech:['中庸？不过是平庸的借口','平衡？本王偏要打破','平和？让你见识真正的风暴'],
    actives:[
      { id:'balance', name:'均衡之力', desc:'己方全体棋子攻击+15%防御+15%（2回合） [全范围]', cd:3, target:'aoe' },
      { id:'golden_mean', name:'中庸之道', desc:'互换双方一颗强弱子位置，且己方下回合连走两步 [单体]', cd:3, target:'single' },
      { id:'steady_layout', name:'稳健布局', desc:'己方帅获得150点护盾，且己方全体棋子攻击+25%（2回合） [全范围]', cd:5, target:'aoe' }
    ],
    passives:[
      { id:'p_steady_aura', name:'稳健气场', trigger:PASSIVE_TRIGGER.TURN_START, desc:'光环：己方全体棋子每回合恢复10HP（平和本色，持久续航）' },
      { id:'p_calm_mind', name:'平和心态', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'己方棋子被吃时20%闪避，棋子保留' }
    ]
  },
  liufeng: {
    name:'刘锋', char:'锋', title:'搞子之王', color:'#b85a3a', glow:'rgba(184,90,58,0.55)',
    desc:'玩世不恭的搞子，看似胡闹实则暗藏杀机。你永远猜不到他下一步要做什么',
    stats:{ atk:90, def:70, int:80 },
    heroType:HERO_TYPE.AGILITY,
    faction:'hermit',
    skill:{ id:'trickster', name:'搞子之术', desc:'随机交换两颗敌方棋子位置，且B王棋子下回合无法吃子 [全范围]', cd:3, target:'aoe' },
    skillLines:['嘿嘿，搞一下子！','你以为我会按套路？天真！','乱来也是一种艺术','看好了，这叫搞子！','不按常理出牌，才是真本事'],
    loseLines:['搞砸了...','玩脱了...','这次搞到自己了'],
    speech:['搞子？不过是哗众取宠','玩世不恭？本王让你哭出来','胡闹？看本王怎么治你'],
    actives:[
      { id:'trickster', name:'搞子之术', desc:'随机交换两颗敌方棋子位置，且B王棋子下回合无法吃子 [全范围]', cd:3, target:'aoe' },
      { id:'chaos_throw', name:'混乱投掷', desc:'随机使对方一颗棋子沉默2回合，且该子下回合攻击-30% [单体]', cd:2, target:'single' },
      { id:'surprise', name:'出其不意', desc:'己方一颗棋子瞬移到对方区域任意空位，且该子下回合攻击+50% [单体]', cd:4, target:'single' }
    ],
    passives:[
      { id:'p_trickster_aura', name:'搞子气场', trigger:PASSIVE_TRIGGER.TURN_START, desc:'光环：对方全体棋子每回合5%概率走错（玩世不恭，干扰对手）' },
      { id:'p_unconventional', name:'不按套路', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每3回合己方攻击最高的棋子获得攻击+30%（2回合）' }
    ]
  },
  /* v34: 通天教主 — 混元大罗金仙 · 截教之主
     设计理念：以阵法系统+召唤仙兵+全局压制三大机制体现B格
     诛仙剑阵 = 最强判死刑仪式（标记必杀）
     万仙阵 = 突破规则召唤仙兵改变局势
     紫霄神威 = 全局禁锢+被动失效+连走三步
     5个被动各具特色，玩家选2个组合 */
  tongtian: {
    name:'通天教主', char:'通', title:'混元大罗金仙', color:'#1a1a2e', glow:'rgba(26,26,46,0.95)',
    desc:'混元大罗金仙，截教教主。立诛仙剑阵，判生死于须臾；万仙来朝，破规则于无形。一念通天，天地为之变色',
    stats:{ atk:88, def:88, int:95 },  /* v36: 100/100/100→88/88/95（顶级角色≤95约束）*/
    heroType:HERO_TYPE.INTELLECT,
    faction:'jiejiao',
    skill:{ id:'zhuxian', name:'诛仙剑阵', desc:'布下诛仙剑阵：召唤诛仙四剑（诛/戮/陷/绝）占位形成剑阵，剑阵范围内敌方每回合受30真实伤害且无法移动。3回合后阵法闭合引爆，造成一次性巨额伤害（无视免疫/护盾/金仙之体）。同时标记对方价值最高非王棋子为"剑下亡魂"——易伤+50%、禁疗、禁闪、血<50%必斩 [全范围]', cd:5, target:'aoe' },
    skillLines:['诛仙剑阵！天地色变！','紫霄神威，镇压万古！','万仙来朝，谁敢争锋？','截教之主，一念通天！','尔等命数，由本座裁定！'],
    loseLines:['通天...亦有无法通天之时...','诛仙剑断，万仙散尽...','此局...天命已定'],
    speech:['通天教主？在本王面前也不过是道家小仙','诛仙剑阵？本王让你剑阵自断','万仙来朝？本王看你就是聚众闹事','截教之主？本王才是棋局之主'],
    actives:[
      { id:'zhuxian', name:'诛仙剑阵', desc:'布下诛仙剑阵：召唤诛仙四剑（诛/戮/陷/绝）占位形成剑阵，剑阵范围内敌方每回合受30真实伤害且无法移动。3回合后阵法闭合引爆，造成一次性巨额伤害（无视免疫/护盾/金仙之体）。同时标记对方价值最高非王棋子为"剑下亡魂"——易伤+50%、禁疗、禁闪、血<50%必斩 [全范围]', cd:5, target:'aoe' },
      { id:'wanxian', name:'万仙阵', desc:'布下万仙阵：召唤4颗"仙兵"棋子到空位（HP=80/atk=40/def=20，3回合后消散），突破棋子上限。阵法期间己方全体获"万仙加持"攻击+25%+每回合回10%血。仙兵被吃时，吃子方受反噬（攻击-30% 1回合） [全范围]', cd:6, target:'aoe' },
      { id:'tongtian', name:'紫霄神威', desc:'紫霄宫中，鸿钧道祖座下神通：敌方全体棋子被"紫霄神威"笼罩——禁锢2回合+防御-50%（2回合）+被动失效2回合。己方下回合连走3步（破天命，无视禁锢） [全范围]', cd:7, target:'aoe' }
    ],
    passives:[
      { id:'p_zhuxian_aura', name:'诛仙剑意', trigger:PASSIVE_TRIGGER.AURA, desc:'每回合开始：给敌方攻击最高的非帅棋子施加"诛仙剑意"（1回合：受伤+30%、无法闪避、防御-30%）。剑意所至，最强之敌亦为剑下亡魂' },
      { id:'p_jiejiao', name:'截教道统', trigger:PASSIVE_TRIGGER.ON_CAPTURED, desc:'己方棋子被吃时：己方全体获"道统不灭"攻击+15%（2回合，可叠加3层），并召唤1颗"复仇仙兵"到空位（HP=60/atk=30/def=15，2回合后消散）。弟子陨落，万仙复仇' },
      { id:'p_wanxian_guard', name:'万仙护体', trigger:PASSIVE_TRIGGER.IMMUNE, desc:'每局1次：当己方帅/将被攻击且血量<30%时，免疫本次伤害，并反伤攻击方120真实伤害（无视防御）。万仙护体，关键时刻逆转乾坤' },
      { id:'p_tongtian_pressure', name:'通天威压', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每4回合：敌方全体棋子被"通天威压"笼罩1回合——防御-50%、无法使用技能。混元金仙之威，镇压天地' },
      { id:'p_hunyuan_golden', name:'混元金仙', trigger:PASSIVE_TRIGGER.PERIODIC, desc:'每3回合：己方全体棋子获"金仙之体"（1回合：攻击+50%、防御+50%、免疫所有负面buff）。金仙之体，万法不侵' }
    ]
  }
};


/* ===== B王难度面板标题（v38 动态化：UI 从此常量读取，禁止 HTML 硬编码） ===== */
const BKING_DIFFICULTY_HEADER = 'B王显摆等级';

/* ===== 3 个难度（互联网显摆等级） · B王极大加强 ===== */
/* v30 重构：B王 AI 统一采用七宗罪技能体系（与 BKING_LAYERS 故事模式一致）。
   - easy（青铜装）：仅 1 个主动（傲慢），1 个被动（傲慢光环）
   - medium（钻石装）：3 个主动（傲慢/贪婪/懒惰），3 个被动（光环/无耻/贪婪本性）
   - hard（王者装）：5 个主动（傲慢/贪婪/懒惰/嫉妒/暴怒），5 个被动（含自视清高）
   注：暴食/色欲为故事模式高层（5+/6层）与玩家形态专属，不进入 PVE 三难度。 */
const DIFFICULTIES = {
  easy: {
    name:'B王 · 青铜装', title:'萌新显摆', desc:'萌新显摆，偶有失误', depth:3, randomChance:0.3,
    skill:{ id:'arrogance', name:'傲慢·目中无人', desc:'B王气场压制：对方全体棋子下回合攻击-25%，且B王攻击最高的棋子下次攻击+30% [全范围]', cd:3, target:'all' },
    skills:[
      { id:'arrogance', name:'傲慢·目中无人', desc:'B王气场压制：对方全体棋子下回合攻击-25%，且B王攻击最高的棋子下次攻击+30% [全范围]', cd:3, target:'all' }
    ],
    skillChance:0.30,
    bkingPassives:['p_aura'], /* 青铜装仅1被动（傲慢光环） */
    skillLines:['啊这...就这水平？','本王随便玩玩都比你强','你们这群凡人，懂什么叫棋艺？','就这？也敢来挑战本王？','傲慢！本王就是天！'],
    winLines:['果然，凡人就是凡人','本王随便下下就赢了','这局赢得毫无成就感'],
    loseLines:['哼，本王只是让着你','运气好罢了，本王根本没认真','本王今天状态不好，下次虐爆你']
  },
  medium: {
    name:'B王 · 钻石装', title:'熟练显摆', desc:'熟练显摆，暗藏杀机', depth:4, randomChance:0.1,
    skill:{ id:'arrogance', name:'傲慢·目中无人', desc:'B王气场压制：对方全体棋子下回合攻击-25%，且B王攻击最高的棋子下次攻击+30% [全范围]', cd:3, target:'all' },
    skills:[
      { id:'arrogance', name:'傲慢·目中无人', desc:'B王气场压制：对方全体棋子下回合攻击-25%，且B王攻击最高的棋子下次攻击+30% [全范围]', cd:3, target:'all' },
      { id:'greedy', name:'贪婪·夺人所爱', desc:'窃取对方一颗棋子的永久buff给己方对应棋子，且B王的帅回复30%最大HP [单体]', cd:3, target:'single' },
      { id:'sloth', name:'懒惰·拖泥带水', desc:'对方全体棋子2回合内移动距离≤1格，且攻击-20% [全范围]', cd:3, target:'all' }
    ],
    skillChance:0.45,
    bkingPassives:['p_aura','p_shameless','p_greedy'], /* 钻石装3被动 */
    skillLines:['傲慢！本王就是天！','贪婪！你的buff？现在是我的了！','懒惰？这叫以逸待劳！','你以为能瞒过本王的法眼？'],
    winLines:['看到没？这就是本王的实力','你们这群凡人，永远追不上本王','本王随便操作都是神级走位'],
    loseLines:['居然...被你蒙对了','这步棋本王确实大意了','下次绝不会给你这个机会']
  },
  hard: {
    name:'B王 · 王者装', title:'特级显摆', desc:'特级显摆，深不可测', depth:5, randomChance:0,
    skill:{ id:'arrogance', name:'傲慢·目中无人', desc:'B王气场压制：对方全体棋子下回合攻击-25%，且B王攻击最高的棋子下次攻击+30% [全范围]', cd:3, target:'all' },
    skills:[
      { id:'arrogance', name:'傲慢·目中无人', desc:'B王气场压制：对方全体棋子下回合攻击-25%，且B王攻击最高的棋子下次攻击+30% [全范围]', cd:3, target:'all' },
      { id:'greedy', name:'贪婪·夺人所爱', desc:'窃取对方一颗棋子的永久buff给己方对应棋子，且B王的帅回复30%最大HP [单体]', cd:3, target:'single' },
      { id:'sloth', name:'懒惰·拖泥带水', desc:'对方全体棋子2回合内移动距离≤1格，且攻击-20% [全范围]', cd:3, target:'all' },
      { id:'envy', name:'嫉妒·东施效颦', desc:'复制对方被动技能给己方全体棋子（持续3回合），让对方失去该被动 [全范围]', cd:4, target:'all' },
      { id:'wrath', name:'暴怒·怒火中烧', desc:'B王全体棋子进入狂暴：3回合内攻击+50%但防御-30%，且每次攻击附带20真实伤害 [全范围]', cd:4, target:'all' }
    ],
    skillChance:0.60,
    bkingPassives:['p_aura','p_shameless','p_greedy','p_stupid_luck','p_bking_insight'], /* 王者装5被动 */
    skillLines:['傲慢！本王就是天！','贪婪！你的buff？现在是我的了！','懒惰？这叫以逸待劳！','嫉妒？本王只是借来用用！','暴怒！本王要毁了一切！'],
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

/* ===== v28: B王难度 N 层系统 — 难度随故事章节递增 =====
   每层属性加成：HP/atk/def +10%（第5层 +50%）
   技能解锁：高层 B王解锁更多主动/被动技能
   - actives/passives 仅声明可用 id，实际效果由 maybeAISkill/getBkingPassives 解释
   - depth: AI 思考深度（覆盖 DIFFICULTIES[aiDifficulty].depth）
   - skillChance: 主动技能释放概率（覆盖 DIFFICULTIES[aiDifficulty].skillChance）
   注：非故事模式（PVE/PVP/三英）保持原 DIFFICULTIES 逻辑，不受 BKING_LAYERS 影响。 */
const BKING_LAYERS = {
  /* v30: 七宗罪技能体系 — 每层解锁不同的罪
     1层: 傲慢（基础罪）
     2层: + 贪婪（开始索取）
     3层: + 懒惰（拖延战术）
     4层: + 嫉妒（窃取本事）
     5层: + 暴怒（狂暴攻击）
     5+层: + 暴食（吞噬同袍）
     6层: + 色欲（全七宗罪觉醒） */
  1: { name:'B王 · 1层 · 青铜装', title:'傲慢初现',
       hpMul:1.0, atkMul:1.0, defMul:1.0,
       actives:['arrogance'], passives:['p_aura'],
       depth:2, skillChance:0.30 },
  2: { name:'B王 · 2层 · 青铜装+', title:'贪婪滋生',
       hpMul:1.1, atkMul:1.1, defMul:1.1,
       actives:['arrogance','greedy'], passives:['p_aura','p_shameless','p_greedy'],
       depth:2, skillChance:0.35 },
  3: { name:'B王 · 3层 · 钻石装', title:'懒惰发作',
       hpMul:1.2, atkMul:1.2, defMul:1.2,
       actives:['arrogance','greedy','sloth'], passives:['p_aura','p_shameless','p_greedy','p_stupid_luck'],
       depth:3, skillChance:0.45 },
  4: { name:'B王 · 4层 · 钻石装+', title:'嫉妒心生',
       hpMul:1.3, atkMul:1.3, defMul:1.3,
       actives:['arrogance','greedy','sloth','envy'], passives:['p_aura','p_shameless','p_greedy','p_stupid_luck','p_bking_insight'],
       depth:3, skillChance:0.55 },
  5: { name:'B王 · 5层 · 王者装', title:'暴怒觉醒',
       hpMul:1.5, atkMul:1.5, defMul:1.5,
       actives:['arrogance','greedy','sloth','envy','wrath'], passives:['p_aura','p_shameless','p_greedy','p_stupid_luck','p_bking_insight'],
       depth:4, skillChance:0.70 },
  /* v30: 5+层 — 王者装+（对应第19章帝国元首） */
  6: { name:'B王 · 5+层 · 王者装+', title:'暴食吞噬',
       hpMul:1.7, atkMul:1.7, defMul:1.7,
       actives:['arrogance','greedy','sloth','envy','wrath','gluttony'], passives:['p_aura','p_shameless','p_greedy','p_stupid_luck','p_bking_insight'],
       depth:4, skillChance:0.80 },
  /* v30: 6层 — 仙帝装（对应第20章终章，七宗罪全觉醒） */
  7: { name:'B王 · 6层 · 仙帝装', title:'七宗罪全觉醒',
       hpMul:2.0, atkMul:2.0, defMul:2.0,
       actives:['arrogance','greedy','sloth','envy','wrath','gluttony','lust'], passives:['p_aura','p_shameless','p_greedy','p_stupid_luck','p_bking_insight'],
       depth:5, skillChance:0.90 }
};

/* v30: B王形态切换系统 — 每N回合切换战斗形态
   每种形态提供不同的加成，玩家需适应变化
   形态切换在 game.js 的回合开始时触发 */
const BKING_FORMS = {
  defensive:  { name:'防守形态', desc:'龟缩防守，防御+30%，每回合HP恢复+20', icon:'🛡️',
                atkMul:1.0, defMul:1.3, hpRegen:20 },
  offensive:   { name:'进攻形态', desc:'狂暴进攻，攻击+30%，技能CD-1', icon:'⚔️',
                atkMul:1.3, defMul:1.0, cdReduce:1 },
  cunning:     { name:'狡诈形态', desc:'阴谋诡计，技能CD-1，buff持续时间+1', icon:'🎭',
                atkMul:1.0, defMul:1.0, cdReduce:1, buffDurationBonus:1 },
  frenzied:    { name:'疯狂形态', desc:'失去理智，攻击+50%但每回合可能攻击己方', icon:'🔥',
                atkMul:1.5, defMul:0.8, selfAttackChance:0.15 }
};
const BKING_FORM_CYCLE = ['defensive','offensive','cunning','frenzied']; /* 形态切换顺序 */
const BKING_FORM_SWITCH_INTERVAL = 5; /* 每5回合切换一次形态 */

/* 章节到 B王层数的映射（v29 扩展至 20 章）：
   - 第 1-3 章：1层（青铜）
   - 第 4-6 章：2层（青铜+）
   - 第 7-9 章：3层（钻石）
   - 第 10-12 章：4层（钻石+）
   - 第 13-14 章：5层（王者）
   - 第 15-16 章：4层（钻石+）
   - 第 17-18 章：5层（王者）
   - 第 19 章：5+层（王者+）
   - 第 20 章：6层（仙帝装） */
function getBkingLayerForChapter(chapterId){
  if(chapterId <= 3) return 1;
  if(chapterId <= 6) return 2;
  if(chapterId <= 9) return 3;
  if(chapterId <= 12) return 4;
  if(chapterId <= 14) return 5;
  if(chapterId <= 16) return 4;
  if(chapterId <= 18) return 5;
  if(chapterId === 19) return 6;
  return 7; /* 第 20 章：仙帝装 */
}

/* ===== B王通用话语 ===== */
const B_TAUNTS = {
  start:['哟，又来一个挑战者？本王等着呢','欢迎来到本王的棋盘，凡人','这局，本王让你先出手，免得说本王欺负人','就这？也敢挑战本王？'],
  thinking:['本王正在思考，你们凡人不懂','这步棋...本王早已料到','你以为本王在思考？其实本王在酝酿大招','让本王想想，怎么赢你才比较好看'],
  capture:['本王收下了！','这子归本王了，感谢馈赠','不过是区区一子，本王不放在眼里','看到没？这就是实力的差距'],
  check:['将军！凡人，你慌了吗？','退无可退了吧？认输吧！','本王随便走一步都是将军，羡慕吗？','将死只是时间问题，你还挣扎什么？'],
  react:['哼，雕虫小技！','就这？本王根本不放在眼里','你以为这招对本王有用？','可笑，真是可笑','本王早有防备，休想得逞','这点手段也想撼动本王？']
};

/* ===== 阵营定义 ===== */
const FORMATIONS = {
  bking:     { name:'B王阵营', color:'#2a2520', desc:'显摆为王，以势压人', members:['bking','ikun','liuqi','liuxuepei'] },
  immortal:  { name:'仙帝阵营', color:'#9b59b6', desc:'仙法无垠，天罚降临', members:['alice','daaixianzun','liuxuepei','xieyuxuan'] },
  strategist:{ name:'谋士阵营', color:'#3a6b8a', desc:'运筹帷幄，谋定后动', members:['houzhibo','zhouzihan','luxingchen','tangboyuhan'] },
  brother:   { name:'兄弟阵营', color:'#c47544', desc:'兄弟义气，以攻代守', members:['sanjin','huhao','liujiawei','luolunjie'] },
  hermit:    { name:'隐士阵营', color:'#4a6b5a', desc:'隐忍待机，厚积薄发', members:['yuanqingshan','wangxin','liuxuepei','liuqi'] }
};

/* ===== 隐藏角色（v39 动态化：通关全部章节后解锁的角色列表） =====
   仅 4 个真正"隐藏"：broly/empire/alice 已通过 18/19/20 章 unlockChar 解锁，不再列入。
   后续新增隐藏角色只需在此数组追加，无需修改 game.js。 */
const HIDDEN_CHARS = ['daaixianzun', 'bking', 'tongtian', 'liuqi'];

/* ===== 故事模式章节（v10 重设计：14章，每章解锁1名角色） =====
   字段说明：
   - unlockChar：通关本章后解锁的角色 id（单数）
   - aiDifficulty：'easy'|'medium'|'hard'，对应 DIFFICULTIES 难度
   - aiChar：本章 AI 控制的角色 id（默认 bking）
   - intro：剧情开场白（字符串，渲染时按行拆分）
   - winText：通关后 B王 的台词
   - reward：解锁奖励的中文描述 */
const STORY_CHAPTERS = [
  {
    id: 1,
    title: '第一章 · 初识B王',
    desc: 'B王在班里四处下战书，你决定用棋艺让他服气',
    unlockChar: 'houzhibo',
    playerChar: 'houzhibo',
    aiDifficulty: 'easy',
    bkingLayer: 1,
    aiChar: 'bking',
    intro: 'B王又在那显摆了，侯智博决定出手教训。',
    winText: 'B王：这局不算！本王没发挥好！',
    reward: '解锁侯智博',
    introDialog: [
      { speaker: 'B王', text: '哼！全班又有谁敢与本王对弈？上一个挑战者，三步就被本王将死，直呼没想到！你们这些凡人，根本不懂什么叫棋道！' },
      { speaker: '你', text: 'B王，你这般嚣张，无非是仗着没人能破你的开局。今日，我便替天行道。' },
      { speaker: 'B王', text: '替天行道？哈哈哈哈！笑死本王了！你这无名小卒，也配提天？今日就让你看看，什么叫实力碾压！' },
      { speaker: '侯智博', text: '且慢。这位兄弟，B王的开局看似无懈可击，实则中盘必露破绽。我观你面相，是有大机缘之人，赠你一计——奇兵伏路，候敌深入。' },
      { speaker: '你', text: '多谢侯兄指点。奇兵伏路……我懂了。B王，你那点小聪明，今日走到头了！' },
      { speaker: 'B王', text: '奇兵？伏路？可笑！本王纵横棋坛多年，什么阵势没见过？你们两个联手，本王也照样碾过去！' },
      { speaker: '侯智博', text: '兄弟，记住——棋盘如战场，示弱方能诱敌。B王狂妄，正是他最大的弱点。去吧，让这位"王者"见识真正的棋道！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '不！这不可能！本王怎么会输给一个无名小卒？这局不算！本王刚才没发挥好，手感差得很！' },
      { speaker: '你', text: '输了就是输了，何必找借口？' },
      { speaker: 'B王', text: '哼！你以为赢了一局就了不起了？本王今日状态不佳，下次定让你好看！侯智博，你给他的那些雕虫小技，本王记下了！' },
      { speaker: '侯智博', text: 'B王，棋道在于心，不在口。你若不悟，纵有千局万局，也不过是输家。' }
    ]
  },
  {
    id: 2,
    title: '第二章 · 课堂风云',
    desc: '王昕老师在课堂上与B王对弈',
    unlockChar: 'wangxin',
    playerChar: 'wangxin',
    aiDifficulty: 'easy',
    bkingLayer: 1,
    aiChar: 'bking',
    intro: '王昕老师：B王同学，来回答一下这步棋怎么走。',
    winText: 'B王：老师你这是在刁难我！',
    reward: '解锁王昕',
    introDialog: [
      { speaker: '王昕', text: 'B王同学，上课铃都响了，你还在那里大声喧哗，扰了课堂秩序。今日这堂课，我们讲布局之道——你既然自诩棋艺高超，可否上台演示一番？' },
      { speaker: 'B王', text: '王老师，您这是要本王当众表演？那感情好！本王正好让这帮同学开开眼界，看看什么叫棋道宗师！' },
      { speaker: '王昕', text: '好。那便由老师亲自会会你。我执红，你执黑，规则照旧。你若输了，今后上课不许再扰乱秩序。' },
      { speaker: 'B王', text: '老师您？哈哈，恕本王直言，您那点水平，怕是连本王三招都接不下！本王让您两子，如何？' },
      { speaker: '你', text: '王老师，让我来吧。B王这么嚣张，该有个学生好好治治他。' },
      { speaker: '王昕', text: '也好。你既是有心人，便由你代老师出手。记住，布局之道，在于藏锋。B王锋芒太露，必有疏漏。这一局，我教你"以静制动"四字。' },
      { speaker: 'B王', text: '以静制动？哈！本王偏要以动破静！来吧，让本王看看你们师徒能撑几个回合！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '这……这不可能！本王怎么会输给学生？王老师，是不是你暗中使诈？' },
      { speaker: '王昕', text: '胜负在棋，不在人。B王，你输在心浮气躁。棋如人生，沉不住气者，必失大局。' },
      { speaker: 'B王', text: '哼！老师偏心！本王刚才那是让着同学，免得说本王以大欺小！下次，下次本王绝不再留手！' },
      { speaker: '你', text: 'B王，借口说多了，连你自己都信了吧？' }
    ]
  },
  {
    id: 3,
    title: '第三章 · 棋艺精进',
    desc: '周子翰展现优雅棋风，布局控场',
    unlockChar: 'zhouzihan',
    playerChar: 'zhouzihan',
    aiDifficulty: 'easy',
    bkingLayer: 1,
    aiChar: 'bking',
    intro: '周子翰：风度翩翩，一子定乾坤。',
    winText: 'B王：花架子！本王不屑一顾！',
    reward: '解锁周子翰',
    introDialog: [
      { speaker: '周子翰', text: '听闻阁下连胜B王两局，子翰特来讨教。在下周子翰，素爱棋道，最喜以一子定乾坤——棋风虽雅，杀气却不弱。' },
      { speaker: 'B王', text: '周子翰？哦——就是那个整天装优雅的家伙？本王早看你不顺眼了！装什么风度翩翩，棋盘上见真章！' },
      { speaker: '周子翰', text: 'B王此言差矣。风度非装，乃养也。棋如其人，你心浮则棋乱，我心静则棋定。今日这一局，愿与阁下共证棋道。' },
      { speaker: '你', text: '周兄倒是好涵养。B王这般挑衅，你都能一笑置之。' },
      { speaker: '周子翰', text: '棋盘之上，胜负靠的是子力，不是嘴皮。这位兄弟，你既连胜B王，便有几分真本事。但B王今日有备而来，切莫轻敌。' },
      { speaker: 'B王', text: '哈！本王今日确实研究过你俩的棋路！周子翰，你的"一子定乾坤"在本王面前，不过是笑话！今日就是你的滑铁卢！' },
      { speaker: '周子翰', text: '是吗？那便请B王殿下，接子翰这一局优雅。' }
    ],
    winDialog: [
      { speaker: 'B王', text: '花架子！全是花架子！本王不屑一顾！这种下法，根本是侥幸！' },
      { speaker: '周子翰', text: 'B王，棋盘无侥幸。每一子落下，皆是因果。你今日之败，败在轻敌，非败在技艺。' },
      { speaker: 'B王', text: '少给本王灌鸡汤！本王就是状态不好，昨晚没睡好！下次，下次定让你俩见识本王真正的实力！' },
      { speaker: '你', text: '周兄，B王这是又要找借口了。' },
      { speaker: '周子翰', text: '由他去吧。执迷不悟者，纵有千言万语，也是徒劳。' }
    ]
  },
  {
    id: 4,
    title: '第四章 · 兄弟义气',
    desc: '三金以攻代守，狂战之怒',
    unlockChar: 'sanjin',
    playerChar: 'sanjin',
    aiDifficulty: 'medium',
    aiChar: 'bking',
    intro: '三金：兄弟我从不退让！攻！攻！攻！',
    winText: 'B王：莽夫一个！本王下次必胜！',
    reward: '解锁三金',
    introDialog: [
      { speaker: '三金', text: '哈哈哈！听说B王你小子又在显摆？来来来，让三金哥教教你什么叫真正的棋！兄弟我从不退让，攻！攻！攻！' },
      { speaker: 'B王', text: '三金？就你？整天兄弟兄弟的，棋盘上可不是靠嘴兄弟！本王今日就让你看看，莽夫是怎么被打成猪头的！' },
      { speaker: '三金', text: '莽夫？哈！老子这叫以攻代守！你那点小九九，老子一眼就看穿了！兄弟，今日这一局，老子陪你打！' },
      { speaker: '你', text: '三金哥，气势倒是不输。只是B王这次有了准备，怕是不好对付。' },
      { speaker: '三金', text: '怕个鸟！兄弟我什么时候怕过？B王你听好了——今日这盘棋，老子要让你见识什么叫兄弟义气！进攻，进攻，再进攻！' },
      { speaker: 'B王', text: '哈！就凭你？本王今日特意升级了装备，青铜装+，攻防全部+10%！你以为本王这两层是白叠的？' },
      { speaker: '三金', text: '管你几层，老子一刀下去，统统给你剁了！兄弟，跟着老子冲，杀他个片甲不留！' },
      { speaker: '你', text: '好！既然三金哥如此豪气，那便以攻代守，让B王见识真正的兄弟之力！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '莽夫！纯粹的莽夫！本王下次必胜！这种打法，根本不讲棋理！' },
      { speaker: '三金', text: '棋理？老子就是棋理！打不过就别BB，乖乖认输！' },
      { speaker: 'B王', text: '你！你以为赢了一局就了不起了？本王今日手感冰凉，要不大意能输给你这种莽夫？' },
      { speaker: '三金', text: '哈哈！B王你借口真多！下次还敢来不？老子随时奉陪！' },
      { speaker: '你', text: '三金哥说得对，B王，要战便战，何必那么多废话。' }
    ]
  },
  {
    id: 5,
    title: '第五章 · 舞步迷惑',
    desc: '鸡哥完美伪装，虚实难辨',
    unlockChar: 'jige',
    playerChar: 'jige',
    aiDifficulty: 'medium',
    bkingLayer: 2,
    aiChar: 'bking',
    intro: '鸡哥：鸡你太美！看你怎么选！',
    winText: 'B王：舞步再花哨也逃不过本王法眼！',
    reward: '解锁鸡哥',
    introDialog: [
      { speaker: '鸡哥', text: '鸡你太美！鸡你太美！嘿嘿，B王，听说你最近又被打脸了？让鸡哥我来会会你，看你怎么选！' },
      { speaker: 'B王', text: '鸡哥？就你那点舞步？哈！本王早看穿了，虚虚实实，花拳绣腿！今日就让你见识本王的火眼金睛！' },
      { speaker: '鸡哥', text: '嘿！你小子嘴挺硬啊！鸡哥我的舞步，看似花哨，实则步步杀机！你看不出来，那是你层次不够！' },
      { speaker: '你', text: '鸡哥，你的舞步迷惑之术，确实名不虚传。今日这一局，还请多多指教。' },
      { speaker: '鸡哥', text: '好说好说！小兄弟挺会说话。看鸡哥今日怎么把B王绕晕——左边一个鸡你太美，右边一个唱跳rap，保准他找不到北！' },
      { speaker: 'B王', text: '哼！装神弄鬼！本王今日可是带了"无耻"被动，你那点小把戏，对本王根本没用！等着被本王打回原形吧！' },
      { speaker: '鸡哥', text: '哎哟，还带被动的？那正好，鸡哥今日就让你看看，什么叫真正的"完美伪装"——你以为我在跳，其实我已经在杀了！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '舞步再花哨也逃不过本王法眼！这局不算，本王刚才眼睛花了，没看清你那几步！' },
      { speaker: '鸡哥', text: '嘿嘿，眼睛花了？那正好说明鸡哥的舞步奏效了！B王你啊，就是嘴硬！' },
      { speaker: 'B王', text: '哼！你以为本王真的输了？本王不过是放水，想看看你究竟有几斤几两！下次，下次定让你跪着喊爸爸！' },
      { speaker: '你', text: 'B王，你这借口找得越来越离谱了。放水？那刚才那副气急败坏的样子又是怎么回事？' },
      { speaker: '鸡哥', text: '哈哈，B王你就别装了！输了就输了，男子汉大丈夫，敢作敢当！' }
    ]
  },
  {
    id: 6,
    title: '第六章 · 唱跳节奏',
    desc: 'ikun节奏掌控，灵动多变',
    unlockChar: 'ikun',
    playerChar: 'ikun',
    aiDifficulty: 'medium',
    bkingLayer: 2,
    aiChar: 'bking',
    intro: 'ikun：唱跳rap篮球！全给你！',
    winText: 'B王：两年半练习也不过如此！',
    reward: '解锁ikun',
    introDialog: [
      { speaker: 'ikun', text: '两年半练习生ikun，前来拜会B王！唱跳rap篮球，全给你！今日这一局，让ikun给你打打节奏！' },
      { speaker: 'B王', text: '又来一个跳梁小丑？ikun，你那两年半练习，本王看也就是个花架子！今日就让你见识本王的真正实力！' },
      { speaker: 'ikun', text: '嘿嘿，B王你这话可就不对了。两年半虽短，但ikun我节奏感可是顶级的！棋盘如舞池，每一步都是节拍，你能跟上吗？' },
      { speaker: '你', text: 'ikun，听说你的节奏掌控，能让对手晕头转向？' },
      { speaker: 'ikun', text: '那必须的！ikun我唱跳的时候，全场的眼睛都得跟着我转！棋盘也一样，我想让你看哪，你就得看哪！' },
      { speaker: 'B王', text: '哈！让本王看哪就看哪？你以为你是谁？本王今日就让你看看，什么叫无视节奏，直接碾压！' },
      { speaker: 'ikun', text: '哎哟，口气不小！那ikun今日就让你见识一下，什么叫"唱跳rap篮球"——节奏一开，你连本王在哪都找不到！' },
      { speaker: '你', text: '既然如此，那便让ikun领舞，B王跟节奏，我负责收割。开始吧！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '两年半练习也不过如此！本王刚才……刚才只是被你的节奏扰了一下，根本不算输！' },
      { speaker: 'ikun', text: '嘿嘿，被扰了也是输啊！B王你借口可真多！' },
      { speaker: 'B王', text: '哼！你以为本王真的怕你那点节奏？本王只是不屑与你这种小丑计较！下次，下次定让你哭都哭不出来！' },
      { speaker: '你', text: 'B王，"不屑计较"这四个字，你都用第几次了？下次换个借口吧。' },
      { speaker: 'ikun', text: '哈哈！B王你这套词儿都用烂了！要不要ikun给你写个新剧本？' }
    ]
  },
  {
    id: 7,
    title: '第七章 · 正道护体',
    desc: '胡浩浩然正气，堂堂正正',
    unlockChar: 'huhao',
    playerChar: 'huhao',
    aiDifficulty: 'medium',
    bkingLayer: 3,
    aiChar: 'bking',
    intro: '胡浩：以正道碾压一切！',
    winText: 'B王：正气？在本王面前不值一提！',
    reward: '解锁胡浩',
    introDialog: [
      { speaker: '胡浩', text: 'B王！你祸害班级已久，今日胡某便要以正道碾压你！浩然正气，护体护心，你那点显摆的小把戏，在正道面前不堪一击！' },
      { speaker: 'B王', text: '胡浩？哈！又来一个不怕死的！本王今日升级到钻石装，攻防全部+20%！你以为你那点"正气"能挡住本王？' },
      { speaker: '胡浩', text: '钻石装？哼，邪魔外道之物！胡某行得正坐得端，纵使你百般装备，也压不住我这一身正气！' },
      { speaker: '你', text: '胡兄豪气！这正道护体之名，果然名不虚传。' },
      { speaker: '胡浩', text: '兄弟过誉了。正气非一人所有，乃天下共仰。今日这一局，胡某不为私名，只为正道扫清邪祟！B王，受死吧！' },
      { speaker: 'B王', text: '哈！正道？笑死本王了！本王就是邪魔外道，你能奈我何？今日就让你这"正道"跪在本王脚下！' },
      { speaker: '胡浩', text: '口出狂言！今日便让你见识——正气一振，万邪辟易！兄弟，与胡某并肩，扫除此獠！' },
      { speaker: '你', text: '好！正道加持，B王今日必败！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '正气？在本王面前不值一提！这局不算，本王刚才被你那"正气"晃了一下眼！' },
      { speaker: '胡浩', text: 'B王，正气乃天地之理，岂是"晃眼"二字能解释？你今日之败，是邪不胜正的天道轮回。' },
      { speaker: 'B王', text: '少给本王讲天道！本王就是不信邪！下次，下次本王定让你这"正道"跪地求饶！' },
      { speaker: '你', text: 'B王，下次下次，你下次都说了多少次了？' },
      { speaker: '胡浩', text: '由他去吧。执迷不悟者，纵有千次下次，也是徒劳。' }
    ]
  },
  {
    id: 8,
    title: '第八章 · 逻辑之眼',
    desc: '解宇轩逻辑压制，看穿一切',
    unlockChar: 'xieyuxuan',
    playerChar: 'xieyuxuan',
    aiDifficulty: 'hard',
    bkingLayer: 3,
    aiChar: 'bking',
    intro: '解宇轩：你的逻辑有漏洞。',
    winText: 'B王：逻辑？本王就是逻辑！',
    reward: '解锁解宇轩',
    introDialog: [
      { speaker: '解宇轩', text: 'B王，你的棋路有漏洞。从开局到现在，你共走了37步，其中19步是无效操作，逻辑链断裂处有6处。继续下去，你必败。' },
      { speaker: 'B王', text: '解宇轩？你这个书呆子！本王下棋靠的是天赋，是直觉！什么逻辑链，什么无效操作，本王根本不屑！' },
      { speaker: '解宇轩', text: '直觉？数据不支持这种说法。根据本座的分析，你的"直觉"实际胜率仅为23.7%，而我的逻辑推演胜率为91.3%。差距悬殊。' },
      { speaker: '你', text: '解兄这逻辑之眼，果然不同凡响。还没开局，就已经算到结局了。' },
      { speaker: '解宇轩', text: '并非算到结局，而是排除了不可能的结局。剩余的可能，便只有你败。B王，本座给你一个建议——投降，节省时间。' },
      { speaker: 'B王', text: '放屁！本王偏不信你那套！钻石装加持，本王今日就让你见识——什么叫做不讲逻辑的碾压！' },
      { speaker: '解宇轩', text: '不讲逻辑？那就更简单了。无逻辑的决策，等同于随机，而随机的对手，最易被预测。本座等你的破绽。' },
      { speaker: '你', text: '解兄说得有理。B王，今日你的"天赋"，怕是要栽在"逻辑"手里了。' }
    ],
    winDialog: [
      { speaker: 'B王', text: '逻辑？本王就是逻辑！这局不算，本王刚才脑回路短路了一下！' },
      { speaker: '解宇轩', text: '脑回路短路？这与"逻辑"矛盾。若你是逻辑，则不应短路；若短路，则非逻辑。B王，你的论证不成立。' },
      { speaker: 'B王', text: '你！少给本王玩文字游戏！本王就是状态不好，下次，下次定让你这书呆子闭嘴！' },
      { speaker: '你', text: '解兄，B王这是又被逻辑绕进去了。' },
      { speaker: '解宇轩', text: '正常。无法自洽的论述，本就站不住脚。B王，下次请准备充分再来。' }
    ]
  },
  {
    id: 9,
    title: '第九章 · 代码之力',
    desc: '陆星辰代码扫描，异常捕获',
    unlockChar: 'luxingchen',
    playerChar: 'luxingchen',
    aiDifficulty: 'hard',
    bkingLayer: 3,
    aiChar: 'bking',
    intro: '陆星辰：Debug开始，异常已捕获。',
    winText: 'B王：代码？本王就是Bug本身！',
    reward: '解锁陆星辰',
    introDialog: [
      { speaker: '陆星辰', text: 'B王，扫描完毕。你的棋路共发现47个Bug，3个致命漏洞，1个内存泄漏。建议立即修复，否则必崩。Debug开始，异常已捕获。' },
      { speaker: 'B王', text: '陆星辰？你这程序员宅男！本王下棋关你代码什么事？别用你那套破术语来忽悠本王！' },
      { speaker: '陆星辰', text: '万物皆可代码。棋盘是状态机，棋子是对象，每一步是函数调用。本座已为你写好Patch，今日便部署到棋盘上——让你看看什么叫"修复B王"。' },
      { speaker: '你', text: '陆兄这比喻倒是新鲜。代码之力，能用在棋盘上？' },
      { speaker: '陆星辰', text: '当然。本座的"异常捕获"被动，能截断你的关键技能；"代码扫描"主动，能预测你下一步的commit。B王，你的源码本座已经看穿了。' },
      { speaker: 'B王', text: '哈！源码？本王就是闭源的，你看个屁！今日钻石装加持，本王就是Bug本身，你敢Debug本王，本王就让你程序崩溃！' },
      { speaker: '陆星辰', text: 'Bug本身？那更好。Bug终会被修复，这是软件工程的铁律。本座今日，便提PR收你。' },
      { speaker: '你', text: '好！陆兄这番话，倒真有几分极客风范。B王，今日你的Bug怕是要被清光了。' }
    ],
    winDialog: [
      { speaker: 'B王', text: '代码？本王就是Bug本身！这局不算，本王刚才被你这破程序干扰了！' },
      { speaker: '陆星辰', text: '干扰？本座的代码是经过单元测试的，不存在干扰逻辑。B王，你的失败是必然结果，与外部因素无关。' },
      { speaker: 'B王', text: '放屁！本王就是状态不好，被你这宅男捡了便宜！下次，下次本王定让你这破程序崩溃！' },
      { speaker: '你', text: '陆兄，B王这是又找上借口了。' },
      { speaker: '陆星辰', text: '正常。无法被修复的Bug，往往会抛出异常日志。B王此刻的言论，便是他的异常日志。' }
    ]
  },
  {
    id: 10,
    title: '第十章 · 翻书求知',
    desc: '唐昊博涵翻书作弊，学霸风范',
    unlockChar: 'tangboyuhan',
    playerChar: 'tangboyuhan',
    aiDifficulty: 'hard',
    bkingLayer: 4,
    aiChar: 'bking',
    intro: '唐昊博涵：让我翻翻书...这题简单！',
    winText: 'B王：翻书算什么本事！',
    reward: '解锁唐昊博涵',
    introDialog: [
      { speaker: '唐昊博涵', text: '让我翻翻书……嗯，《棋谱大全》第237页，破B王之法，找到了！这题简单！B王，你今日遇到本学霸，算你倒霉！' },
      { speaker: 'B王', text: '唐昊博涵？就你那点翻书的小把戏？哈！本王今日升级到钻石装+，攻防全部+30%！你以为翻两页书就能赢本王？' },
      { speaker: '唐昊博涵', text: '钻石装+又如何？知识就是力量！本学霸翻过的书，比你走过的路还多！你那点显摆的伎俩，书上早有破解之法！' },
      { speaker: '你', text: '唐兄这翻书作弊……不，翻书求知之术，倒是别出心裁。' },
      { speaker: '唐昊博涵', text: '嘿嘿，过奖过奖！这叫有备而来！B王你那几招，本学霸已经做了笔记，标签都贴好了——"B王开局破绽"、"B王中盘失误"、"B王终盘崩溃"，章节分明！' },
      { speaker: 'B王', text: '哼！书呆子一个！本王今日就让你见识——实战之中，书上那点东西根本没用！本王就是不按套路出牌！' },
      { speaker: '唐昊博涵', text: '不按套路？那正好，本学霸的笔记里有"非套路应对方案"——附录B，第412页。B王，你已经在本学霸的计算之中了！' },
      { speaker: '你', text: '好！既然唐兄有备而来，那便让B王见识一下"知识"的威力！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '翻书算什么本事！有本事凭真本事下棋！这局不算，本王刚才被你这书晃了眼！' },
      { speaker: '唐昊博涵', text: '嘿嘿，B王你这是嫉妒！书是知识的载体，翻书就是汲取智慧！你这叫"知识焦虑症"，建议翻翻书治治！' },
      { speaker: 'B王', text: '哼！你以为本王真的输了？本王只是不想跟你这种书呆子一般见识！下次，下次定让你这破书翻不动！' },
      { speaker: '你', text: 'B王，被书打败也是种本事。你那借口，倒是越来越有创意了。' },
      { speaker: '唐昊博涵', text: '哈哈！B王你啊，多翻翻书吧！《如何优雅地认输》第1页，建议细读！' }
    ]
  },
  {
    id: 11,
    title: '第十一章 · 破妄沉默',
    desc: '刘雪沛破妄之眼，沉默B王',
    unlockChar: 'liuxuepei',
    playerChar: 'liuxuepei',
    aiDifficulty: 'hard',
    bkingLayer: 4,
    aiChar: 'bking',
    intro: '刘雪沛：破妄！你的技能在本座面前无效！',
    winText: 'B王：沉默？本王从来就不靠技能！',
    reward: '解锁刘雪沛',
    introDialog: [
      { speaker: '刘雪沛', text: 'B王，你的技能，在本座面前无效。破妄之眼，看穿一切虚妄；沉默之术，封尽一切花招。今日，本座便让你无技可施。' },
      { speaker: 'B王', text: '刘雪沛？你这个故作高深的家伙！本王的技能岂是你能封的？钻石装+加持，本王今日就让你这"破妄"变成"破胆"！' },
      { speaker: '刘雪沛', text: '钻石装+？哼，外物耳。本座所修，乃是心眼。你那点显摆之术，本座一眼便看穿——虚张声势，外强中干。' },
      { speaker: '你', text: '刘兄这破妄沉默之术，倒是B王的克星。B王最擅长的就是显摆，被沉默了，怕是连话都说不出来。' },
      { speaker: '刘雪沛', text: '正是。B王之强，强在嘴；B王之弱，弱在心。封其口，乱其心，则其技自废。今日这一局，本座便让他知道——显摆，也是有代价的。' },
      { speaker: 'B王', text: '放肆！本王显摆乃是天赋，岂是你能封的？今日就让你见识本王的"无耻"被动——你沉默本王，本王就耍无赖！' },
      { speaker: '刘雪沛', text: '无赖？哼，本座早有预料。破妄之眼之下，无赖亦无所遁形。B王，你的所有招数，本座已尽收眼底。' },
      { speaker: '你', text: '好！刘兄既有此把握，那便让B王见识真正的"沉默是金"！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '沉默？本王从来就不靠技能！这局不算，本王刚才喉咙不舒服，没使出全力！' },
      { speaker: '刘雪沛', text: '喉咙不舒服？此乃身疾，非心疾。B王，你的失败不在喉咙，而在心。心若不静，纵使口若悬河，亦是徒劳。' },
      { speaker: 'B王', text: '少给本王装大师！本王就是被你这破沉默搞烦了！下次，下次定让你这破妄之眼瞎掉！' },
      { speaker: '你', text: '刘兄，B王这是被你沉默出心理阴影了。' },
      { speaker: '刘雪沛', text: '执迷不悟。破妄之眼所见，皆是因果。B王，你的下次，本座已看穿。' }
    ]
  },
  {
    id: 12,
    title: '第十二章 · 后发制人',
    desc: '刘佳伟稳如泰山，后发制人',
    unlockChar: 'liujiawei',
    playerChar: 'liujiawei',
    aiDifficulty: 'hard',
    bkingLayer: 4,
    aiChar: 'bking',
    intro: '刘佳伟：稳如泰山，后发制人！',
    winText: 'B王：乌龟战术！本王不服！',
    reward: '解锁刘佳伟',
    introDialog: [
      { speaker: '刘佳伟', text: 'B王，听说你最近又挨了不少打？别急，今日刘某一并替他们讨回来。稳如泰山，后发制人——这是刘某的棋道。' },
      { speaker: 'B王', text: '刘佳伟？就你那"稳如泰山"？哈！本王看你就是怂！后发制人？等本王把你打成筛子，你连发都发不出来！' },
      { speaker: '刘佳伟', text: '怂？哼，刘某这叫"谋定后动"。你急我不急，你乱我不乱，待你力竭之时，便是刘某反击之刻。B王，你今日遇到对手了。' },
      { speaker: '你', text: '刘兄这后发制人，倒是要耐得住性子。B王素来急躁，怕是要被你这"稳"给磨死。' },
      { speaker: '刘佳伟', text: '正是。B王之败，败在急；刘某之胜，胜在稳。棋盘之上，最可怕的不是先手，而是后手——因为你永远猜不到，刘某何时出手。' },
      { speaker: 'B王', text: '哈！装什么高深！本王今日就让你见识——什么叫一力降十会！钻石装+加持，本王就是要硬刚，看你这"后发"能撑几时！' },
      { speaker: '刘佳伟', text: '硬刚？那便刚吧。刘某这泰山之稳，岂是你那点蛮力能撼动？待你攻势用尽，便是刘某收割之时。' },
      { speaker: '你', text: '好！刘兄既有此定力，那便让B王见识——什么叫"以静制动，后发制人"！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '乌龟战术！本王不服！这局不算，本王刚才攻得太急，没发挥好！' },
      { speaker: '刘佳伟', text: '乌龟？哼，刘某这叫"以逸待劳"。攻得急，本就是大忌；你急我不急，胜负已分。B王，你败在心浮，非败在战术。' },
      { speaker: 'B王', text: '少给本王灌鸡汤！本王就是没料到你这么能苟！下次，下次定让你这"泰山"塌下来！' },
      { speaker: '你', text: '刘兄，B王这是被你"苟"出心理阴影了。' },
      { speaker: '刘佳伟', text: '稳者，非苟也。B王若不悟，纵有下次，亦是徒劳。' }
    ]
  },
  {
    id: 13,
    title: '第十三章 · 龙跃九天',
    desc: '袁清山龙跃九天，攻守兼备',
    unlockChar: 'yuanqingshan',
    playerChar: 'yuanqingshan',
    aiDifficulty: 'hard',
    bkingLayer: 5,
    aiChar: 'bking',
    intro: '袁清山：龙跃九天！己方全军攻击+40%！',
    winText: 'B王：龙？在本王面前不过是条虫！',
    reward: '解锁袁清山',
    introDialog: [
      { speaker: '袁清山', text: '龙跃九天！己方全军攻击+40%！B王，今日遇到袁某，算你倒霉——袁某的龙，专治各种显摆！' },
      { speaker: 'B王', text: '袁清山？哈！又来一个不怕死的！本王今日升级到王者装，攻防全部+50%！你以为你那条虫能压住本王？' },
      { speaker: '袁清山', text: '王者装？哼，外物耳。袁某所修，乃是龙道。龙者，能大能小，能升能隐；大则兴云吐雾，小则隐介藏形。B王，你那点显摆，在龙面前不堪一击！' },
      { speaker: '你', text: '袁兄这龙跃九天，气势惊人。B王这次怕是真遇到对手了。' },
      { speaker: '袁清山', text: '兄弟过誉。龙道非一人之道，乃天地之道。今日这一局，袁某不为私名，只为让B王知道——天外有天，人外有人，龙外有龙！' },
      { speaker: 'B王', text: '哈！天外有天？本王就是天！王者装加持，技能全开——"reverse"、"confuse"、"seize"、"swap"四个主动全解锁！你以为你那条虫能扛住本王四连击？' },
      { speaker: '袁清山', text: '四连击？那便来吧。龙跃九天，攻守兼备——你攻袁某守，你退袁某追。B王，今日你的"王者"之名，怕是要易主了！' },
      { speaker: '你', text: '好！袁兄既有此气魄，那便让B王见识——什么叫"龙跃九天，气吞万里"！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '龙？在本王面前不过是条虫！这局不算，本王刚才……刚才王者装没适应好，手感差！' },
      { speaker: '袁清山', text: '手感差？哼，袁某的龙跃九天，全军攻击+40%，你那点"手感差"，掩盖不了实力的差距。B王，承认吧——你已经输不起了。' },
      { speaker: 'B王', text: '放屁！本王就是状态不好！王者装才刚上手，下次，下次定让你这"龙"变成"虫"！' },
      { speaker: '你', text: '袁兄，B王这是被你打怕了，连借口都开始重复了。' },
      { speaker: '袁清山', text: '龙跃九天，威慑四方。B王若不悟，纵有万次下次，亦是徒劳。' }
    ]
  },
  {
    id: 14,
    title: '第十四章 · 连斩破甲',
    desc: '罗伦杰无尽连斩，破甲突袭',
    unlockChar: 'luolunjie',
    playerChar: 'luolunjie',
    aiDifficulty: 'hard',
    bkingLayer: 5,
    aiChar: 'bking',
    intro: '罗伦杰：无尽连斩！破甲突袭！',
    winText: 'B王：连斩？本王下次必胜！',
    reward: '解锁罗伦杰',
    introDialog: [
      { speaker: '罗伦杰', text: 'B王，今日便是你的另一个开始。无尽连斩，破甲突袭——罗某这一刀，斩的不仅是你的棋，更是你这十三局显摆的因果！' },
      { speaker: 'B王', text: '罗伦杰！你这不知死活的家伙！本王王者装加持，技能全开，今日就让你见识——什么叫真正的"王者"！' },
      { speaker: '罗伦杰', text: '王者？哈！十三局下来，你哪一局不是输？哪一局不是找借口？B王，今日罗某便让你彻底认清——你不是王者，你只是个嘴硬的输家！' },
      { speaker: '你', text: '罗兄说得好。B王，从第一章到现在，你输了十三次，找了十三次借口。这一次，你还能找什么借口？' },
      { speaker: 'B王', text: '你们！哼！本王就是状态不好！本王就是手感差！本王就是……就是……' },
      { speaker: '罗伦杰', text: '是什么？B王，说不出话了吧？今日罗某这一战，只为让你见识什么叫"破甲"！' },
      { speaker: '你', text: 'B王，继续装吧。还有后来人等着收拾你！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '……这局不算！本王刚才没适应王者装！下次定让你斩不动！' },
      { speaker: '罗伦杰', text: 'B王，你这借口都用了多少次了？连斩已破你的甲，你还在装！' },
      { speaker: 'B王', text: '哼！本王还有后手！本王还有更厉害的形态！你们等着，本王会让你们见识什么叫真正的"人性之恶"！' },
      { speaker: '你', text: 'B王这是又找到新借口了——"形态未释放"。看来故事远未结束。' }
    ]
  },
  /* v29: 新增第15-20章 */
  {
    id: 15,
    title: '第十五章 · 内敛深沉',
    desc: '张树灿沉默气场，内敛中暗藏杀机',
    unlockChar: 'zhangshucan',
    playerChar: 'zhangshucan',
    aiDifficulty: 'hard',
    bkingLayer: 4,
    aiChar: 'bking',
    intro: '张树灿：……（沉默地坐下）',
    winText: 'B王：装深沉！有本事说话啊！',
    reward: '解锁张树灿',
    introDialog: [
      { speaker: '张树灿', text: '……' },
      { speaker: 'B王', text: '喂！张树灿！你哑巴了？跟本王对弈就这点气势？装什么深沉！' },
      { speaker: '张树灿', text: '……话多无益，且看此招。' },
      { speaker: '你', text: '张兄话虽少，但每一步都暗藏杀机。B王这次遇到对手了——比深沉，B王可差远了。' },
      { speaker: 'B王', text: '比深沉？本王深沉起来自己都怕！本王就是不说，让你们猜！本王这叫深藏不露！' },
      { speaker: '张树灿', text: '……沉默是金，言语是银。安静，让我思考。' },
      { speaker: '你', text: '看，张兄这才是真深沉。B王那叫装。' }
    ],
    winDialog: [
      { speaker: 'B王', text: '装深沉！有本事说话啊！本王最烦你这种不说话的！' },
      { speaker: '张树灿', text: '……话多无益。沉默失败了，那是我修炼不够。' },
      { speaker: 'B王', text: '看吧！你承认失败了！本王就是赢在气场！本王这气场压制了你！' },
      { speaker: '你', text: 'B王，张兄"修炼不够"是自省，你"气场压制"是意淫。差别大了。' },
      { speaker: '张树灿', text: '……B王，你话太多。下次，让你说不出话。' }
    ]
  },
  {
    id: 16,
    title: '第十六章 · 中庸之道',
    desc: '张毓芝攻守平衡，看似平淡实为大智',
    unlockChar: 'zhangyuzhi',
    playerChar: 'zhangyuzhi',
    aiDifficulty: 'hard',
    bkingLayer: 4,
    aiChar: 'bking',
    intro: '张毓芝：均衡之道，攻守相宜。',
    winText: 'B王：中庸？不过是平庸的借口！',
    reward: '解锁张毓芝',
    introDialog: [
      { speaker: '张毓芝', text: 'B王，听闻你连胜不少同学。今日张某特来讨教——中庸之道，攻守相宜，不偏不倚。' },
      { speaker: 'B王', text: '张毓芝？就你这"中庸"？哈！本王看就是平庸的借口！棋盘上哪有什么平衡，只有碾压！' },
      { speaker: '张毓芝', text: '过刚易折，过柔则弱。B王锋芒太露，必有破绽。今日这一局，张某便让你见识"看似平淡，实则大智"。' },
      { speaker: '你', text: '张兄这中庸之道，倒是别出一格。B王急躁，怕是要被你这"慢工"磨死。' },
      { speaker: 'B王', text: '慢工？本王就是快刀斩乱麻！今日钻石装+加持，本王三招就让你这"中庸"变成"中亡"！' },
      { speaker: '张毓芝', text: '平衡方能持久。B王，且看谁笑到最后。' },
      { speaker: '你', text: '好！张兄既有此定力，那便让B王见识——什么叫"中庸"！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '中庸？不过是平庸的借口！本王刚才太急了，没发挥好！' },
      { speaker: '张毓芝', text: '过犹不及啊。B王，你的急躁，便是你最大的破绽。平衡之道，不在强弱，而在节奏。' },
      { speaker: 'B王', text: '少给本王讲道理！下次，下次本王定让你这"中庸"变成"中亡"！' },
      { speaker: '你', text: '张兄，B王这是被你"平衡"出心理阴影了。' },
      { speaker: '张毓芝', text: '中庸也有失效时。但愿B王能悟。' }
    ]
  },
  {
    id: 17,
    title: '第十七章 · 搞子突袭',
    desc: '刘锋玩世不恭，乱来也是一种艺术',
    unlockChar: 'liufeng',
    playerChar: 'liufeng',
    aiDifficulty: 'hard',
    bkingLayer: 5,
    aiChar: 'bking',
    intro: '刘锋：嘿嘿，搞一下子！',
    winText: 'B王：搞子？本王让你哭出来！',
    reward: '解锁刘锋',
    introDialog: [
      { speaker: '刘锋', text: '嘿嘿，B王，听说你又显摆了？让刘锋来搞一下子！你以为我会按套路？天真！' },
      { speaker: 'B王', text: '刘锋？就你这搞子？整天胡闹的家伙也敢来挑战本王？本王让你见识什么叫真正的碾压！' },
      { speaker: '刘锋', text: '碾压？哈！刘锋我这叫"乱来也是一种艺术"！你永远猜不到我下一步要做什么——我自己都猜不到！' },
      { speaker: '你', text: '刘兄这搞子之术，倒是别出心裁。B王这次怕是要被搞糊涂。' },
      { speaker: '刘锋', text: '搞糊涂是第一步！接下来还要搞乱你的棋子位置，搞乱你的buff，搞乱你的心态！看好了，这叫搞子！' },
      { speaker: 'B王', text: '哼！王者装加持，本王就是不怕搞！你搞得了本王？本王让你见识——什么叫"以不变应万变"！' },
      { speaker: '刘锋', text: '不变？那正好，本搞子专治各种"不变"！嘿嘿，搞一下子！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '搞子？本王让你哭出来！这局不算，本王被你这破搞子扰了心智！' },
      { speaker: '刘锋', text: '嘿嘿，扰了心智也是输啊！B王你借口真多！' },
      { speaker: 'B王', text: '哼！你以为本王真的怕你那点搞子？下次，下次定让你这搞子变成"被搞"！' },
      { speaker: '你', text: 'B王，你这是被刘兄"搞"出心理阴影了。"被搞"，听起来就惨。' },
      { speaker: '刘锋', text: '哈哈！B王你这套词儿都用烂了！要不要刘锋给你搞个新剧本？' }
    ]
  },
  {
    id: 18,
    title: '第十八章 · 传说觉醒',
    desc: '布罗利传说赛亚人，气之压制无可匹敌',
    unlockChar: 'broly',
    playerChar: 'broly',
    aiDifficulty: 'hard',
    bkingLayer: 5,
    aiChar: 'bking',
    intro: '布罗利：啊！！！气之压制！',
    winText: 'B王：传说？不过是传说罢了！',
    reward: '解锁布罗利',
    introDialog: [
      { speaker: '布罗利', text: '啊！！！气之压制！本座传说赛亚人，今日要让你见识真正的力量！' },
      { speaker: 'B王', text: '布罗利？就你那点蛮力？哈！本王王者装加持，技能全开！你以为你的气能压住本王？' },
      { speaker: '布罗利', text: '传说！本座越战越强！你以为你那点显摆能挡住本座的气？天真！' },
      { speaker: '你', text: '布罗利力量之强，怕是B王这次真要栽了。气之压制可是无视防御的。' },
      { speaker: '布罗利', text: '暴动！让本座一拳打爆你的显摆！' },
      { speaker: 'B王', text: '哼！本王就是不怕蛮力！王者装+加持，本王今日让你这传说变成笑话！' },
      { speaker: '布罗利', text: '笑话？那就来吧！本座让你见识——什么叫传说！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '传说？不过是传说罢了！这局不算，本王刚才没适应你的气！' },
      { speaker: '布罗利', text: '啊！！！气之压制！本座的力量，岂是你能适应的？' },
      { speaker: 'B王', text: '哼！你以为本王真的怕你那点气？下次，下次本王定让你这传说终结！' },
      { speaker: '你', text: 'B王，被力量碾压还找借口，你也真是个人才。' },
      { speaker: '布罗利', text: '气之压制！本座越战越强！B王，下次依旧是你输！' }
    ]
  },
  {
    id: 19,
    title: '第十九章 · 铁血独裁',
    desc: '帝国元首闪电战，铁血独裁碾压一切',
    unlockChar: 'empire',
    playerChar: 'empire',
    aiDifficulty: 'hard',
    bkingLayer: 6,
    aiChar: 'bking',
    intro: '帝国元首：闪电战！全军出击！',
    winText: 'B王：独裁？在本王面前不过是把戏！',
    reward: '解锁帝国元首',
    introDialog: [
      { speaker: '帝国元首', text: '闪电战！全军出击！生存空间，吾等必取！B王，今日遇到本元首，算你倒霉！' },
      { speaker: 'B王', text: '帝国元首？哈！又来一个显摆的家伙！本王王者装+加持，攻防全部+70%！你以为你的闪电战能压住本王？' },
      { speaker: '帝国元首', text: '王者装+？哼，外物耳。本元首所修，乃是铁血纪律！第三帝国光环加持，全军防御+20，HP+30！你以为你的显摆能挡住本元首的铁骑？' },
      { speaker: '你', text: '帝国元首这铁血独裁，倒是别有风格。B王这次遇到真正的"显摆高手"了——比显摆，元首可不输B王。' },
      { speaker: '帝国元首', text: '元首令已下，绝不退缩！本元首今日便让你这"B王"见识——什么叫真正的"王者之气"！' },
      { speaker: 'B王', text: '王者之气？本王就是王者！你敢跟本王比？今日就让你这元首跪地求饶！' },
      { speaker: '帝国元首', text: '哈！本元首让你见识——什么叫闪电战的真正威力！' },
      { speaker: '你', text: '好！元首既有此气魄，那便让B王见识——什么叫"铁血独裁"！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '独裁？在本王面前不过是把戏！这局不算，本王刚才被你的"闪电"晃了一下！' },
      { speaker: '帝国元首', text: '闪电战，从来不留余地。B王，你的失败是必然的，与"晃眼"无关。柏林终究陷落，但今日陷落的是你！' },
      { speaker: 'B王', text: '少给本王灌鸡汤！本王就是状态不好！下次，下次定让你这"帝国"覆灭！' },
      { speaker: '你', text: '元首，B王这是被你"闪电"出心理阴影了。' },
      { speaker: '帝国元首', text: '铁血纪律，不容败绩。B王，你的下次，本元首已看穿。' }
    ]
  },
  {
    id: 20,
    title: '终章 · 双仙帝合战B王',
    desc: '仙帝Alice与大爱仙尊联手，B王6层仙帝装',
    unlockChar: 'alice',
    playerChar: 'alice',
    aiDifficulty: 'hard',
    bkingLayer: 7,
    aiChar: 'bking',
    intro: '仙帝Alice：凡俗蝼蚁，敢挡仙帝之威？大爱仙尊：众生皆可为我所用。',
    winText: 'B王：……本王认输。',
    reward: '解锁仙帝Alice + 大爱仙尊',
    introDialog: [
      { speaker: '仙帝Alice', text: 'B王，你这"人性之恶"的化身，今日便是你的终局。本座仙帝Alice，独门仙法「天罚」，剥夺你的最强子，命定你的3步路线！' },
      { speaker: '大爱仙尊', text: '众生皆可为我所用。B王，你这"显摆之王"，今日遇到本仙尊，算你倒霉——大爱无疆，不过是弱者的墓志铭！' },
      { speaker: 'B王', text: '仙帝Alice？大爱仙尊？两个显摆的家伙一起来？哈！本王今日升级到6层仙帝装，攻防全部+100%！你以为你们的仙法能压住本王？本王就是反面特质之极——傲慢、贪婪、愚蠢、爱显摆、自视清高！' },
      { speaker: '仙帝Alice', text: '凡夫俗子，敢挡仙帝之威？本座一念，尔等皆跪！' },
      { speaker: '大爱仙尊', text: '算计，是强者的特权。B王，你的"人性之恶"，在本仙尊面前不过是小聪明！' },
      { speaker: '你', text: 'B王，从第一章到现在，你输了十九次，找了十九次借口。这一次，两位仙帝联手，你还能找什么借口？' },
      { speaker: 'B王', text: '你们！哼！本王就是状态不好！本王就是手感差！本王就是……就是……' },
      { speaker: '仙帝Alice', text: '是什么？B王，说不出话了吧？天罚已降，无可更改！' },
      { speaker: '大爱仙尊', text: '你的价值，到此为止。本仙尊便让你彻底认清——你不是王者，你只是个嘴硬的输家！' },
      { speaker: '你', text: 'B王，今日便是你的终局。十九局的因果，今日了结！' }
    ],
    winDialog: [
      { speaker: 'B王', text: '……' },
      { speaker: '你', text: 'B王，怎么不说话了？这一次，又是状态不好？又是手感差？' },
      { speaker: 'B王', text: '……好。本王认输。' },
      { speaker: '仙帝Alice', text: 'B王，你终于说了这句话。十九局了，等的就是你这三个字。' },
      { speaker: 'B王', text: '本王输了。不是输给你们任何一个，是输给自己。这十九局……本王一直在骗自己，骗自己状态不好，骗自己手感差，骗自己下次必胜。其实，本王早就输了，从第一章起，本王就输了。' },
      { speaker: '大爱仙尊', text: '执迷不悟者，纵有万次下次，亦是徒劳。B王，你今日能说出"认输"二字，比赢一百局都强。' },
      { speaker: '你', text: 'B王，认输并不丢人。真正丢人的是，输了还不承认。' },
      { speaker: 'B王', text: '……你们赢了。本王，服了。今后这"王者"之名，便让与你们吧。本王……累了。原来集齐人性之恶，也敌不过真正的实力。' },
      { speaker: '仙帝Alice', text: 'B王，棋盘之上，再无B王显摆，唯有真正的对弈。本座今日，便放你一马。' },
      { speaker: '大爱仙尊', text: '众生皆可为我所用，但你——B王，可以重新开始。' },
      { speaker: '你', text: '好！自此终章，故事完结。但棋道无尽，江湖再见！' }
    ]
  }
];
/* 通关第20章后额外解锁（在 onStoryChapterComplete 中处理）：
   - daaixianzun（大爱仙尊）
   - broly（布罗利）— 第18章已解锁，此处保留兼容
   - empire（帝国元首）— 第19章已解锁，此处保留兼容
   - bking（B王）
   - alice（仙帝Alice）— 第20章已解锁，此处保留兼容 */

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
  daaixianzun: { pitch: 0.68, rate: 0.8,  lang: 'zh-CN' },
  broly:       { pitch: 0.55, rate: 0.85, lang: 'zh-CN' },
  empire:      { pitch: 0.78, rate: 1.05, lang: 'zh-CN' },
  zhangshucan: { pitch: 0.85, rate: 0.85, lang: 'zh-CN' },  /* v29: 内敛沉稳 */
  zhangyuzhi:  { pitch: 1.0,  rate: 0.95, lang: 'zh-CN' },  /* v29: 平和中正 */
  liufeng:     { pitch: 1.1,  rate: 1.2,  lang: 'zh-CN' }    /* v29: 搞子跳脱 */
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
  daaixianzun: { scale: [0,2,4,7,9],   root: 174.61, tempo: 0.68, wave: 'sine',     mood: 'celestial',  motif: 'celestial' },
  broly:       { scale: [0,2,5,7,10],  root: 146.83, tempo: 0.32, wave: 'sawtooth', mood: 'aggressive', motif: 'aggressive' },
  empire:      { scale: [0,2,4,7,11],  root: 196.00, tempo: 0.4,  wave: 'square',   mood: 'imposing',   motif: 'imposing' },
  zhangshucan: { scale: [0,2,3,5,7],   root: 220.00, tempo: 0.62, wave: 'sine',     mood: 'introspective', motif: 'ambient' }, /* v29: 内敛 */
  zhangyuzhi:  { scale: [0,2,4,5,7],   root: 261.63, tempo: 0.55, wave: 'triangle', mood: 'balanced',   motif: 'ambient' }, /* v29: 中庸 */
  liufeng:     { scale: [0,3,5,7,10],  root: 311.13, tempo: 0.38, wave: 'square',   mood: 'playful',    motif: 'energetic' }  /* v29: 搞子 */
};
const MENU_THEME = { scale: [0,2,4,7,9], root: 220.00, tempo: 0.8, wave: 'sine', mood: 'ambient', motif: 'ambient' };

/* ===== 全局暴露（兼容 window 作用域） ===== */
if (typeof window !== 'undefined') {
  window.PIECE_TYPE = PIECE_TYPE;
  window.PIECE_TYPE_NAME = PIECE_TYPE_NAME;
  window.PIECE_STATS = PIECE_STATS;
  window.HERO_TYPE = HERO_TYPE;
  window.HERO_TYPE_BONUS = HERO_TYPE_BONUS;
}
