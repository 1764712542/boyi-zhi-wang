# v11 Tasks

## 阶段一：修复技能选择生效 bug

- [ ] Task 1: state 初始化与技能选择链路修复
  - [ ] 1.1: state 初始化添加 `playerActiveSkill:null, playerPassiveSkill:null`
  - [ ] 1.2: 三英模式为每位武将单独存储技能
  - [ ] 1.3: PVP 对方技能 HUD 显示选中技能
  - [ ] 验证：选将面板选择任意技能后游戏内生效

## 阶段二：角色图鉴修复

- [ ] Task 2: 图鉴展示全部技能
  - [ ] 2.1: `renderCodexDetail` 展示 `ch.actives`（3 主动）
  - [ ] 2.2: B 王展示 5 个主动技能
  - [ ] 2.3: 修复技能描述中的英文/函数名
  - [ ] 验证：图鉴内容完整无乱码

## 阶段三：新手教程更新

- [ ] Task 3: 教程扩展为 8 步
  - [ ] 3.1: 更新 TUTORIAL_STEPS 数组
  - [ ] 3.2: 调整 index.html 教程进度指示
  - [ ] 验证：8 步教程完整显示

## 阶段四：最终校验

- [ ] Task 4: 全文件校验
  - [ ] 4.1: `node -c` 所有 JS 文件
  - [ ] 4.2: 验证技能选择→进入游戏→HUD 显示→释放技能全链路
  - [ ] 验证：无报错

# Dependencies
- Task 1 最高优先级（核心 bug）
- Task 2/3 可并行
- Task 4 依赖全部完成
