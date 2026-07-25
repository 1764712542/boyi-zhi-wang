# Tasks

## 阶段一：数据层与形象修复（基础）

- [x] Task 1: 虚拟形象系统改为 SVG 内联头像
  - [x] 1.1: 重写 `js/portrait.js`，为 18 个角色各设计独特 SVG（基于角色性格/色彩/符号）
  - [x] 1.2: 移除 `getPortraitUrl` 外部 API 调用，`getPortrait` 直接返回 SVG 字符串
  - [x] 1.3: 更新 `setAvatarPortrait` 使用 SVG 而非 background-image
  - [x] 1.4: 删除 `data.js` 中 `PORTRAIT_IMG_BASE` 和 `PORTRAIT_PROMPTS`
  - [x] 验证：选将屏所有页面头像正确显示

- [x] Task 2: 新增棋子战斗属性数据
  - [x] 2.1: 在 `js/data.js` 新增 `PIECE_STATS` 常量表（k/r/h/c/a/e/p 各自的 hp/atk/def）
  - [x] 2.2: 在 `js/engine.js` 的 `createInitialBoard` 中为每个棋子注入 hp/maxHp/atk/def
  - [x] 2.3: 确保 `cloneBoard` 的 `{...c}` 浅拷贝能复制新字段
  - [x] 验证：棋盘初始化后每个棋子有正确的战斗属性

- [x] Task 3: 古月方圆（大爱仙尊）技能重写 + B王阵营调整
  - [x] 3.1: 重写 `daaixianzun` 角色的主动技能为"天命归一"，被动为"扮猪吃虎"和"天道因果"
  - [x] 3.2: 重写对应的 skillLines / speech / loseLines 台词（网络小说主角风格）
  - [x] 3.3: 更新 `FORMATIONS.bking` 移除 jige，新增 luolunjie
  - [x] 3.4: 为 B王新增 2 个主动技能定义（装逼领域、以退为进·本王版）
  - [x] 验证：数据结构正确，无语法错误

## 阶段二：核心战斗系统

- [x] Task 4: doMove 伤害结算改造
  - [x] 4.1: 在 `game.js` 的 `doMove` 中，当 `captured != null` 时改为伤害结算
  - [x] 4.2: 实现 `calcDamage(attacker, defender)` 返回 `max(1, atk - def)`
  - [x] 4.3: 攻击方与防守方互相结算伤害（防守方反击）
  - [x] 4.4: 仅当 `captured.hp <= 0` 时移除棋子并归档；否则攻击方留原地
  - [x] 4.5: 更新 `checkGameEnd` 适配 hp 系统（将被吃光才判负，或保留将军判定）
  - [x] 4.6: `undoLastMove` 的 history 快照保存 hp 字段
  - [x] 验证：吃子时双方掉血，hp 归零才移除

- [x] 5: 棋子血条渲染
  - [x] 5.1: 在 `drawPiece` 函数中绘制 hp 血条（棋子下方小条）
  - [x] 5.2: 血条颜色按 hp 比例变化（绿→黄→红）
  - [x] 5.3: 显示 atk/def 数值（可选小字）
  - [x] 验证：棋盘上可见血条

- [x] Task 6: AI 评估适配 hp 系统
  - [x] 6.1: 在 `js/engine.js` 的 `evaluateBoard` 中按 `hp/maxHp` 折扣棋子价值
  - [x] 6.2: `makeMv`/`undoMv` 保存 hp 快照
  - [x] 6.3: AI 搜索逻辑中模拟伤害结算
  - [x] 验证：AI 不会无视残血棋子

## 阶段三：模式与 UI 改造

- [x] Task 7: 模式选择直接进入（移除"下一步"）
  - [x] 7.1: 在 `index.html` 中移除模式屏的 `.screen-nav` 和 `#mode-confirm` 按钮
  - [x] 7.2: 在 `game.js` 中将模式卡片的 click 事件改为直接执行跳转逻辑
  - [x] 7.3: 删除原 `mode-confirm` 事件监听器
  - [x] 验证：点击模式卡片直接进入对应流程

