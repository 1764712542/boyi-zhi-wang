# Tasks

## 阶段一：血量回调与被动技能修复

- [x] Task 1: 血量回调到合理范围 + 被动技能修复
  - [x] 1.1: 在 `js/data.js` 将 PIECE_STATS 的 HP 从5位数回调到3位数（帅300, 车180, 兵200等，回到v7水平）
  - [x] 1.2: 读取 `js/skills.js`，审查被动技能触发逻辑（ON_CAPTURE/ON_CAPTURED/AURA/IMMUNE/PERIODIC）
  - [x] 1.3: 修复被动技能未生效的问题（确保触发条件正确、效果实际应用）
  - [x] 验证：血量为3位数，被动技能在战斗中触发

## 阶段二：HUD同步与选将技能选择

- [x] Task 2: HUD 同步角色属性 + 双方buff技能显示完善
  - [x] 2.1: 在 `game.js` 的 renderHUD 中新增角色属性加成显示（charAtk/charDef/charInt）
  - [x] 2.2: 确保双方技能和buff都显示（完善 v8 的实现）
  - [x] 验证：HUD 显示角色属性和双方信息

- [x] Task 3: 选将屏技能选择面板
  - [x] 3.1: 在 `index.html` 新增技能选择面板 DOM（3主动选1 + 2被动选1）
  - [x] 3.2: 在 `game.js` 点击角色卡片时弹出技能选择面板
  - [x] 3.3: 3 个主动技能可选 1，2 个被动技能可选 1
  - [x] 3.4: 确认选择后记录到 state
  - [x] 验证：点击角色弹出技能选择，可切换选择
  - [NOTE] 面板已实现但 usePlayerSkill 未读取选中技能（→ v10 修复）

## 阶段三：棋子合并与新手手册

- [x] Task 4: 棋子合并影响血量
  - [x] 4.1: 在 `js/engine.js` 新增 mergePieces/mergeBuffs 工具函数（HP叠加，atk/def取较高值）
  - [NOTE] 新手教程更新移至 v10 Task 6

## 阶段四：项目修改文档

- [x] Task 5: 新建项目修改记录文档
  - [x] 5.1: 新建 `项目修改记录.md` 文档
  - [x] 5.2: 记录 v5-v9 各版本修改内容、解决的问题、修复的bug
  - [x] 验证：文档内容完整，涵盖所有版本

## 阶段五：最终校验

- [x] Task 6: v9 范围内校验完成
  - [NOTE] 技能选择生效、替代技能实现、教程扩展移至 v10

# Task Dependencies
- Task 1 独立
- Task 2 依赖 Task 1
- Task 3 可与 Task 2 并行
- Task 4 可与 Task 2/3 并行
- Task 5 独立
- Task 6 依赖所有
