# v9 细节修复与文档化 Spec

## Why
v8 修复恶性bug后，出现细节问题：血量过高（30000等5位数）影响游戏节奏、被动技能未生效、HUD未显示角色属性加成、新手手册未涵盖新功能、棋子合并未影响血量。需统一修复并新建项目修改文档避免重复提醒。

## What Changes

### 血量数值调整（**BREAKING**）
- 血量从5位数降低到合理范围（3位数，如帅300、车180）
- 即撤回 v8 的"提升100倍"，回到 v7 的数值水平
- 角色属性加成保持（charAtk/charDef/charInt）

### 被动技能修复
- 修复被动技能未生效的问题
- 确保被动触发条件正确（ON_CAPTURE/ON_CAPTURED/AURA/IMMUNE/PERIODIC）
- 被动技能效果实际应用到战斗

### HUD 同步角色属性
- HUD 状态栏显示角色属性加成（charAtk/charDef/charInt）
- 双方技能和 buff 都要显示（已在 v8 部分实现，需完善）

### 选将屏技能选择
- 点击角色卡片时弹出技能选择面板
- 3 个主动技能选 1 个
- 2 个被动技能选 1 个
- 确认后记录选择

### 棋子合并影响血量
- 两个棋子合并（如技能产生的合并）时，血量需叠加或取较高值

### 新手手册更新
- 更新新手教程内容，涵盖：解锁方式、兵种相克、技能选择、角色属性、buff系统
- 新增功能说明页面

### 项目修改文档
- 新建 `项目修改记录.md` 文档，记录所有版本的修改内容、解决的问题、修复的bug
- 用于后续项目要求的参考

## Impact
- Affected specs: v7-rebalance, v8-critical-fixes
- Affected code:
  - `js/data.js`：PIECE_STATS 血量回调
  - `js/engine.js`：被动技能触发、棋子合并血量
  - `js/skills.js`：被动技能效果应用
  - `game.js`：HUD 角色属性显示、选将技能选择面板、新手教程更新
  - `index.html`：技能选择面板 DOM
  - `style.css`：技能选择面板样式

## ADDED Requirements

### Requirement: 项目修改文档
系统 SHALL 维护项目修改记录文档，记录每个版本修改内容。

#### Scenario: 文档内容
- **WHEN** 查看项目修改记录文档
- **THEN** 包含各版本修改内容、解决的问题、修复的bug

### Requirement: 棋子合并血量
系统 SHALL 在棋子合并时正确处理血量。

#### Scenario: 合并血量
- **WHEN** 两个棋子因技能合并
- **THEN** 合并后棋子血量为两者之和或较高值

## MODIFIED Requirements

### Requirement: 血量数值
棋子 HP SHALL 回到合理范围（3位数），避免游戏节奏过慢。

#### Scenario: 新血量数值
- **WHEN** 棋盘初始化
- **THEN** 帅 HP 300, 车 HP 180, 兵 HP 200 等（回到 v7 水平）

### Requirement: 被动技能生效
被动技能 SHALL 在战斗中实际触发效果。

#### Scenario: 被动触发
- **WHEN** 满足被动触发条件
- **THEN** 被动效果实际应用到战斗

## REMOVED Requirements
无
