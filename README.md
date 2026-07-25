# 博弈之王 · 避其锋芒

> 中国象棋 · 角色对战版 — 传统象棋规则 + 角色技能系统 + 兵种相克 + HP/ATK/DEF 战斗体系

单机网页游戏（HTML5 Canvas + 原生 JS），支持 Electron 桌面打包。以「讨伐 B 王」为主线，融合角色技能、兵种相克、buff 系统等战棋元素。

> **项目定位**：个人学习与观赏（非商业）

---

## 文档入口

| 文档 | 路径 | 说明 |
|------|------|------|
| AGENTS.md | `AGENTS.md` | AI 协作代理必读：项目概述、约束、开发规范 |
| 硬性约束.md | `硬性约束.md` | 项目级持久化约束（数值/技能/AI/UI/剧情） |
| 文档中心 | `docs/README.md` | A 级文档体系 MOC（架构/技能/流程/防幻觉） |
| 修改记录 | `项目修改记录.md` | 各版本修改记录（最新置顶，v22+ 保留主文件） |

---

## 特性

- **角色阵容**：当前 `Object.keys(CHARACTERS).length` 位角色（24 位）—— 每位角色 3 主动（选 1）+ 2 被动（选 1），技能选择影响战局
- **HP/ATK/DEF 战斗体系**：棋子有血量/攻击/防御，仅进攻方掉血，兵种相克影响伤害
- **五大兵种相克**：核心 / 进攻 / 远程 / 防守 / 特殊，相生相克
- **B王三难度 AI**：青铜 / 钻石 / 王者（对应 easy/medium/hard），技能与思考深度逐级递增；故事模式另有 7 层递进（`BKING_LAYERS`，对应 1/2/3/4/5/5+/6 层）
- **六大游戏模式**：PVE / PVP / 故事模式 / 阵营模式 / 三英战B王 / 4v4（封闭）
- **Dota2 风格被动系统**：光环 / 被吃 / 吃子 / 周期 / 首回合 / 免疫 六大触发类型
- **程序化 BGM + SFX**：Web Audio API 合成，无外部音频文件
- **水墨美学 UI**：Ma Shan Zheng 字体 + 水墨主题 + 印章元素

---

## 快速开始

### 网页版

```bash
# 1. 启动本地服务器
python3 server.py

# 2. 浏览器访问
open http://localhost:8090
```

### 桌面应用（Electron）

```bash
# 安装依赖
npm install

# 本地运行
npm start
```

---

## 游戏模式

| 模式 | 说明 | 状态 |
|------|------|------|
| PVE | 玩家 vs B王（三难度：青铜/钻石/王者） | 故事模式通关后解锁 |
| PVP | 双人对战 + Ban位 | 始终开放 |
| 故事模式 | `STORY_CHAPTERS.length` 章（20 章），角色逐步解锁 | 初始仅 3 角色 |
| 阵营模式 | 多色阵营互相攻伐 | 开放 |
| 三英战B王 | 3 武将 vs 强化 B王 | 开放 |
| 4v4 | 4 人对战 | 暂时封闭（显示"即将开放"） |

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | 原生 JS (ES5+) | 无框架，无构建工具 |
| 渲染 | HTML5 Canvas | 棋盘与棋子绘制 |
| UI | HTML + CSS | 弹窗、HUD、选将屏（水墨主题） |
| 头像 | 内联 SVG | `js/portrait.js` 生成，无外部 API |
| 音频 | Web Audio API | BGM / 音效 / 语音程序化合成 |
| 桌面端 | Electron | `main.js` / `preload.js` / `package.json` |
| 数据存储 | localStorage | 存档、进度、教程完成状态 |

**禁止引入**：React/Vue 等框架、构建工具（Webpack/Vite）、外部图片 API。

---

## 文件结构

