# AGENTS.md — 博弈之王（中国象棋）项目指南

> 本文件为 AI 协作代理（Codex / Claude / Trae 等）提供项目上下文、约束与开发规范。
> 任何代理在修改本项目前 **必须** 先阅读本文件。

---

## 项目概述

**项目名称**：博弈之王（中国象棋 · 角色对战版）
**项目类型**：单机网页游戏（HTML5 Canvas + 原生 JS），支持 Electron 桌面打包
**核心玩法**：传统中国象棋规则 + 角色技能系统 + 兵种相克 + HP/atk/def 战斗体系
**目标用户**：个人学习与观赏（非商业）

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | 原生 JS (ES5+) | 无框架，无构建工具 |
| 渲染 | HTML5 Canvas | 棋盘与棋子绘制 |
| UI | HTML + CSS | 弹窗、HUD、选将屏 |
| 头像 | 内联 SVG | `js/portrait.js` 生成，无外部 API |
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
├── js/
│   ├── data.js         # 数据层：常量 / 18角色 / 技能 / 阵营 / 故事章节
│   ├── engine.js       # 引擎层：棋盘逻辑 / AI / 伤害结算 / 合并工具
│   ├── skills.js       # 技能层：被动触发 / 复活 / 召唤 / 光环
│   ├── portrait.js     # SVG 头像生成
│   └── audio.js        # BGM / 音效 / 语音
├── .trae/specs/        # 版本规格文档（v5~v10）
├── 设计文档.md          # 早期设计文档
├── 设计文档v4.md        # v4 设计文档
├── 项目修改记录.md      # 各版本修改记录
└── AGENTS.md            # 本文件
```

**加载顺序**（index.html 中）：`data.js → engine.js → skills.js → portrait.js → audio.js → game.js`

---

## 核心数据结构

### 棋子属性（PIECE_STATS）
```js
const PIECE_STATS = {
  k: { hp: 300,  atk: 25,  def: 30, type: 'core' },      // 帅/将
  r: { hp: 180,  atk: 60,  def: 20, type: 'striker' },    // 车
  h: { hp: 150,  atk: 50,  def: 18, type: 'striker' },    // 马
  c: { hp: 120,  atk: 55,  def: 12, type: 'remote' },     // 炮
  a: { hp: 100,  atk: 15,  def: 35, type: 'defender' },   // 仕/士
  e: { hp: 100,  atk: 15,  def: 35, type: 'defender' },   // 相/象
  p: { hp: 200,  atk: 45,  def: 10, type: 'special' }     // 兵/卒
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

## 游戏模式

| 模式 | 说明 | 状态 |
|------|------|------|
| PVE | 玩家 vs B王（3难度） | 故事模式通关后解锁 |
| PVP | 双人对战 + Ban位 | 始终开放 |
| 故事模式 | 7章节，角色逐步解锁 | 初始仅3角色 |
| 阵营模式 | 多色阵营互相攻伐 | 开放 |
| 三英战B王 | 3武将 vs 强化B王 | 开放 |
| 4v4 | 4人对战 | 暂时封闭（显示"即将开放"） |

---

## 硬约束（不可违反）

1. **AI（B王）3 难度**：初心/进阶/宗师，技能与思考深度差异明显
2. **仙帝Alice 最强**：所有角色中技能最强，有仙帝压迫感
3. **三金 避其锋芒**：技能需体现进攻性与兄弟义气
4. **B王 阵营移除鸡哥**：B王主动技能 5 个
5. **技能单体定向**：默认只针对一个玩家，全范围技能除外
6. **角色属性影响战斗**：charAtk/charDef/10 作为棋子加成
7. **血量 3 位数**：避免游戏节奏过慢（v9 已回调）
8. **被动技能必须生效**：所有触发类型（ON_CAPTURE/ON_CAPTURED/AURA/IMMUNE/PERIODIC）需实际应用
9. **选将技能选择必须生效**：3 主动选 1 + 2 被动选 1，选择结果影响游戏
10. **棋子合并影响血量**：技能触发合并时 HP 叠加（engine.js mergePieces）

---

## 工程规范

### 代码风格
- 使用 `'use strict';`
- 函数命名：`camelCase`
- 常量命名：`UPPER_SNAKE_CASE`
- 数据结构一致：`{r, c}` 表示坐标（禁止 `{row, col}` 混用）
- 移动操作：`{from:{r,c}, to:{r,c}}`

### 模块职责
- `data.js`：只放数据，不放逻辑
- `engine.js`：棋盘逻辑、AI、伤害结算、合并工具
- `skills.js`：被动触发、复活、召唤、光环
- `game.js`：状态管理、流程控制、渲染、UI 事件

### 教训（Lessons Learned）
- 属性名不一致（`to:{row,col}` vs `to:{r,c}`）导致 AI 移动失败
- `calcDamage` 返回值 attackerDmg/defenderDmg 应用反了导致炮自杀
- 操作菜单拦截 selectPiece 导致点击棋子无响应
- 被动技能 case 未补全导致不生效
- **选将技能选择未读取 state.playerActiveSkill 导致选择无效**

---

## 版本规格文档

所有重大改动 **必须** 在 `.trae/specs/<version>/` 创建规格文档：
- `spec.md`：需求规格（Why / What Changes / Impact / Scenarios）
- `tasks.md`：任务分解
- `checklist.md`：验证清单

当前版本：
- v5-overhaul：大规模功能扩展
- v6-final-fixes：最终修复
- v7-rebalance：兵种平衡性重构
- v8-critical-fixes：恶性 Bug 修复
- v9-detail-fixes：细节修复与文档化
- **v10-skill-redesign**：技能重设计（适配 HP/atk/def 战斗体系）

---

## 测试与验证

```bash
# 语法校验所有 JS 文件
node -c js/data.js && node -c js/engine.js && node -c js/skills.js && \
node -c js/portrait.js && node -c js/audio.js && node -c game.js

# 本地开发服务器
python3 server.py

# Electron 打包
npm run build:mac
```

---

## 代理协作流程

1. **阅读本文件** 了解项目约束
2. **阅读 `项目修改记录.md`** 了解历史改动
3. **阅读 `.trae/specs/` 最新版本** 了解当前任务
4. **修改前先创建规格文档**（如涉及重大改动）
5. **修改后更新 `项目修改记录.md`**
6. **运行 `node -c` 校验** 所有修改的 JS 文件