- [x] Task 8: 选将屏移除详情弹窗
  - [x] 8.1: 移除 `char-detail-overlay` 的点击触发（不再调用 `showCharacterDetail`）
  - [x] 8.2: 点击角色卡片直接调用 `confirmCharacterSelect` 逻辑
  - [x] 8.3: 在角色卡片上直接展示被动技能（2 个被动卡片内嵌）
  - [x] 8.4: 卡片内被动可选（点击切换 selected 态）
  - [x] 验证：点击角色直接确认选择，被动可在卡片上选

- [x] Task 9: 图鉴功能增强（全角色）
  - [x] 9.1: 将 `showBossInfo` 改造为 `showCharCodex`（角色图鉴）
  - [x] 9.2: 展示全部 18 个角色，每个可点击查看详情
  - [x] 9.3: 修复 B王技能描述中的英文/函数名显示
  - [x] 9.4: 模式选择屏"B王图鉴"改为"角色图鉴"
  - [x] 验证：图鉴显示所有角色，B王描述无英文/函数名

## 阶段四：故事模式与解锁系统

- [x] Task 10: 故事模式角色解锁系统
  - [x] 10.1: 在 `js/data.js` 的 `STORY_CHAPTERS` 中为每章新增 `unlockChars` 字段
  - [x] 10.2: 在 `game.js` 新增 `getUnlockedChars()` 函数，从 localStorage 读取解锁列表
  - [x] 10.3: 故事模式下 `getCharList` 过滤为仅已解锁角色
  - [x] 10.4: 通关章节时写入新解锁角色到 localStorage
  - [x] 10.5: 全通关后解锁 B王/仙帝Alice/古月方圆
  - [x] 验证：故事模式开局仅 3 角色，通关后逐步解锁

## 阶段五：阵营与多人模式

- [x] Task 11: 阵营多色攻伐系统
  - [x] 11.1: 新增 4 色支持（红/黑/蓝/绿），扩展 `state` 的多玩家字段
  - [x] 11.2: `createInitialBoard` 支持多阵营布局
  - [x] 11.3: 回合制扩展为多玩家轮转（不止红黑）
  - [x] 11.4: 阵营被动联动（同阵营被动叠加）
  - [x] 11.5: 阵营模式 UI 选择界面
  - [x] 验证：阵营模式可多色共存攻伐

- [x] Task 12: 4v4 多人模式基础
  - [x] 12.1: 新增 4 玩家状态结构（每人 1 角色 + 1 色）
  - [x] 12.2: 4 玩家轮流走棋
  - [x] 12.3: 胜负判定（任一方将被吃则该方淘汰）
  - [x] 验证：4 玩家可轮流操作

## 阶段六：技能单体定向与收尾

- [x] Task 13: 技能单体定向
  - [x] 13.1: 审查所有技能，确保默认只针对单一目标玩家
  - [x] 13.2: 标注"全范围"技能（大爱无疆/天罚等）保留全范围
  - [x] 13.3: 技能描述中明确标注"单体"或"全范围"
  - [x] 验证：技能定向正确

- [x] Task 14: 被动技能系统适配 hp
  - [x] 14.1: `js/skills.js` 中 ON_CAPTURE/ON_CAPTURED 触发时机改为"击杀时"
  - [x] 14.2: 复活类被动（以攻代守/浩然正气等）适配 hp 系统
  - [x] 14.3: 三金/罗伦杰等进攻型被动适配伤害加成
  - [x] 验证：被动在 hp 系统下正确触发

- [x] Task 15: 最终语法校验与浏览器测试
  - [x] 15.1: `node -c` 校验所有 JS 文件
  - [x] 15.2: 浏览器测试：选将→对弈→技能→胜负 全流程
  - [x] 15.3: 测试故事模式解锁流程
  - [x] 15.4: 测试阵营模式多色攻伐
  - [x] 15.5: 测试图鉴全角色展示
  - [x] 验证：全流程无报错

# Task Dependencies
- Task 4 依赖 Task 2（需要 PIECE_STATS）
- Task 5 依赖 Task 4（需要 hp 字段）
- Task 6 依赖 Task 4
- Task 14 依赖 Task 4
- Task 10 依赖 Task 7（模式直接进入）
- Task 11/12 可与 Task 10 并行
- Task 15 依赖所有其他 Task
- Task 1/2/3 可并行（数据层基础）