```
中国象棋/
├── index.html          # 主页面 DOM 结构
├── game.js             # 游戏主逻辑（状态/流程/渲染/UI 事件）
├── style.css           # 全局样式（水墨主题）
├── main.js             # Electron 主进程
├── preload.js          # Electron 预加载
├── package.json        # 打包配置
├── server.py           # 本地开发服务器
├── AGENTS.md           # AI 协作代理必读
├── 硬性约束.md          # 项目级持久化约束
├── 项目修改记录.md      # 各版本修改记录
├── js/
│   ├── data.js         # 数据层：常量 / 多角色（动态）/ 技能 / 阵营 / 故事章节
│   ├── engine.js       # 引擎层：棋盘逻辑 / AI / 伤害结算 / 合并工具
│   ├── skills.js       # 技能层：被动触发 / 复活 / 召唤 / 光环
│   ├── portrait.js     # SVG 头像生成
│   └── audio.js        # BGM / 音效 / 语音
├── docs/               # A 级文档体系
│   ├── README.md       # 文档中心 MOC
│   ├── HARD_CONSTRAINTS.md   # 硬约束总纲
│   ├── ARCHITECTURE.md       # 模块化架构
│   ├── SELF_LEARNING.md      # 自我学习机制（v37 三阶模型）
│   ├── UI_SELF_AUDIT.md      # UI 自我审查（v36）
│   ├── USER_FEEDBACK.md      # 用户反馈档案（v37）
│   ├── ANTI_HALLUCINATION.md # 防幻觉审查清单
│   ├── CHANGE_PROCESS.md     # 变更流程规范
│   ├── SKILL_RAG.md          # 技能 RAG 注册表
│   └── archive/              # 历史归档
│       └── 2026-07/          # 按月份归档
└── .trae/specs/        # 版本规格文档
```

**加载顺序**（index.html 中）：`data.js → engine.js → skills.js → portrait.js → audio.js → game.js`

> 注意：`skills.js` 在 `portrait.js` 之前加载（技能系统依赖引擎，头像生成独立）。

---

## 核心数据结构

### 棋子属性（PIECE_STATS）

> 源自 `js/data.js`，与 `硬性约束.md` 第一节完全同步。以下数值与代码一致：

```js
const PIECE_STATS = {
  k: { hp: 260,  atk: 50,  def: 55, type: 'core' },      // 帅/将 — 指挥核心
  r: { hp: 110,  atk: 80,  def: 10, type: 'striker' },   // 车 — 玻璃大炮
  h: { hp: 120,  atk: 72,  def: 20, type: 'striker' },   // 马 — 刺客
  c: { hp: 80,   atk: 65,  def: 12, type: 'remote' },    // 炮 — 远程
  a: { hp: 100,  atk: 30,  def: 75, type: 'defender' },  // 仕/士 — 贴身护卫
  e: { hp: 100,  atk: 35,  def: 65, type: 'defender' },  // 相/象 — 远程支援
  p: { hp: 110,  atk: 55,  def: 15, type: 'special' }    // 兵/卒 — 特殊战士
};
```

### 兵种相克规则（calcDamage）

- **炮(远程) 打 非远程**：炮不掉血
- **兵(特殊) 受 非帅攻击**：只受 50% 伤害
- **非炮 打 相/士(防守)**：攻击方获「虚弱」buff（下回合攻击 -30%）
- **兵 打 帅(核心)**：+50% 伤害
- **车/马(进攻) 攻击**：无视防守方 30% 防御（破甲）

### 角色结构

```js
{
  name, char, title, color, glow, desc,
  stats: { atk, def, int },     // 角色属性加成（charAtk/charDef 注入棋子）
  faction: 'strategist'|'brother'|'immortal'|'bking',
  skill: { id, name, desc, cd, target },  // 默认第1主动技能（兼容）
  actives: [...3个],              // 3 个主动技能（选1）
  passives: [...2个],            // 2 个被动技能（选1）
  skillLines, loseLines, speech  // 台词
}
```

---

## AI 难度系统

### PVE 三难度（DIFFICULTIES）

> 数值与 `js/data.js` 中 `DIFFICULTIES` 常量完全同步；难度面板标题由 `BKING_DIFFICULTY_HEADER` 动态注入。

