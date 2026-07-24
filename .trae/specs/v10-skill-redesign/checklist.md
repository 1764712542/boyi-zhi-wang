# v10 技能重设计 Checklist

## 技能选择生效
- [ ] getActiveSkillForPlayer 函数已实现
- [ ] usePlayerSkill 使用选中技能而非默认技能
- [ ] updateSkillDisplay 显示选中技能名称/描述/CD
- [ ] 角色详情弹窗显示选中技能
- [ ] 选将面板选择第2/3技能后游戏内可释放

## 替代技能实现
- [ ] 侯智博 flank/ambush 已实现
- [ ] 王昕 mock/quiz 已实现
- [ ] 周子翰 elegant/grandshift 已实现
- [ ] 三金 execute/barrage 已实现
- [ ] 鸡哥 illusion/feint 已实现
- [ ] ikun rhythm/allyours 已实现
- [ ] 胡浩 shield/unity 已实现
- [ ] 解宇轩 silence/logicblast 已实现
- [ ] 陆星辰 debug/crash 已实现
- [ ] 唐昊博涵 cheat/exam 已实现
- [ ] 仙帝Alice descent/judgment 已实现
- [ ] 刘雪沛 真相揭示/净化之光 已实现
- [ ] 大汉棋圣 棋圣降临/天下无敌 已实现
- [ ] 刘佳伟 稳扎稳打/后发制人 已实现
- [ ] 袁清山 龙跃九天/潜龙出水 已实现
- [ ] 罗伦杰 斩铁/万斩 已实现
- [ ] 大爱仙尊 大爱无疆/仙尊降临 已实现

## 数值平衡
- [ ] 伤害类技能在 30-150 范围
- [ ] 治疗类技能为 30-50% 最大HP
- [ ] Buff持续 1-3 回合
- [ ] 角色属性(int)影响技能伤害
- [ ] 无秒杀/无效情况

## 被动技能
- [ ] 所有被动 case 已补全
- [ ] AURA 光环正确触发
- [ ] IMMUNE 免疫正确触发
- [ ] PERIODIC 周期性正确触发
- [ ] ON_CAPTURE/ON_CAPTURED 正确触发

## 角色图鉴
- [ ] 显示3主动+2被动完整技能
- [ ] B王显示5主动技能
- [ ] 无英文/函数名
- [ ] 选中态标记

## 新手教程
- [ ] 8步教程完整
- [ ] 包含模式与解锁
- [ ] 包含HP/atk/def体系
- [ ] 包含技能选择说明
- [ ] 包含Buff系统说明

## 文档与校验
- [ ] 项目修改记录已更新v10章节
- [ ] node -c 所有JS文件通过
- [ ] 全流程无报错
