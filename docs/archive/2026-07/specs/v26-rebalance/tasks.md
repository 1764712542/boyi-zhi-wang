# v26-rebalance · 任务分解

## 阶段1：文档创建
- [x] 创建 硬性约束.md
- [x] 创建 v26 规格文档

## 阶段2：AI 优化
- [ ] engine.js: 新增 AI 超时限制（3秒）
- [ ] engine.js: 宗师难度搜索深度 5→4
- [ ] engine.js: 超时降级贪心算法

## 阶段3：棋子数值调整
- [ ] data.js: PIECE_STATS 更新
- [ ] engine.js: calcDamage 士/相免疫一击必杀
- [ ] engine.js: calcDamage 帅免疫一击必杀
- [ ] engine.js: 车防御0扣血逻辑

## 阶段4：英雄类型系统
- [ ] data.js: 新增 HERO_TYPE 常量
- [ ] data.js: 每个角色增加 heroType 字段
- [ ] engine.js: getCharBonus 根据 heroType 计算加成

## 阶段5：角色分类与强化
- [ ] data.js: 最强几人拉满（仙帝/大爱/布罗利/元首）
- [ ] data.js: 其余角色按类型特色调整

## 阶段6：故事模式14章
- [ ] data.js: 重写 STORY_CHAPTERS 14章
- [ ] game.js: 新角色解锁逻辑

## 阶段7：状态栏优化
- [ ] game.js: 顶部栏动态显示
- [ ] game.js: 技能CD可视化
- [ ] style.css: 状态栏样式

## 阶段8：验证
- [ ] node -c 全部 JS 文件
- [ ] 更新项目修改记录
- [ ] 更新版本号
