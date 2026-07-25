---
created: 2026-07-25
type: architecture
level: A
tags: [architecture, module, refactor, boundary]
---

# 模块化架构

> **A级文档** — 文件职责、依赖关系、细分建议。
> 游戏规模增长后，模块需细分以保持可维护性。

## 📦 当前架构

### 加载顺序（index.html）

```
data.js → engine.js → skills.js → portrait.js → audio.js → game.js
```

### 文件规模

| 文件 | 行数（估） | 职责 | 问题 |
|------|-----------|------|------|
| `data.js` | ~700 | 数据层 | 角色数据膨胀 |
| `engine.js` | ~850 | 棋盘逻辑/AI | 伤害结算复杂 |
| `skills.js` | ~1600 | 被动/主动扩展 | **过大** |
| `game.js` | ~7800 | **所有UI+流程** | **严重过大** |
| `portrait.js` | ~200 | SVG头像 | 适中 |
| `audio.js` | ~200 | 音频 | 适中 |

---

## 🏗️ 细分建议

### 1. game.js 拆分（优先级：高）

`game.js` 7800行已严重过大，建议拆分为：

```
game/
├── main.js          # 入口 + 全局state定义（~200行）
├── state.js         # 状态管理 + 存档/读档（~400行）
├── render.js        # 棋盘/棋子/HUD渲染（~1500行）
├── ui-screens.js    # 各屏（欢迎/模式/选将/对战/结果）（~1500行）
├── ui-panels.js     # 弹窗（教程/codex/技能详情/ban位）（~1000行）
├── input.js         # 鼠标/键盘事件处理（~600行）
├── turn.js          # 回合流程（advanceToNextPlayer等）（~800行）
├── skills-active.js # 主动技能 case 分支（~1500行）
├── battle-log.js    # 战报系统（~200行）
└── net.js           # 联机对战（~400行）
```

#### 拆分原则
- **按职责拆** — 渲染/输入/流程/技能分开
- **共享 state** — main.js 定义全局state，其他文件引用
- **加载顺序** — main.js 先加载，其他按依赖顺序

#### 迁移策略（渐进式）
1. 先拆出 `skills-active.js`（最独立）
2. 再拆出 `battle-log.js`、`net.js`（独立性强）
3. 再拆出 `render.js`、`ui-screens.js`
4. 最后整合 `main.js` + `state.js`

### 2. skills.js 拆分（优先级：中）

```
skills/
├── passive-triggers.js  # 被动触发分发（passivesOnTurnStart等）
├── passive-impl.js      # 被动实现（triggerPassive switch）
├── active-helpers.js    # 主动技能辅助函数
└── skill-state.js       # skillState + getActivePassives
```

### 3. data.js 拆分（优先级：低）

```
data/
├── constants.js    # 常量（COLS/ROWS/RED/BLACK/T/PALACE等）
├── piece-stats.js  # PIECE_STATS + PIECE_VALUE
├── characters.js   # CHARACTERS（18角色）
├── bking-data.js   # B王专属（DIFFICULTIES/BKING_LAYERS等）
└── story-data.js   # 故事模式章节
```

---

## 📐 模块边界契约

### data.js
```yaml
输入: 无
输出:
  - 常量: COLS, ROWS, RED, BLACK, BLUE, GREEN, T, PALACE
  - 数据: PIECE_STATS, PIECE_VALUE, PIECE_CHAR
  - 角色: CHARACTERS, HERO_TYPE, HERO_TYPE_BONUS
  - 难度: DIFFICULTIES, BKING_LAYERS
  - 故事: STORY_CHAPTERS
  - 触发器: PASSIVE_TRIGGER
禁止:
  - 放任何函数逻辑
  - 引用 state/engine
```

### engine.js
```yaml
输入:
  - data.js 的常量与数据
  - getCharBonus(charId) 读 CHARACTERS
输出:
  - 棋盘操作: createInitialBoard, cloneBoard, applyHandicap
  - 移动逻辑: getLegalMoves, getLegalAIMoves
  - 伤害结算: calcDamage
  - AI: getBestMove, makeMv, undoMv
  - 属性: getPieceEffectiveStats
禁止:
  - 操作 state（除 isAICombatSimulation 标志）
  - 操作 UI/DOM
  - 引用 game.js / skills.js
```

