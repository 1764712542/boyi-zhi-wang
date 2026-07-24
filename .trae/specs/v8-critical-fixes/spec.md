# v8 恶性Bug修复与平衡性调整 Spec

## Why
v7 实现后出现多个恶性bug：炮打非远程反而自己掉血（与规格相反）、点击棋子无响应（操作菜单阻塞）、棋盘过小血量看不见、兵过强车马吃亏。同时用户要求血量再提升100倍，且角色属性需附带到棋子上。

## What Changes

### 恶性Bug修复（**BREAKING**）
- **修复炮伤害反向**：炮(远程)打非远程单位应为"炮不掉血、仅防守方掉血"，当前实现反了
- **修复点击棋子无响应**：操作菜单阻塞了 selectPiece，导致无法选棋
- **修复棋盘过小**：红方最后一排血量看不见，需放大棋盘或调整布局

### 平衡性调整
- **兵削弱**：兵过强，需降低 HP 或调整相克规则（兵受非帅攻击不掉血太强）
- **车马加强**：车和马在当前相克下吃亏，需提升数值或给予优势

### 血量与属性系统重做（**BREAKING**）
- **血量提升100倍**：整体在当前基础上再提升100倍（帅 300→30000）
- **角色属性附带到兵种**：每个棋子继承所选角色的属性（atk/def/int），让角色选择影响战斗

### PVP 双方信息显示
- **双方buff显示**：PVP 模式下双方都需要看到自己的 buff 和技能状态
- **HUD 双方信息**：HUD 同时显示红黑双方的 buff 和技能

## Impact
- Affected specs: v7-rebalance
- Affected code:
  - `js/engine.js`：calcDamage 修复、角色属性注入
  - `game.js`：点击逻辑修复、棋盘放大、HUD 双方信息
  - `js/data.js`：PIECE_STATS 数值调整
  - `style.css`：棋盘尺寸、HUD 样式

## ADDED Requirements

### Requirement: 角色属性附带到兵种
系统 SHALL 让每个棋子继承所选角色的属性。

#### Scenario: 棋子属性
- **WHEN** 玩家选择角色后开始对局
- **THEN** 每个棋子有 baseAtk/baseDef 来自 PIECE_STATS
- **AND** 有 charAtk/charDef 来自所选角色
- **AND** 实际 atk = baseAtk + charAtk 加成

### Requirement: PVP 双方信息显示
系统 SHALL 在 PVP 模式下显示双方 buff 和技能。

#### Scenario: PVP 双方信息
- **WHEN** PVP 模式对局进行
- **THEN** HUD 显示红方和黑方各自的 buff
- **AND** 显示双方当前技能冷却状态

## MODIFIED Requirements

### Requirement: 兵种相克伤害（修复炮）
炮(远程)攻击非远程单位时 SHALL 仅防守方掉血，炮自身不掉血。

#### Scenario: 炮打车
- **WHEN** 炮移动到车的位置
- **THEN** 车受到伤害
- **AND** 炮不掉血（当前bug：炮反而掉血，需修复）

### Requirement: 兵种平衡性
兵 SHALL 被削弱，车马 SHALL 被加强。

#### Scenario: 兵削弱
- **WHEN** 兵受非帅攻击
- **THEN** 兵受到50%伤害（而非完全不掉血）

#### Scenario: 车马加强
- **WHEN** 车或马攻击
- **THEN** 有破甲效果（无视部分防御）

## REMOVED Requirements
无
