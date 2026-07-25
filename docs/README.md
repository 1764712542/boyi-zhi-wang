---
created: 2026-07-25
type: moc
tags: [docs, index, moc]
---

# 博弈之王 · 文档中心

> A级文档体系 — 防幻觉 · 防错漏 · 强约束 · 可追溯

## 📚 文档地图（MOC）

### 🔒 核心规范（必读）
- [[HARD_CONSTRAINTS|硬约束总纲]] — 所有不可违反的规则与注意力机制
- [[CHANGE_PROCESS|变更流程规范]] — 从需求到上线的A级流程
- [[ANTI_HALLUCINATION|防幻觉审查清单]] — 每次改动前的强制检查
- [[SELF_LEARNING|自我学习机制]] — PDCA闭环 + 自动纠错 + 幻觉防御 + 三阶学习模型（v37增强）
- [[UI_SELF_AUDIT|UI自我审查机制]] — 动态化强制清单 + 审美对标大游戏（v36新增）
- [[USER_FEEDBACK|用户反馈档案]] — 持久化用户偏好/约束/纠正（v37新增）

### 🏗️ 架构与模块
- [[ARCHITECTURE|模块化架构]] — 文件职责、依赖关系、细分建议
- [[MODULE_BOUNDARIES|模块边界]] — 各模块的输入输出契约

### 🎮 技能与角色系统
- [[SKILL_RAG|技能RAG注册表]] — 意图匹配 + 提示词工程
- [[CHARACTER_REGISTRY|角色注册表]] — 角色属性/技能/约束（动态数量，禁止硬编码）
- [[BUFF_SYSTEM|Buff系统手册]] — 所有buff类型与calcDamage识别

### 📋 变更记录
- [[项目修改记录]] — 根目录文件，最新置顶，v22+ 保留主文件

### 🗄️ 历史归档
- [[归档索引]] — `docs/archive/` 目录索引（按月份归档）
  - `docs/archive/2026-07/` — 设计文档 v3/v4 + 项目修改记录 v5-v21 等过时文档

## 🔍 快速导航

| 我想要... | 去哪查 |
|----------|--------|
| 修改角色技能 | [[SKILL_RAG]] + [[HARD_CONSTRAINTS#技能设计约束]] |
| 查阅角色属性 | [[CHARACTER_REGISTRY]] + `js/data.js` CHARACTERS |
| 新增buff类型 | [[BUFF_SYSTEM]] + [[ARCHITECTURE#engine.js]] |
| 修复bug | [[ANTI_HALLUCINATION]] + [[CHANGE_PROCESS#bug修复流程]] |
| 重构模块 | [[ARCHITECTURE]] + [[MODULE_BOUNDARIES]] |
| 理解项目约束 | [[HARD_CONSTRAINTS]] |
| 查阅历史版本/归档 | [[归档索引]] + `docs/archive/` |
| 查阅版本修改记录 | [[项目修改记录]]（根目录） |

## 📐 文档等级

| 等级 | 含义 | 维护要求 |
|------|------|----------|
| **A级** | 不可违反的硬约束 | 每次变更必须同步更新 |
| **B级** | 强烈建议遵循 | 版本迭代时审查 |
| **C级** | 参考性指南 | 按需更新 |

## 🔄 文档维护原则

1. **变更即更新** — 代码改动后必须同步对应文档
2. **最新置顶** — 变更日志新版本在上，旧版本在下
3. **过时即清理** — 超过3个版本的旧记录可归档或删除
4. **wikilink互联** — 使用 `[[文档名]]` 而非相对路径
5. **frontmatter必填** — 每个文档必须有 created/type/tags

## 🤖 AI协作入口

任何AI代理（Codex/Claude/Trae）在修改本项目前，按以下顺序阅读：

1. **AGENTS.md**（项目根）— 项目概述与基础约束
2. **[[HARD_CONSTRAINTS]]** — 所有硬约束与注意力机制
3. **[[ANTI_HALLUCINATION]]** — 防幻觉审查清单
4. **[[SELF_LEARNING]]** — 自我学习闭环与自动纠错（v37增强：三阶学习模型）
5. **[[UI_SELF_AUDIT]]** — 前端动态化与审美审查（v36新增）
6. **[[USER_FEEDBACK]]** — 用户反馈档案（v37新增，会话启动必读）
7. **[[SKILL_RAG]]** — 如涉及技能改动
8. **[[ARCHITECTURE]]** — 如涉及代码结构

相关：[[HARD_CONSTRAINTS]] · [[CHANGE_PROCESS]] · [[SKILL_RAG]] · [[ARCHITECTURE]] · [[MODULE_BOUNDARIES]] · [[CHARACTER_REGISTRY]] · [[BUFF_SYSTEM]] · [[ANTI_HALLUCINATION]] · [[SELF_LEARNING]] · [[UI_SELF_AUDIT]] · [[USER_FEEDBACK]] · [[归档索引]] · [[项目修改记录]]
