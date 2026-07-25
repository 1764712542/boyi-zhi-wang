# v6 最终修复 Spec

## Why
v5-overhaul 规格虽标记完成，但用户反馈虚拟形象第二页起仍显示错误，且 B王 主动技能数量与规格不符（当前仅 1 个，要求 5 个）。需一次性修复所有遗留问题，确保游戏可正常游玩。

## What Changes
- **修复虚拟形象分页渲染**：排查第二页起头像错误的根因（可能为 SVG 注入失败、CSS 缓存或 flip-out 动画导致 innerHTML 丢失），确保所有页面头像正确显示
- **补全 B王 5 个主动技能**：在 `js/data.js` 的 `bking` 角色定义中新增 `skills` 数组（保留原 `skill` 字段兼容），包含 5 个主动技能定义
- **验证故事模式解锁流程**：确保初始仅 3 角色，通关后逐步解锁，全通关后开放隐藏角色
- **验证棋子血量系统**：确保吃子时双方掉血，HP 归零才移除
- **验证模式直接进入**：点击模式卡片无需"下一步"直接跳转
- **验证图鉴全角色展示**：B王技能描述无英文/函数名
- **验证阵营多色攻伐**：2-4 色共存可互相攻伐
- **验证技能单体定向**：默认单体，全范围需明确标注

## Impact
- Affected specs: v5-overhaul（遗留问题修复）
- Affected code:
  - `js/portrait.js`（虚拟形象渲染）
  - `js/data.js`（B王技能补全）
  - `game.js`（分页渲染、模式进入、图鉴展示）
  - `style.css`（portrait-svg 样式）
  - `index.html`（DOM 结构）

## ADDED Requirements

### Requirement: 虚拟形象全页面正确显示
系统 SHALL 在选将屏所有分页中正确渲染所有角色的 SVG 头像。

#### Scenario: 翻页后头像显示
- **WHEN** 玩家在选将屏点击"下一页"或分页指示器
- **THEN** 新页面的所有角色卡片均显示正确的 SVG 头像
- **AND** 头像内容与角色 ID 一一对应（无错位、空白、占位符）

#### Scenario: 角色详情头像
- **WHEN** 玩家打开角色详情弹窗或图鉴详情
- **THEN** 头像正确显示对应角色的 SVG

### Requirement: B王 5 个主动技能
系统 SHALL 为 B王 定义 5 个主动技能，覆盖三个难度等级。

#### Scenario: B王技能数据
- **WHEN** 读取 `CHARACTERS.bking` 数据
- **THEN** 包含 `skills` 数组，长度为 5
- **AND** 每个技能有 id/name/desc/cd/target 字段
- **AND** 描述中无英文函数名或代码片段

## MODIFIED Requirements

### Requirement: 遗留功能最终验证
所有 v5-overhaul 规定的功能 SHALL 通过实际运行验证，而非仅代码检查。

#### Scenario: 全流程验证
- **WHEN** 执行选将→对弈→技能→胜负全流程
- **THEN** 无控制台报错
- **AND** 所有功能按规格工作

## REMOVED Requirements
无
