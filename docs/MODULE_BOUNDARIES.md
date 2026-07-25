---
created: 2026-07-25
type: spec
tags: [module, boundaries, architecture, todo]
---

# 模块边界（MODULE_BOUNDARIES）

> ⚠️ **待完善** — 本文档为占位文档，内容尚未填充。
> 计划描述各模块（data.js / engine.js / skills.js / portrait.js / audio.js / game.js）的输入输出契约、依赖关系、职责边界。

---

## 待填充内容

### 1. 模块依赖图

计划绘制模块间依赖关系图（谁依赖谁、谁是叶子模块）。

### 2. 各模块输入输出契约

| 模块 | 输入 | 输出 | 依赖 | 被依赖 |
|------|------|------|------|--------|
| `data.js` | （无） | 常量 / CHARACTERS / PIECE_STATS / STORY_CHAPTERS / BKING_LAYERS 等 | （无） | 全部模块 |
| `engine.js` | data.js 常量 | 棋盘逻辑 / AI / calcDamage / mergePieces | data.js | game.js, skills.js |
| `skills.js` | data.js + engine.js | 被动触发 / 复活 / 召唤 / 光环 | data.js, engine.js | game.js |
| `portrait.js` | data.js（角色 color/glow） | SVG 头像字符串 | data.js | game.js |
| `audio.js` | （无） | BGM / SFX / 语音播放接口 | （无） | game.js |
| `game.js` | 全部上述模块 | 状态管理 / 流程控制 / 渲染 / UI 事件 | 全部 | （无，顶层） |

### 3. 职责边界约束

- `data.js` 只放数据，不放逻辑
- `engine.js` 负责棋盘逻辑、AI、伤害结算、合并工具
- `skills.js` 负责被动触发、复活、召唤、光环
- `game.js` 负责状态管理、流程控制、渲染、UI 事件

### 4. 加载顺序

`data.js → engine.js → skills.js → portrait.js → audio.js → game.js`

---

## 完善计划

- [ ] 绘制模块依赖图（Mermaid）
- [ ] 列出每个模块的导出 API 清单
- [ ] 标注跨模块调用的禁止方向（如 data.js 不得调用 game.js）
- [ ] 补充每个模块的「禁止职责」清单

---

相关：[[ARCHITECTURE]] · [[HARD_CONSTRAINTS]] · [[SKILL_RAG]]