| 难度 key | 名称 | 装备 | 思考深度 (depth) | 技能使用概率 (skillChance) |
|---------|------|------|-----------------|---------------------------|
| easy | 青铜装 | 青铜 | 3 | 30% |
| medium | 钻石装 | 钻石 | 4 | 45% |
| hard | 王者装 | 王者 | 5 | 60% |

### 故事模式 7 层递进（BKING_LAYERS）

故事模式中 B王 有 7 层递进形态（`Object.keys(BKING_LAYERS).length` = 7，JS key 为 1~7，对内显示标签为 1层/2层/3层/4层/5层/5+层/6层）：

| 层级 key | 显示标签 | 装备 | 属性加成 (hp/atk/def) | 思考深度 | 技能使用概率 | 主动技能（七宗罪） | 章节 |
|---------|---------|------|----------------------|---------|-------------|-------------------|------|
| 1 | 1层 | 青铜装 | ×1.0 | 2 | 30% | 傲慢 | 1-3 |
| 2 | 2层 | 青铜装+ | ×1.1 | 2 | 35% | 傲慢, 贪婪 | 4-6 |
| 3 | 3层 | 钻石装 | ×1.2 | 3 | 45% | 傲慢, 贪婪, 懒惰 | 7-9 |
| 4 | 4层 | 钻石装+ | ×1.3 | 3 | 55% | + 嫉妒 | 10-12, 15-16 |
| 5 | 5层 | 王者装 | ×1.5 | 4 | 70% | + 暴怒 | 13-14, 17-18 |
| 6 | 5+层 | 王者装+ | ×1.7 | 4 | 80% | + 暴食 | 19 |
| 7 | 6层 | 仙帝装 | ×2.0 | 5 | 90% | 全部七宗罪 | 20 |

### 三英战 B王（THREE_HEROES_BKING）

| 字段 | 值 | 说明 |
|------|-----|------|
| depth | 8 | 极深思考 |
| skillChance | 0.85 | 高频技能 |
| comboTurns | 4 | 每 4 回合连环双杀 |
| revengeChance | 0.30 | 30% 反击概率 |
| passives | 5 个 | 傲慢光环 / 厚颜无耻 / 王者气场 / 连环双杀 / 反击 |

5 个被动默认全部发动，且可与三英玩家方被动同时叠加。

---

## 击败 B王 攻略

### S+ 级核心克制角色

> 源自 `硬性约束.md` 第三节「最强角色约束（不可削弱）」。S+ 级共 5 位，属性上限 ≤ 95。

| 角色 | 阵营 | 系别 | atk/def/int | 核心技能 | 对 B王 克制点 |
|------|------|------|-------------|---------|--------------|
| 仙帝Alice | immortal | 智力 | 90/88/95 | 仙帝降临（3步回溯+无敌+预判） | 被动「仙帝威压」压制 B王 技能 CD |
| 大爱仙尊（古月方源） | immortal | 智力 | 90/88/95 | 大爱无疆（全屏沉默+复活） | 噬蛊祭道真实伤害，感化敌方最强子 |
| 通天教主 | immortal | 智力 | 88/88/95 | 诛仙剑阵 + 万仙阵 + 紫霄神威 | 截教之主，机制级混元大罗金仙 |
| 布罗利 | brother | 力量 | 95/85/55 | 溢出的气（永久递增） | 力量拉满，野性好战不善谋 |
| 帝国元首 | bking | 智力 | 93/78/90 | 闪电战 + 第三帝国光环 | 全能型，略低于仙帝但高于常规 |

### 克制策略

- **沉默流**：刘雪沛「破妄之眼」沉默 B王 4 回合 + 被动「宿敌」对 B王 伤害 +50%
- **剥夺流**：仙帝Alice「仙帝·天罚」剥夺 B王 强子 + 3 步锁定
- **感化流**：大爱仙尊「大爱无疆」感化 B王 最强子为己用
- **锁控流**：解宇轩「因果律锁」锁定 B王 强子 4 回合

