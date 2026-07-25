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
│   ├── data.js         # 数据层：常量 / 多角色（动态）/ 技能 / 阵营 / 故事章节
│   ├── engine.js       # 引擎层：棋盘逻辑 / AI / 伤害结算 / 合并工具
│   ├── skills.js       # 技能层：被动触发 / 复活 / 召唤 / 光环
│   ├── portrait.js     # SVG 头像生成
│   └── audio.js        # BGM / 音效 / 语音
├── .trae/specs/        # 版本规格文档（v5+，按版本归档）
├── docs/               # A 级文档体系（架构/技能/流程/防幻觉/归档）
│   └── archive/        # 历史归档（按月份组织）
├── 硬性约束.md          # 项目级持久化约束
├── 项目修改记录.md      # 各版本修改记录（v22+ 保留主文件）
└── AGENTS.md            # 本文件
```

**加载顺序**（index.html 中）：`data.js → engine.js → skills.js → portrait.js → audio.js → game.js`

---

## 核心数据结构

### 棋子属性（PIECE_STATS）
```js
// v38 发布前校准：与 data.js / 硬性约束.md 第一节完全同步
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

## 游戏模式

| 模式 | 说明 | 状态 |
|------|------|------|
| PVE | 玩家 vs B王（3难度） | 故事模式通关后解锁 |
| PVP | 双人对战 + Ban位 | 始终开放 |
| 故事模式 | 20章节，角色逐步解锁 | 初始仅3角色 |
| 阵营模式 | 多色阵营互相攻伐 | 开放 |
| 三英战B王 | 3武将 vs 强化B王 | 开放 |
| 4v4 | 4人对战 | 暂时封闭（显示"即将开放"） |

---

## 硬约束（不可违反）

1. **AI（B王）3 难度**：青铜/钻石/王者（对应 easy/medium/hard），技能与思考深度差异明显；故事模式另有 7 层递进（BKING_LAYERS）
2. **仙帝Alice 最强**：所有角色中技能最强，有仙帝压迫感
3. **三金 避其锋芒**：技能需体现进攻性与兄弟义气
4. **B王 阵营移除鸡哥**：B王主动技能扩展至 7 个（七宗罪：傲慢/嫉妒/暴怒/懒惰/贪婪/暴食/色欲）
5. **技能单体定向**：默认只针对一个玩家，全范围技能除外
6. **角色属性影响战斗**：charAtk/charDef/10 作为棋子加成
7. **血量 3 位数**：避免游戏节奏过慢（v9 已回调）
8. **被动技能必须生效**：所有触发类型（ON_CAPTURE/ON_CAPTURED/AURA/IMMUNE/PERIODIC）需实际应用
9. **选将技能选择必须生效**：普通角色主动选1+被动选1；B王主动选3+被动选2；通天教主被动5选2
10. **棋子合并影响血量**：技能触发合并时 HP 叠加（engine.js mergePieces）
11. **禁止硬编码（v36 新增）**：所有 UI 文案/数值/数量必须从 data.js 常量动态读取，详见 [[UI_SELF_AUDIT]]
12. **自我学习（v36 新增）**：每次修改后必须按 [[SELF_LEARNING]] 流程校验，发现幻觉立即纠错
13. **自我学习增强（v37 新增）**：自我学习从单次 PDCA 升级为「学习→应用→进化」三阶模型
    - 会话启动必读：RAG 教训 + 近 7 天修改记录 + [[USER_FEEDBACK]] 用户反馈档案 + 归档教训 + 硬约束最新版
    - 同类错误复发 ≥ 2 次 → 自动触发规则进化（生成新约束，无需用户提醒）
    - 检测到用户反馈 → 即时入档 `docs/USER_FEEDBACK.md`，并同步到对应硬约束
    - 任务完成后执行模式识别扫描 + 更新量化指标（错误率/复发率/主动发现率等）
    - 每 3 个任务后执行预防性全项目扫描，主动发现并报告问题
14. **用户反馈档案（v37 新增）**：所有用户偏好/约束/纠正持久化到 `docs/USER_FEEDBACK.md`，会话启动时必读

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

当前最新版本：
- v38-release-audit：发布前交叉审核与校准
- v37-self-learning-enhanced：自我学习机制增强
- v36-anti-hardcode：前端动态化+自我审查+自我学习机制

历史版本归档：
- v5-v29 的规格文档归档于 docs/archive/（按需查阅）
- v30+ 的修改记录见 项目修改记录.md

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
