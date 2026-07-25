# v26-rebalance · 数值平衡重构 + 英雄类型系统 + 故事模式重做

## Why

用户反馈：
1. 高难度AI卡死
2. 车一击必杀太强，士/相/帅无特色
3. 技能数值堆砌而非特色化
4. 新角色未加入故事模式
5. 故事模式章节不足
6. 状态栏需要动态优化

## What Changes

### 一、棋子数值调整

| 棋子 | HP | atk | def | 变化 |
|------|-----|-----|-----|------|
| 帅/将 k | 250 | 40 | 50 | HP+50, atk+10, def+10 |
| 车 r | 120 | 90 | 0 | atk+10, def→0（玻璃大炮） |
| 马 h | 100 | 60 | 20 | atk+5 |
| 炮 c | 80 | 80 | 12 | atk+10 |
| 仕/士 a | 90 | 25 | 70 | HP+20, atk+7, def+15 |
| 相/象 e | 90 | 25 | 70 | HP+20, atk+7, def+15 |
| 兵/卒 p | 140 | 50 | 15 | HP+10, atk+5, def+3 |

### 二、战斗规则调整（engine.js calcDamage）

1. **士/相免疫一击必杀**：车攻击 defender 时，若 defender 是 a/e 类型，伤害改为 maxHp×50%
2. **帅免疫一击必杀**：车攻击 defender 时，若 defender 是 k 类型，伤害改为 maxHp×40%
3. **车防御0**：车被攻击时按0防御计算，几乎必死
4. 保留：帅受非兵攻击减伤30%、兵打帅+50%、反击规则、马真实伤害

### 三、英雄类型系统（data.js + engine.js）

新增 `HERO_TYPE` 常量：
```js
const HERO_TYPE = {
  STRENGTH: 'strength',  // 力量系：HP+30%, def+20%
  AGILITY: 'agility',    // 敏捷系：atk+20%, 移速+1
  INTELLECT: 'intellect' // 智力系：技能伤害+50%, CD-1
};
```

每个角色增加 `heroType` 字段，`getCharBonus` 根据 heroType 计算加成。

### 四、角色分类与调整

#### 力量系（HP+30%, def+20%）
- 胡浩、刘佳伟、周子翰、三金、布罗利

#### 敏捷系（atk+20%, 移速+1）
- 侯智博、陆星辰、鸡哥、ikun、袁清山、罗伦杰

#### 智力系（技能伤害+50%, CD-1）
- 仙帝Alice、大爱仙尊、解宇轩、王昕、唐昊博涵、刘雪沛、帝国元首、B王

### 五、最强角色拉满

- 仙帝Alice: atk 99 / def 99 / int 100（智力系）
- 大爱仙尊: atk 99 / def 99 / int 100（智力系）
- 布罗利: atk 98 / def 82 / int 55（力量系，谋低）
- 帝国元首: atk 95 / def 75 / int 92（智力系）

### 六、AI 优化（engine.js）

1. 新增 `AI_TIMEOUT = 3000`（3秒超时）
2. 宗师难度搜索深度 5→4
3. 超时降级为贪心算法

### 七、故事模式14章重做（data.js）

重写 STORY_CHAPTERS 数组，14章完整剧情线，每章解锁1个新角色。

### 八、状态栏优化（game.js + style.css）

1. 顶部栏动态显示当前回合数
2. 兵力统计动态更新
3. 技能CD可视化（进度条）
4. buff列表紧凑显示

## Impact

- engine.js: calcDamage 规则调整 + AI 超时
- data.js: PIECE_STATS + HERO_TYPE + 角色分类 + STORY_CHAPTERS
- skills.js: 无重大改动
- game.js: 状态栏优化
- style.css: 状态栏样式调整

## Scenarios

1. 车攻击士：伤害 = maxHp×50%（非一击必杀）
2. 车攻击帅：伤害 = maxHp×40%（非一击必杀）
3. 车攻击马：伤害 = maxHp（一击必杀，马无免疫）
4. 布罗利选将后：溢出的气永久递增
5. 宗师难度AI：3秒内出招，不卡顿