详见游戏内「角色图鉴 → 击败 B王 攻略」。

---

## 打包构建

```bash
# 安装依赖
npm install

# 单平台打包
npm run build:win-x64       # Windows x64
npm run build:win-arm64     # Windows ARM64
npm run build:mac-x64       # macOS Intel
npm run build:mac-arm64     # macOS Apple Silicon
npm run build:linux-x64     # Linux x64
npm run build:linux-arm64   # Linux ARM64

# 全平台打包（需在对应平台执行交叉编译可能受限）
npm run build:all
```

打包产物输出到 `dist/` 目录。

---

## 开发规范

- 使用 `'use strict';`
- 函数命名：`camelCase`，常量：`UPPER_SNAKE_CASE`
- 数据结构一致：`{r, c}` 表示坐标（禁止 `{row, col}` 混用）
- 移动操作：`{from:{r,c}, to:{r,c}}`
- **禁止硬编码**（v36）：所有 UI 文案/数值/数量必须从 `data.js` 常量动态读取
- 修改后运行 `node -c` 校验所有 JS 文件

```bash
node -c js/data.js && node -c js/engine.js && node -c js/skills.js && \
node -c js/portrait.js && node -c js/audio.js && node -c game.js
```

完整开发规范见 `AGENTS.md` 与 `docs/README.md`。

---

## 版本历史

> 完整记录见 `项目修改记录.md`（最新置顶）。v5-v21 已归档至 `docs/archive/2026-07/`。

- **v38-release-audit** — 发布前交叉审核与校准（4 P0 修复 + 全局评估）
- **v37-self-learning-enhanced** — 自我学习机制增强（三阶模型：学习→应用→进化）
- **v36-anti-hardcode** — 前端动态化 + 自我审查 + 自我学习机制
- **v36-balance** — 全面平衡性测试与数值集体下降（S+ 上限 ≤ 95）
- **v35-deep-bug-fix** — 诛仙剑阵深度 bug 评测修复（3 P0 + 2 P1 + 2 P2）
- **v35-docs-system** — A 级文档体系 + 诛仙剑阵四剑齐出 + 紫霄神威改名
- **v34-tongtian-passives-complete** — 通天教主 5 被动全实现 + 因果逆转删除
- **v34-tongtian-mechanic** — 通天教主重构为机制级混元大罗金仙
- **v34-tongtian-jiejiao** — 新增通天教主（截教之主，全角色最强）
- **v33-deep-skill-weather-fix** — 深度检查与技能/天气/Bug 修复
- **v31-layout-weather-highlight-story** — UI 布局 + 天气系统 + 技能高亮 + 故事剧情
- **v30-comprehensive-rework** — 综合大重构（Phase 1-2，七宗罪体系）
- **v30-skill-desc-and-bugfix** — 技能描述修正与深度 Bug 修复
- **v30-english-id-leak-fix** — 英文 ID 泄露修复与业务逻辑收尾
- **v29-balance-and-expansion** — 平衡性调整与角色扩展
- **v28-comprehensive-rebalance** — 综合评估与全面差异化重构
- **v27-hero-rebalance** — 英雄类型加成重新平衡
- **v25-buff-state-reset-fix** — P1 buff 系统与状态重置 Bug 修复
- **v24-rebalance-and-new-chars** — 数值平衡重构 + 新增角色 + 谋属性系统
- **v23-p2-battlelog-fix** — P2 级 Bug 修复（技能战报补全）
- **v22-skill-deep-bug-fix** — 技能系统深度 Bug 检测与修复
- **v22** — PVP 黑方技能链路修复 / 战斗日志系统 / 预测类被动改造等多轮迭代
- **v20-v21** — 已归档（见 `docs/archive/2026-07/项目修改记录-v5-v21.archive.md`）

---

## License

MIT

> **项目定位**：个人学习与观赏（非商业）。所有角色形象、技能设计、剧情文本均为学习创作，不用于任何商业用途。

---

> 以退为进 · 以柔克刚
