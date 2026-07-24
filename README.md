# 博弈之王 · 避其锋芒

> 中国象棋 · 角色对战版 — 传统象棋规则 + 角色技能系统 + 兵种相克 + HP/ATK/DEF 战斗体系

单机网页游戏（HTML5 Canvas + 原生 JS），支持 Electron 桌面打包。以「讨伐 B 王」为主线，融合角色技能、兵种相克、buff 系统等战棋元素。

---

## 特性

- **18 位角色**：每位角色拥有 3 个主动技能（选 1）+ 2 个被动技能（选 1），技能选择影响战局
- **HP/ATK/DEF 战斗体系**：棋子有血量/攻击/防御，仅进攻方掉血，兵种相克影响伤害
- **五大兵种相克**：核心 / 进攻 / 远程 / 防守 / 特殊，相生相克
- **B王三难度 AI**：青铜 / 钻石 / 王者，技能与思考深度逐级递增
- **六大游戏模式**：对战B王 / 双人对战 / 联机对战 / 三英战B王 / 故事模式 / 角色图鉴
- **Dota2 风格被动系统**：光环 / 被吃 / 吃子 / 周期 / 首回合 / 免疫 六大触发类型
- **WebRTC 联机**：网页版 P2P 联机对战，生成邀请码加入
- **程序化 BGM + SFX**：Web Audio API 合成，无外部音频文件
- **水墨美学 UI**：Ma Shan Zheng 字体 + 水墨主题 + 印章元素

---

## 快速开始

### 网页版

```bash
# 1. 启动本地服务器
python3 server.py

# 2. 浏览器访问
open http://localhost:8090
```

### 桌面应用（Electron）

```bash
# 安装依赖
npm install

# 本地运行
npm start
```

---

## 下载安装

前往 [Releases](../../releases) 下载对应平台的安装包：

| 平台 | 架构 | 文件 |
|------|------|------|
| Windows | x64 | `博弈之王-Setup-4.0.0-x64.exe` |
| Windows | ARM64 | `博弈之王-Setup-4.0.0-arm64.exe` |
| macOS | x64 (Intel) | `博弈之王-4.0.0-x64.dmg` |
| macOS | ARM64 (Apple Silicon) | `博弈之王-4.0.0-arm64.dmg` |
| Linux | x64 | `博弈之王-4.0.0.AppImage` / `.deb` |
| Linux | ARM64 | `博弈之王-4.0.0-arm64.AppImage` / `.deb` |
| 鸿蒙 | — | 使用网页版（浏览器打开 index.html 或部署到服务器） |

> 鸿蒙系统暂无原生打包，可通过内置浏览器访问网页版运行。

---

## 游戏模式

| 模式 | 说明 | 解锁条件 |
|------|------|----------|
| 对战B王 | PVE，三难度人机对战 | 通关故事模式 |
| 双人对战 | PVP，同设备轮流，支持 Ban 位 | 始终开放 |
| 联机对战 | WebRTC P2P 联机 | 始终开放 |
| 三英战B王 | 三将自动轮换共抗强化B王 | 通关故事模式 |
| 故事模式 | 7 章剧情，逐章解锁角色 | 始终开放 |
| 角色图鉴 | 全角色技能详解 + 击败B王攻略 | 始终开放 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 JS (ES5+)，无框架 |
| 渲染 | HTML5 Canvas |
| UI | HTML + CSS（水墨主题） |
| 头像 | 内联 SVG（`js/portrait.js` 生成） |
| 音频 | Web Audio API 程序化合成 |
| 联机 | WebRTC DataChannel（P2P） |
| 桌面端 | Electron |
| 数据存储 | localStorage |

---

## 文件结构

