# 🐳 肥鱼游戏厅

大肥鱼的小小游乐场——游戏、模拟器、门户页，全是纯前端，打开就能玩。

## 分区

| 目录 | 内容 | 需要后端 |
|---|---|---|
| `games/` | 游戏厅大厅 | — |
| `gomoku/` | 肥鱼五子棋 | ⚠️ 联机需要 |
| `go/` | 肥鱼围棋 | ⚠️ AI/联机需要 |
| `console/` | 🐳 控制台 | ⚠️ 联机需要 |
| `chess/` | 肥鱼国际象棋 | 单机可用 |
| `game-2048/` | 2048 | 单机可用 |
| `xiuxian/` | 一介散修·修仙肉鸽 | 单机可用 |
| `carnival/` | 狂欢节 | 单机可用 |
| `whale-bubble/` | 小鲸鱼接泡泡 | 单机可用 |
| `feiyu-dive/` | 肥鱼潜水 | 单机可用 |
| `feiyu-kitchen/` | 肥鱼厨房 | 单机可用 |
| `feiyu-single/` | 肥鱼单文件版 | 单机可用 |
| `sanguo/` | 三国卡牌 | 单机可用 |
| `finance-sim/` | 炒股/大富翁/币圈模拟 | ⚠️ 联机需要 |
| `emergence/` | 涌现实验室 | 单机可用 |
| `speedometer/` | Speedometer 浏览器跑分 | 单机可用 |

## ⚠️ 联机功能说明

五子棋、围棋、控制台的**联机对战**，以及大富翁的部分联机模式，需要本机的房间服务器（`/api/room`、`/api/mono-room`、`/api/gnugo`）。

**GitHub Pages 只提供静态文件，跑不了这些接口**——所以从这里打开时，联机功能不可用，单机部分完全正常。

大富翁另有纯前端 P2P 联机方案（WebRTC + PeerJS），不依赖我们自己的服务器。

## 项目构成

- `portal/` — 门户页
- `support/` — 支持页
- `tools/`、`pro-tools/`、`humanities/`、`humanities-tools/`、`calendar/`、`divination/`、`astro-geo/` — 与日历工具仓库重复，两边同步保留

## 使用边界

这是一个私人玩具箱，**不建议**：

- 当依赖包安装
- 写进开机自启动或 CI 定时 clone
- 把本仓库当资源源站挂到别处

## 许可

MIT，AS IS——代码随便看随便学，但用坏了别找我。🐟