### skills.js
```yaml
输入:
  - data.js 的 PASSIVE_TRIGGER, CHARACTERS
  - engine.js 的 getLegalAIMoves（用于预测）
  - game.js 的 state（通过全局引用）
输出:
  - skillState, passiveState（状态）
  - resetPassives, getActivePassives, getBkingPassives
  - passivesOnTurnStart, passivesOnCapture, passivesOnCaptured
  - tryDodgePassive
  - triggerPassive（被动效果实现）
禁止:
  - 直接操作 DOM
  - 渲染逻辑
依赖:
  - game.js 的 speakTaunt, addBattleLog, highlightPieces, renderAll
  - engine.js 的 addBuff, addTeamBuff, calcDamage
```

### game.js
```yaml
输入:
  - 所有模块
输出:
  - state（全局状态）
  - 渲染: renderAll, renderBoard, renderHUD
  - 流程: startNewGame, advanceToNextPlayer, doMove
  - UI事件: selectPiece, handleClick
  - 技能释放: usePlayerSkill（case 分支）
  - 辅助: addBattleLog, highlightPieces, speakTaunt
禁止:
  - 放纯逻辑（应抽到 engine.js）
  - 放数据（应放到 data.js）
```

---

## 🔗 依赖关系图

```
data.js（无依赖）
  ↓
engine.js（依赖 data.js）
  ↓
skills.js（依赖 data.js + engine.js + game.js[state]）
  ↓
portrait.js（依赖 data.js）
audio.js（无依赖）
  ↓
game.js（依赖所有）
```

### 循环依赖问题

**现状：** `skills.js` 依赖 `game.js` 的 `state/speakTaunt/addBattleLog`，而 `game.js` 依赖 `skills.js` 的 `resetPassives/getActivePassives`。

**解决方案：**
- `skills.js` 通过全局 `state` 引用（不直接 import）
- `game.js` 调用 `skills.js` 的函数（单向）
- 避免在 `skills.js` 中直接调用 `game.js` 的渲染函数（用 `typeof xxx === 'function'` 判断）

---

## 📊 Buff系统概览

详见 [[BUFF_SYSTEM]]，此处仅列概要：

| buff 类型 | 作用 | calcDamage识别 |
|----------|------|---------------|
| weakness | 攻击降低 | ✓ |
| ironwall | 防御翻倍 | ✓ |
| shield | 吸收伤害 | ✓ |
| immune | 免疫伤害 | ✓ |
| silence | 沉默 | ✗（canUseSkill）|
| lock | 禁锢 | ✗（移动检查）|
| defReduce | 破甲 | ✓ |
| vulnerability | 易伤 | ✓ |
| executeMark | 必中标记 | ✓ |
| zhuxianMark | 诛仙剑下亡魂 | ✓ |
| zhuxianIntent | 诛仙剑意 | ✓ |
| goldenImmortal | 金仙之体 | ✓ |
| wanxianBlessing | 万仙加持 | ✓ |
| daoLineage | 道统不灭 | ✓ |

---

## 🎯 重构原则

### 1. 渐进式拆分
- 一次只拆一个模块
- 拆分后立即 `node -c` 校验
- 拆分后回归测试（启动游戏验证）

### 2. 向后兼容
- 拆分后保持全局函数名不变
- 使用 `window.xxx = xxx` 暴露（如需）
- 加载顺序保持不变

### 3. 单一职责
- 每个文件只做一件事
- 函数长度超过200行考虑拆分
- switch case 超过20个考虑分文件

### 4. 依赖注入
- 避免循环依赖
- 共享状态通过全局 state
- 工具函数放 engine.js

---

## ⚠️ 架构红线

| # | 红线 | 后果 |
|---|------|------|
| A1 | data.js 放逻辑 | 数据污染，难以维护 |
| A2 | engine.js 操作 state | AI模拟污染 |
| A3 | skills.js 操作 DOM | 职责混乱 |
| A4 | game.js 放纯逻辑 | 文件膨胀 |
| A5 | 循环依赖未用 typeof 判断 | 加载失败 |

---

相关：[[HARD_CONSTRAINTS]] · [[MODULE_BOUNDARIES]] · [[BUFF_SYSTEM]] · [[CHANGE_PROCESS]]
