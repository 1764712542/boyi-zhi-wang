# v11 Checklist

## 技能选择生效
- [ ] state 初始化包含 `playerActiveSkill` 和 `playerPassiveSkill`
- [ ] 三英模式每位武将独立存储选中技能
- [ ] PVP 模式 HUD 显示对方选中技能（非默认技能）
- [ ] 选将面板选第 2/3 主动技能后游戏内 HUD 正确显示

## 角色图鉴
- [ ] 图鉴展示每个角色 3 个主动技能
- [ ] B 王图鉴展示 5 个主动技能
- [ ] 技能描述无英文 ID / 函数名
- [ ] 被动技能展示触发时机标签

## 新手教程
- [ ] 教程共 8 步
- [ ] 包含模式与解锁说明
- [ ] 包含 HP/atk/def 战斗体系说明
- [ ] 包含技能选择说明
- [ ] 包含 buff 与棋子合并说明

## 校验
- [ ] `node -c game.js` 通过
- [ ] `node -c js/data.js` 通过
- [ ] `node -c js/engine.js` 通过
- [ ] `node -c js/skills.js` 通过
- [ ] `node -c js/audio.js` 通过
- [ ] `node -c js/portrait.js` 通过
