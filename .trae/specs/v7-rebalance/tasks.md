# Tasks

## 阶段一：数据层重构

- [x] Task 1: 兵种类型与平衡性数据
  - [x] 1.1: 在 `js/data.js` 新增 `PIECE_TYPE` 兵种分类常量（remote/striker/defender/special/core）
  - [x] 1.2: 重写 `PIECE_STATS`，整体提升 HP 3-5 倍，按兵种类型设定差异化数值
  - [x] 1.3: 兵种数值设计：
    - 帅(k/core): HP 300, atk 25, def 30
    - 车(r/striker): HP 180, atk 60, def 20
    - 马(h/striker): HP 150, atk 50, def 18
    - 炮(c/remote): HP 120, atk 55, def 12
    - 相(e/defender): HP 100, atk 15, def 35
    - 士(a/defender): HP 100, atk 15, def 35
    - 兵(p/special): HP 200, atk 45, def 10
  - [x] 验证：数据结构正确，node -c 通过

- [x] Task 2: 技能系统扩展为 3 主动 + 2 被动
  - [x] 2.1: 在 `js/data.js` 为每个角色定义 `actives` 数组（3 个主动技能）
  - [x] 2.2: 保留 `passives` 数组（2 个被动技能），保留 `skill` 字段兼容
  - [x] 2.3: B王已有 5 个主动技能，取前 3 个作为 `actives`，其余 2 个作为高难度解锁
  - [x] 2.4: 其他角色：将原 `skill` 字段作为第 1 主动技能，新增 2 个主动技能（参考 Dota2 机制）
  - [x] 2.5: 技能机制参考 Dota2：沉默、禁锢、闪烁、幻象、减速、护盾等
  - [x] 验证：所有角色有 3 主动 + 2 被动

## 阶段二：战斗系统重做

- [x] Task 3: 兵种相克伤害结算
  - [x] 3.1: 在 `js/engine.js` 新增 `PIECE_TYPE` 兵种判定
  - [x] 3.2: 重写 `calcDamage(attacker, defender)` 函数，按兵种相克规则计算
  - [x] 3.3: 在 `game.js` 的 `doMove` 中调用新的 `calcDamage`
  - [x] 3.4: 实现"虚弱"buff 状态（下回合攻击-30%）
  - [x] 验证：17 项兵种相克场景测试通过

- [x] Task 4: 血条与攻防显示优化
  - [x] 4.1: 放大血条尺寸（4px→6px），增加对比度
  - [x] 4.2: 棋子下方显示 HP 数值（300/300 格式）
  - [x] 4.3: 血条颜色按 HP 比例变化（绿→黄→红）
  - [x] 4.4: 虚弱 buff 显示"虛"字标记
  - [x] 验证：棋盘上血量、攻防、buff 清晰可见

## 阶段三：UI 与交互

- [x] Task 5: HUD 状态栏
  - [x] 5.1: 在 `index.html` 新增 HUD 容器（棋盘旁 flex 列）
  - [x] 5.2: 在 `game.js` 实现 `renderHUD()` 函数
  - [x] 5.3: 在 `style.css` 设计 HUD 样式（水墨主题）
  - [x] 5.4: 每回合更新 HUD（挂在 renderAll 末尾）
  - [x] 验证：HUD 显示完整，不遮挡棋盘

- [x] Task 6: 棋子操作菜单
  - [x] 6.1: 点击己方棋子后显示操作菜单
  - [x] 6.2: "进攻"进入移动模式（原逻辑）
  - [x] 6.3: "详情"显示棋子属性弹窗（HP/攻防/兵种/buff）
  - [x] 6.4: 在 `style.css` 设计菜单样式（水墨风格）
  - [x] 验证：选中棋子弹出菜单，两个选项均可用

- [x] Task 7: 选将屏技能调整
  - [x] 7.1: 选将屏角色卡片显示 3 个主动技能（可选 1）
  - [x] 7.2: 保留 2 个被动技能（可选 1）
  - [x] 7.3: 技能选择可切换，选中态高亮（金色主动/朱红被动）
  - [x] 7.4: 选将确认时记录 state.playerActiveSkill / state.playerPassiveSkill
  - [x] 验证：选将时可调整技能

## 阶段四：模式与流程

- [x] Task 8: 多人模式封闭
  - [x] 8.1: 在 `index.html` 为 4v4 模式卡片添加"即将开放"遮罩
  - [x] 8.2: 在 `game.js` 屏蔽点击事件（disabled 类检查）
  - [x] 验证：4v4 模式不可选

- [x] Task 9: 阵营选人去重
  - [x] 9.1: B王阵营去掉 luolunjie，加入 liuxuepei
  - [x] 9.2: factionSelectedChars 数组实现跨阵营去重
  - [x] 9.3: 对局开始时 B王阵营自动作为对方阵营加入（随机选角）
  - [x] 验证：阵营选人无重复，B王阵营含刘雪沛

- [x] Task 10: 故事模式解锁自由对局
  - [x] 10.1: isStoryCompleted() 检查故事模式完成状态
  - [x] 10.2: PVE 卡片显示"完成故事模式后解锁"遮罩
  - [x] 10.3: PVP 模式始终可选
  - [x] 验证：未完成故事模式时自由对局不可选（修复进度推进 bug）

## 阶段五：教程与收尾

- [x] Task 11: 新手教程系统
  - [x] 11.1: 在 `index.html` 新增教程容器
  - [x] 11.2: 5 步教程引导（欢迎/选棋/移动/兵种相克/技能）
  - [x] 11.3: 教程可跳过，记录到 localStorage
  - [x] 11.4: 在 `style.css` 设计教程弹窗样式（水墨主题）
  - [x] 验证：首次进入触发教程，可跳过

- [x] Task 12: 最终校验
  - [x] 12.1: `node -c` 校验所有 JS 文件（全部通过）
  - [x] 12.2: 浏览器全流程测试：选将→对弈→技能→胜负
  - [x] 12.3: 兵种相克场景测试（17 项断言通过）
  - [x] 12.4: 阵营选人去重测试
  - [x] 12.5: 教程触发测试
  - [x] 验证：全流程无报错

# Task Dependencies
- Task 1/2 可并行（数据层）
- Task 3 依赖 Task 1（需要 PIECE_TYPE）
- Task 4 依赖 Task 3（需要血量字段）
- Task 5 依赖 Task 3（需要 buff 系统）
- Task 6/7 可并行
- Task 8/9/10 可并行
- Task 11 依赖 Task 6（操作菜单）
- Task 12 依赖所有其他 Task