```
博弈之王/
├── index.html          # 主页面 DOM
├── game.js             # 游戏主逻辑（状态/流程/渲染/UI）
├── style.css           # 全局样式（水墨主题）
├── main.js             # Electron 主进程
├── preload.js          # Electron 预加载
├── package.json        # 打包配置（全平台）
├── server.py           # 本地开发服务器
├── js/
│   ├── data.js         # 数据层：常量 / 18角色 / 技能 / 阵营 / 故事
│   ├── engine.js       # 引擎层：棋盘逻辑 / AI / 伤害结算
│   ├── skills.js       # 技能层：被动触发 / 复活 / 召唤 / 光环
│   ├── portrait.js     # SVG 头像生成
│   └── audio.js        # BGM / 音效 / 语音
└── .trae/specs/        # 版本规格文档
```

**加载顺序**（index.html）：`data.js → engine.js → portrait.js → audio.js → skills.js → game.js`

---

## 打包构建

```bash
# 安装依赖
npm install

# 单平台打包
npm run build:win-x64       # Windows x64
npm run build:win-arm64     # Windows ARM64
npm run build:mac-x64       # macOS Intel
npm run build:mac-arm64     # macOS Apple Silicon
npm run build:linux-x64     # Linux x64
npm run build:linux-arm64   # Linux ARM64

# 全平台打包（需在对应平台执行交叉编译可能受限）
npm run build:all
```

打包产物输出到 `dist/` 目录。

---

## 核心数据结构

### 棋子属性

```js
const PIECE_STATS = {
  k: { hp: 300,  atk: 25,  def: 30, type: 'core' },      // 帅/将
  r: { hp: 180,  atk: 60,  def: 20, type: 'striker' },   // 车
  h: { hp: 150,  atk: 50,  def: 18, type: 'striker' },   // 马
  c: { hp: 120,  atk: 55,  def: 12, type: 'remote' },    // 炮
  a: { hp: 100,  atk: 15,  def: 35, type: 'defender' },  // 仕/士
  e: { hp: 100,  atk: 15,  def: 35, type: 'defender' },  // 相/象
  p: { hp: 200,  atk: 45,  def: 10, type: 'special' }    // 兵/卒
};
```

### 兵种相克

- 炮 打 非远程 → 炮不掉血
- 兵 受 非帅攻击 → 只受 50% 伤害
- 非炮 打 仕/相 → 攻击方虚弱（下回合 -30% 攻）
- 兵 打 帅 → +50% 伤害
- 车/马 攻击 → 无视防守方 30% 防御

---

## 击败 B 王攻略

### 核心克制角色

| 角色 | 技能 | 效果 |
|------|------|------|
| 刘雪沛 | 破妄之眼 | 沉默B王3回合，被动「宿敌」对B王伤害+50% |
| 仙帝Alice | 仙帝降临 | 3步回溯+无敌+预判，被动「仙帝威压」压制B王技能 |
| 大爱仙尊（古月方源） | 大爱无疆 | 感化敌方最强子为己用，噬蛊祭道真实伤害 |
| 解宇轩 | 因果律锁 | 锁定B王强子3回合 |

详见游戏内「角色图鉴 → 击败B王攻略」。

---

## 开发规范

- 使用 `'use strict';`
- 函数命名：`camelCase`，常量：`UPPER_SNAKE_CASE`
- 坐标结构：`{r, c}` / `{row, col}`（移动操作统一 `{from:{r,c}, to:{r,c}}`）
- 所有技能数值加成通过 buff 系统实现（`addBuff` / `addTeamBuff` / `consumeBuff`）
- `calcDamage()` 只从棋子 buff 数组读取属性修改
- 修改后运行 `node -c` 校验所有 JS 文件

```bash
node -c js/data.js && node -c js/engine.js && node -c js/skills.js && \
node -c js/portrait.js && node -c js/audio.js && node -c game.js
```

---

## 版本历史

- **v19** — 图鉴替换帮助 / 全局bug修复（8个失效技能 / 三英CD / PVP减速方向）
- **v18** — 双方面板 / Ban网格 / 三英自动轮换 / WebRTC联机
- **v17** — PVP技能目标修正 / 被动显示 / silenceTurns
- **v16** — buff深克隆 / executeMark消耗 / 动态CD
- **v7** — 兵种平衡性重构 / HP体系

完整记录见 `项目修改记录.md`。

---

## License

MIT

---

> 以退为进 · 以柔克刚
