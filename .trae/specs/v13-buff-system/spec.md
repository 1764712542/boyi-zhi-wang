# v13-buff-system · 技能数值加成统一为 buff 系统

> 版本：v13.0
> 日期：2026-07-24
> 状态：开发中
> 前置版本：v12（HUD 同步与血量调整）

---

## 一、背景与问题

### 1.1 用户反馈
1. "选中没有用啊"——点击棋子后 HUD 不显示属性
2. "我设定的 Debug 扫描，感觉没有加 50% 的伤害一样，看不出来"
3. "我的意思是每个加数值的技能都变成 buff，添加到棋子"
4. "整体的逻辑你需要盘一下"

### 1.2 根因分析

**问题 1：选中后 HUD 不显示**
- 根因：`state.selected` 使用 `{row, col}` 字段，但 HUD 代码读取 `state.selected.r` / `state.selected.c`
- 修复：兼容两种字段，优先读取 `{row, col}`

**问题 2：技能数值加成无效**
- 根因：所有技能数值加成写在 `state.xxx` 标记位（如 `state.executeMark`、`state.teamAtkBuff`、`state.teleportBuff`、`state.reflectTurns`），但：
  - `calcDamage()` 只读取棋子的 `buffs` 数组，不读取 `state` 标记
  - `doMove()` 没有把 state 标记应用到伤害计算
  - 这些标记"写了但没用"
- 修复：把所有技能数值加成转化为统一 buff 挂到棋子上

**问题 3：buff 系统不统一**
- 根因：buff 类型只有 `weakness`/`ironwall`/`shield` 等少数几种，技能加成没有进入 buff 系统
- 修复：扩展 buff 类型，所有数值加成通过 buff 应用

### 1.3 设计目标
- 所有技能数值加成（攻击/防御/伤害/治疗/反伤）统一为 buff 系统
- buff 挂到具体棋子上（而非全局 state 标记）
- `calcDamage()` 和 `getPieceEffectiveStats()` 统一读取 buff
- HUD 实时显示 buff 影响后的属性

---

## 二、Buff 系统重构

### 2.1 Buff 类型扩展

| Buff 类型 | 名称 | 效果 | 来源技能 |
|----------|------|------|----------|
| weakness | 虚弱 | 攻击 -30% | 兵种相克（打仕相） |
| ironwall | 铁壁 | 防御 ×2 | 三金·狂战之怒 |
| shield | 护盾 | 吸收 N 伤害 | 胡浩·正道护体 |
| silence | 沉默 | 无法使用技能 | 解宇轩·逻辑沉默 |
| lock | 禁锢 | 无法移动 | 解宇轩·因果律锁 |
| attackBoost | 攻击强化 | 攻击 +N | 三金·狂战之怒/兄弟连斩 |
| defenseBoost | 防御强化 | 防御 +N | 胡浩·正道护体 |
| executeMark | 必中标记 | 下次攻击 +50% 伤害 | 三金·嗜血斩杀/陆星辰·Debug扫描 |
| reflect | 反伤 | 反弹 N% 伤害 | ikun·全给你/大爱仙尊·扮猪吃虎 |
| immune | 无敌 | 免疫所有伤害 | 唐昊博涵·翻书作弊 |
| teamAtkBoost | 全队攻击 | 己方全体攻击 +N% | 三金·兄弟连斩/胡浩·万法归一 |

### 2.2 buff 应用规则

1. **单体 buff**：直接挂到目标棋子的 `buffs` 数组
2. **全队 buff**：遍历己方所有棋子，逐个挂 buff
3. **标记型 buff**（如 executeMark）：挂到攻击方棋子，下次攻击时消耗
4. **buff 持续**：回合结束时 `tickBuffs()` 递减，归零移除
5. **_fresh 标记**：本回合新增的 buff 不立即递减

### 2.3 calcDamage 统一读取 buff

```javascript
function calcDamage(attacker, defender){
  // 基础攻防
  const aAtk = attacker.atk + (attacker.charAtk || 0) / 10;
  const aDef = attacker.def + (attacker.charDef || 0) / 10;
  const dAtk = defender.atk + (defender.charAtk || 0) / 10;
  const dDef = defender.def + (defender.charDef || 0) / 10;

  // 攻击方 buff 影响
  let atkMul = 1, atkAdd = 0, dmgMul = 1;
  if(attacker.buffs){
    for(const b of attacker.buffs){
      if(b.type==='weakness') atkMul *= (1 - (b.value||0.3));
      if(b.type==='attackBoost') atkAdd += (b.value||20);
      if(b.type==='executeMark') dmgMul *= (1 + (b.value||0.5)); // +50% 伤害
    }
  }
  const effAtk = (aAtk + atkAdd) * atkMul;

  // 防守方 buff 影响
  let defMul = 1, defAdd = 0, dmgReduce = 0;
  if(defender.buffs){
    for(const b of defender.buffs){
      if(b.type==='ironwall') defMul *= 2;
      if(b.type==='defenseBoost') defAdd += (b.value||20);
      if(b.type==='shield') dmgReduce += (b.value||80); // 吸收伤害
    }
  }
  const effDef = (dDef + defAdd) * defMul;

  // 伤害计算
  let defenderDmg = Math.max(1, Math.floor((effAtk - effDef) * dmgMul));
  // 护盾吸收
  if(dmgReduce > 0){
    const absorbed = Math.min(dmgReduce, defenderDmg);
    defenderDmg -= absorbed;
  }
  // ...
}
```

---

## 三、技能重构清单

### 3.1 需要转化为 buff 的技能

| 技能 | 原实现（state 标记） | 新实现（buff） |
|------|---------------------|----------------|
| 三金·狂战之怒 | state.ironwallTurns | 挂 ironwall + attackBoost buff 到选中棋子 |
| 三金·嗜血斩杀 | state.executeMark | 挂 executeMark buff 到攻击方棋子 |
| 三金·兄弟连斩 | state.teamAtkBuff | 挂 attackBoost buff 到己方全体 |
| 陆星辰·Debug扫描 | state.executeMark | 挂 executeMark buff 到攻击方棋子 |
| 胡浩·正道护体 | state.shieldMode | 挂 shield + defenseBoost buff 到选中棋子 |
| 胡浩·万法归一 | state.teamAtkBuff | 挂 attackBoost buff 到己方全体 |
| ikun·全给你 | state.reflectTurns | 挂 reflect buff 到己方全体 |
| 周子翰·优雅闪烁 | state.teleportBuff | 挂 attackBoost buff 到瞬移的棋子 |
| 唐昊博涵·翻书作弊 | state.teamShield | 挂 shield buff 到己方全体 |
| 大爱仙尊·扮猪吃虎 | state.reflectFirstTurn | 挂 reflect + immune buff 到己方全体 |

---

## 四、验收标准

- [ ] 选中棋子后 HUD 显示完整属性（基础+加成+buff）
- [ ] Debug 扫描后攻击+50%伤害在伤害数字中体现
- [ ] 狂战之怒后棋子攻防属性在 HUD 中提升
- [ ] buff 列表显示所有技能产生的 buff
- [ ] 棋子详情弹窗显示完整 buff 影响
- [ ] `node -c` 所有 JS 文件通过
