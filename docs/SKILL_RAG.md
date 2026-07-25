---
created: 2026-07-25
type: rag-registry
level: A
tags: [rag, skill, prompt-engineering, intent-matching]
---

# 技能RAG注册表 + 意图匹配

> **A级文档** — 技能设计的检索增强生成（RAG）注册表。
> AI收到技能相关需求时，先查此表匹配模式，再执行。

## 🔍 意图匹配提示词工程

### 匹配流程

```
用户需求
  ↓
关键词提取 → [[#关键词映射表]]
  ↓
RAG检索 → [[#技能模式注册表]]
  ↓
约束加载 → [[HARD_CONSTRAINTS]]
  ↓
检查清单 → [[ANTI_HALLUCINATION]]
  ↓
确认方向（AskUserQuestion）
  ↓
执行变更
```

### 关键词映射表

| 用户关键词 | 匹配文档 | 匹配技能模式 |
|-----------|---------|-------------|
| 新增技能/主动/被动 | 本文档 | [[#主动技能模式]] / [[#被动技能模式]] |
| buff/状态/易伤/沉默 | [[BUFF_SYSTEM]] | [[#buff模式]] |
| 角色/属性/攻防智 | [[CHARACTER_REGISTRY]] | [[#角色属性模式]] |
| 诛仙/万仙/通天/紫霄 | 本文档 | [[#通天教主模式]] |
| B王/难度/七宗罪 | 本文档 | [[#B王模式]] |
| 数值/平衡/伤害 | [[HARD_CONSTRAINTS#战斗与平衡]] | [[#平衡模式]] |
| 选将/选技能/ban位 | 本文档 | [[#选将模式]] |
| 闪避/免疫/反伤 | 本文档 | [[#防御机制模式]] |
| 召唤/仙兵/突破上限 | 本文档 | [[#召唤机制模式]] |
| 阵法/标记/斩杀 | 本文档 | [[#阵法机制模式]] |
| 硬编码/动态化/UI/前端 | [[UI_SELF_AUDIT]] | [[UI_SELF_AUDIT#动态化强制清单]] |
| 自我学习/自动纠错/幻觉 | [[SELF_LEARNING]] | [[SELF_LEARNING#自我纠错触发器]] |
| 审美/UI设计/参考大游戏 | [[UI_SELF_AUDIT]] | [[UI_SELF_AUDIT#大游戏审美参考库]] |

---

## 📚 技能模式注册表

### 主动技能模式

#### 模式：单体标记斩杀
```yaml
id: execute-mark-pattern
触发: 主动技能
目标: 单体
机制:
  - 标记目标（施加 buff）
  - 标记期间易伤/禁疗/禁闪
  - 满足条件时斩杀（无视免疫/护盾）
代表:
  - 诛仙剑阵（zhuxianMark + tickZhuxianMark）
约束:
  - 斩杀条件必须明确（血<50%）
  - 必须有斩杀检查函数（tickXxx）
  - 斩杀无视 immune/shield/goldenImmortal
```

#### 模式：全范围debuff
```yaml
id: aoe-debuff-pattern
触发: 主动技能
目标: 全范围
机制:
  - 敌方全体施加 debuff
  - 多种 debuff 叠加
代表:
  - 紫霄神威（lock + defReduce + oppPassiveDisabled）
约束:
  - 沉默需设置 oppSkillBlockedColor + silenceTurns
  - 禁锢用 lock buff（如需移动禁锢）
  - 被动失效用 oppPassiveDisabled
```

#### 模式：召唤突破上限
```yaml
id: summon-break-cap-pattern
触发: 主动技能
目标: 全范围
机制:
  - 召唤棋子到空位（突破棋子上限）
  - 召唤棋子有消散计时
  - 召唤棋子被吃时有反噬
代表:
  - 万仙阵（_immortalSoldier + _immortalTurnsLeft）
约束:
  - 必须在 tickBuffs 中递减计数
  - 归零时消散（棋盘置null）
  - 召唤棋子需注入完整属性（charId/heroType等）
```

#### 模式：阵法闭合引爆
```yaml
id: formation-detonate-pattern
触发: 主动技能
目标: 范围
机制:
  - 召唤阵法占位（如4把剑）
  - 阵法期间持续伤害/限制
  - 阵法闭合时引爆一次性伤害
代表:
  - 诛仙剑阵·四剑齐出（待实现）
约束:
  - 占位棋子需有 _isFormation 标记
  - 闭合时清理阵法棋子
  - 引爆伤害无视免疫
```

### 被动技能模式

#### 模式：AURA光环
```yaml
id: aura-pattern
触发: PASSIVE_TRIGGER.AURA
时机: 每回合开始
分发: passivesApplyAuras → applyAurasForChar → triggerPassive(event='aura')
代表:
  - p_zhuxian_aura（诛仙剑意）
约束:
  - 必须检查 myColorForChar 返回有效颜色
  - buff 标记 _aura=true 避免被 tickBuffs 清除
  - PVP 下需按 currentPlayer 分发（双方都触发）
```

#### 模式：ON_CAPTURED被吃触发
```yaml
id: on-captured-pattern
触发: PASSIVE_TRIGGER.ON_CAPTURED
时机: 己方棋子被吃时
分发: passivesOnCaptured → triggerPassive(event='on_captured')
代表:
  - p_jiejiao（截教道统）
约束:
  - 必须检查 isPieceKilled（HP系统）
  - ctx 包含 capturer/capturedPiece/attackerPiece
```

#### 模式：IMMUNE免疫
```yaml
id: immune-pattern
触发: PASSIVE_TRIGGER.IMMUNE
时机: 被攻击时（calcDamage之前）
分发: tryDodgePassive → return true 取消攻击
代表:
  - p_shield（正道护体）
  - p_wanxian_guard（万仙护体）
约束:
  - 必须在 tryDodgePassive 中实现（非 passivesOnCaptured）
  - passivesOnCaptured 中必须跳过（避免双重触发）
  - 每局N次需用 passiveState.immunityUsed 计数
```

#### 模式：PERIODIC周期
```yaml
id: periodic-pattern
触发: PASSIVE_TRIGGER.PERIODIC
时机: 每 N 回合（己方回合）
分发: triggerPeriodicPassives → triggerPeriodicForChar → getPassivePeriod
代表:
  - p_tongtian_pressure（每4回合）
  - p_hunyuan_golden（每3回合）
约束:
  - 必须在 getPassivePeriod 中注册周期
  - 计数器在 passiveState.counters[charId+'_period']
  - 按 currentPlayer 触发（避免对方回合也计数）
```

#### 模式：TURN_START回合开始
```yaml
id: turn-start-pattern
触发: PASSIVE_TRIGGER.TURN_START
时机: 回合开始
分发: passivesOnTurnStartTrigger
代表:
  - p_bking_insight
约束:
  - 按 currentPlayer 识别当前行动方角色
  - PVP/联机用 charForColor 反查
```

---

## 🎯 通天教主模式

### 角色约束

```yaml
charId: tongtian
身份: 混元大罗金仙，截教教主
属性: atk:88, def:88, int:95（v36: 100/100/100→88/88/95，统一≤95）
风格: 古文，不提及其他角色
被动: 5个选2个（多选模式）
主动: 3个选1个
```

### 技能约束

| 技能 | 约束 |
|------|------|
| 诛仙剑阵 | 最强，需体现封神力量（四剑齐出+阵法闭合）|
| 万仙阵 | 召唤仙兵突破上限+反噬 |
| 紫霄神威 | 原"通天彻地"，全局压制+连走3步 |

### 被动约束

| 被动 | 触发 | 机制 |
|------|------|------|
| 诛仙剑意 | AURA | 压制敌方最强棋子 |
| 截教道统 | ON_CAPTURED | 己方被吃时强化+召唤 |
| 万仙护体 | IMMUNE | 帅/将危急时免疫+反伤 |
| 通天威压 | PERIODIC/4 | 敌方全体防御-50%+沉默 |
| 混元金仙 | PERIODIC/3 | 己方全体金仙之体 |

### 多选实现

```javascript
// 选将屏：passives.length > 2 时启用多选
const isMulti = passives.length > 2;
// 存储：skillState.selected[charId].passive = [0, 2]（数组）
// 读取：getActivePassives 支持 Array.isArray(sel)
```

---

## 👑 B王模式

### 难度系统

```yaml
初心: bkingPassives: ['p_aura']
进阶: bkingPassives: ['p_aura', 'p_kingaura']
宗师: bkingPassives: ['p_aura', 'p_kingaura', 'p_combo']
```

### 七宗罪技能

```yaml
傲慢(arrogance): 嘲讽+威压
嫉妒(envy): 复制对方被动
暴怒(wrath): 强化攻击
懒惰(sloth): 减速对方
贪婪(greedy): 偷取属性
暴食(gluttony): 吞噬棋子
色欲(lust): 控制对方
```

### 形态切换

```yaml
每5回合切换: 防御→进攻→狡诈→狂暴
切换时: 清除旧形态buff，施加新形态buff
```

---

## 🛡️ 防御机制模式

### 闪避三件套

| 被动 | 实现 | 时机 |
|------|------|------|
| p_dodge | tryDodgePassive | calcDamage之前 |
| p_elegant | tryDodgePassive | calcDamage之前 |
| p_shield | tryDodgePassive | calcDamage之前 |

**约束：** 必须在 `tryDodgePassive` 中实现，且 `passivesOnCaptured` 中跳过。

### 免疫+反伤

```javascript
// tryDodgePassive 中
if(p.id==='p_wanxian_guard' && !passiveState.immunityUsed['xxx']
   && defender.type===T.KING && defender.hp < defender.maxHp*0.3){
  passiveState.immunityUsed['xxx']=true;
  attacker.hp = Math.max(0, attacker.hp - 200);  // 反伤
  return true;  // 取消攻击
}
```

---

## 📊 平衡模式

### 数值边界检查

修改任何数值时，必须测试边界：

```
HP: 0% / 50% / 100%
攻击: 0 / 基础 / 极高
防御: 0 / 基础 / 极高
血量取反: 0%↔100% / 50%↔50% / 80%↔20%
```

### 机制合理性检查

```
□ 机制在回合制下是否合理？
□ 机制在棋盘规则下是否合理？
□ 机制是否与现有机制冲突？
□ 代价是否合理？（如"自身无法行动"在回合制无意义）
```

---

## 🎨 选将模式

### 选将屏约束

| 角色类型 | 主动 | 被动 | 显示文案 |
|---------|------|------|---------|
| 普通角色 | 3选1 | 2选1 | "选1个" |
| 通天教主 | 3选1 | 5选2 | "选2个" |
| B王 | 5个全开 | 按难度 | "共N个" |

**约束：** UI标题必须动态判断 `passives.length > 2`，禁止硬编码"二选一"。

---

## ⚖️ 平衡性数值约束（v36集体下降后基线）

> 以下数值为 v36 平衡性测试后的基线，后续调整必须以此为参考。

### 棋子属性基线（PIECE_STATS）

| 棋子 | HP | atk | def | 类型 | 关键机制 |
|------|-----|-----|-----|------|---------|
| 帅 k | 260 | 50 | 55 | core | 临终反伤50，受非兵攻击-30% |
| 车 r | 110 | 80 | 10 | striker | 一击必杀，自损30%maxHp，HP<30%时atk+30% |
| 马 h | 120 | 72 | 20 | striker | 真伤20，对炮闪避30%，对炮半反击×0.5 |
| 炮 c | 80 | 65 | 12 | remote | 伤害×1.1，无视40%防御，打非远程不掉血（马例外）|
| 士 a | 100 | 30 | 75 | defender | 反击×1.5 |
| 相 e | 100 | 35 | 65 | defender | 30%概率反弹20% |
| 兵 p | 110 | 55 | 15 | special | 受非帅非兵-35%，打帅+50%，反击×0.3 |

### 角色属性上限

| 类型 | atk上限 | def上限 | int上限 | 示例 |
|------|--------|--------|--------|------|
| 顶级（金仙级）| 90 | 88 | 95 | 通天教主/仙帝Alice/大爱仙尊 |
| 强力 | 92 | 82 | 92 | 解宇轩 |
| 中等 | 90 | 85 | 75 | 三金 |
| 力量系 | 95 | 85 | 55 | 布罗利 |

**约束：** 任何角色属性不得超过100（v36已统一降至≤95）。

### 技能数值上限

| 类型 | 上限 | 示例 |
|------|------|------|
| 全体真实伤害 | 40/棋 | 仙帝审判（v36: 60→40）|
| 单体反伤 | 120 | 万仙护体（v36: 200→120）|
| 阵法引爆 | maxHp×25% | 诛仙闭合（v36: 40%→25%）|
| 全体buff加成 | +35% | 金仙之体（建议+35%而非+50%）|
| 连走步数 | 2步 | 紫霄神威（建议2步）|
| 禁锢回合 | 2回合 | 紫霄神威 |
| 被动失效 | 2回合 | 仙帝审判（v36: 3→2）|

### 炮打马平衡约束（v36新增）

```yaml
机制:
  - 炮打马伤害 = floor((65 - (20-8)) × 1.1) = 58（v36: 原66）
  - 马HP 120 → 3击必杀（原2击）
  - 马对炮半反击×0.5 — 打破"炮打非远程不掉血"绝对压制
  - 马对炮闪避30%
约束:
  - 炮攻击不得超过65
  - 马对炮必须有反击能力（canCounter 例外）
  - 不得移除马的炮闪避
```

### 兵种相克规则（v36）

| 规则 | 数值 | 位置 |
|------|------|------|
| 炮伤害加成 | ×1.1 | engine.js:733 |
| 炮无视防御 | 40% | engine.js:863 |
| 炮打非远程不掉血 | 马例外（×0.5反击）| engine.js:897 |
| 兵减伤 | 35% | engine.js:868 |
| 车自损 | 30%maxHp | engine.js:850 |
| 车残血爆发 | HP<30%时atk+30% | engine.js:740 |
| 马真伤 | 20 | engine.js:826 |
| 帅临终反伤 | 50 | engine.js:921 |

### 文档同步检查清单

每次平衡性调整后，必须同步更新以下位置：

- [ ] `js/data.js` PIECE_STATS（数值本体）
- [ ] `js/data.js` CHARACTERS stats（角色属性）
- [ ] `js/data.js` 技能描述（数值描述）
- [ ] `js/engine.js` calcDamage（伤害计算逻辑）
- [ ] `game.js` 主动技能 case 分支（伤害数值）
- [ ] `game.js` 新手指南（game.js:6425-6439）
- [ ] `index.html` 模式描述（章节数等）
- [ ] `AGENTS.md` 项目概述
- [ ] `docs/HARD_CONSTRAINTS.md` 平衡约束表
- [ ] `docs/SKILL_RAG.md` 平衡基线表

**约束：** 任何数值变更必须同步所有上述位置，避免"代码改了但描述没改"的幻觉。

---

相关：[[HARD_CONSTRAINTS]] · [[ANTI_HALLUCINATION]] · [[BUFF_SYSTEM]] · [[CHARACTER_REGISTRY]]
