---
created: 2026-07-25
type: spec
tags: [buff, system, calcDamage, todo]
---

# Buff 系统手册（BUFF_SYSTEM）

> ⚠️ **待完善** — 本文档为占位文档，内容尚未填充。
> 计划描述所有 buff 类型、calcDamage 识别逻辑、buff 注入/消耗/过期机制。

---

## 待填充内容

### 1. Buff 数据结构

```js
{
  id,              // buff 唯一 id
  name,            // 显示名
  type,            // buff 类型（atk/def/silence/stun/dodge/shield/...）
  value,           // 数值（百分比或固定值）
  duration,        // 持续回合数（-1 = 永久）
  source,          // 来源（角色 id / 技能 id）
  target,          // 目标（棋子 / 全队）
  stackable        // 是否可叠加
}
```

### 2. Buff 类型清单（待与 `engine.js` calcDamage 校验）

| Buff 类型 | 字段 | 效果 | 来源 |
|----------|------|------|------|
| 虚弱 | atkDebuff | 下回合攻击 -30% | 非炮打相/士触发 |
| 破甲 | defIgnore | 无视 30% 防御 | 车/马攻击 |
| 沉默 | silence | 无法使用技能 | 刘雪沛破妄之眼 / 大爱仙尊大爱无疆 |
| 狂暴 | atkBuff | 攻击 +50% | 三金狂战之怒 / B王暴怒 |
| 闪避 | dodge | X% 概率闪避攻击 | 敏捷系英雄类型加成 / 马对炮 |
| 护盾 | shield | 吸收伤害 | （待补全） |
| 锁定 | lock | 无法移动 | 解宇轩因果律锁 |
| 免疫 | immune | 免疫某类效果 | 胡浩正道护体 / B王厚颜无耻 |

### 3. Buff 注入接口

- `addBuff(piece, buff)` — 单棋子 buff 注入
- `addTeamBuff(player, buff)` — 全队 buff 注入
- `consumeBuff(piece, buffType)` — 消耗指定类型 buff

### 4. Buff 识别（calcDamage）

`calcDamage()` 只从棋子 buff 数组读取属性修改，不直接读取角色技能。

### 5. Buff 过期机制

- 回合末检查 `duration`，减 1
- `duration === 0` 时移除 buff
- `duration === -1` 为永久 buff（光环类）

---

## 完善计划

- [ ] 从 `engine.js` 提取完整 buff 类型清单
- [ ] 从 `skills.js` 提取所有被动注入的 buff
- [ ] 绘制 buff 生命周期流程图
- [ ] 标注每种 buff 的来源技能 / 角色映射
- [ ] 与 `硬性约束.md` 第四节「技能设计约束」做一致性校验

---

相关：[[ARCHITECTURE]] · [[HARD_CONSTRAINTS]] · [[SKILL_RAG]]
