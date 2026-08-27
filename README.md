# 慧签 HuiQian · 智能考勤系统

> 离线可用、**双因子（指纹+人脸）+ 活体防代签** 的完整考勤系统。
> 架构：**K210 端侧触发 + 树莓派 5 核心 + AS608 指纹 + 微信小程序/桌面端**。

## ✨ 亮点
- 🔐 **双因子防代签**：指纹（你有的）+ 人脸（你是的）+ 随机动作活体（左右摇头、上下点头、张嘴）
- 📴 **完全离线**：数据本地存储，断网照常打卡
- 🔗 **全链路闭环**：硬件 → 识别 → 数据库 → API → 小程序/桌面，一键打卡、周统计、排行榜
- 🔊 **人性化语音**：当天第一位"早起的鸟儿有虫吃"、21 点后"辛苦了晚安"、时段结束前放大音量提醒

## 🏗 项目结构
```
├── backend/                 # 树莓派 5 后端（核心）
│   ├── app.py              # Flask API（约 25 个接口，供小程序/桌面调用）
│   ├── attendance.py       # 数据层：SQLite / 打卡规则 / 周统计 / 密码
│   ├── auth_middleware.py  # 网页管理端 Bearer Token 管理员认证
│   ├── admin_cli.py        # 初始化管理员账号的命令行工具
│   ├── tests/              # 后端认证与接口保护测试
│   ├── face_engine.py      # 人脸识别：MediaPipe + dlib 128维特征 + 活体
│   ├── as608.py            # AS608 指纹模块驱动
│   ├── voice.py            # 语音播报（aplay → bluealsa → 蓝牙音箱）
│   ├── k210_link.py        # K210 联动服务（串口协议/打卡/录入/指纹）
│   ├── enroll.py / enroll_fp.py   # 录入辅助
│   ├── models/             # MediaPipe 人脸模型
│   ├── voice/              # 预生成语音（含三种随机动作提示音）
│   ├── systemd/            # 开机自启服务
│   └── scripts/            # 网络/蓝牙/部署脚本
├── k210/                   # K210 端固件 + 刷机脚本
│   ├── k210_main_standalone.py   # K210 主程序（面板/打卡/录入/排行榜）
│   └── push_file.py / push_main_chunked.py   # 刷机工具
├── admin-web/              # 管理电脑上的 Vue + Express 网页管理端
│   ├── src/                # Vue 页面和组件
│   ├── server/src/         # Web 网关和树莓派 API 代理
│   ├── public/             # 静态资源
│   └── package.json        # 前端和网关脚本
└── README.md
```

## 🚀 快速启动（树莓派 5）
```bash
cd backend
pip install -r requirements.txt
python3 app.py            # 后端 API → 0.0.0.0:8000
python3 k210_link.py      # 联动服务（需 K210 串口）
```
开机自启：把 `backend/systemd/*.service` 复制到 `/etc/systemd/system/` 并 `systemctl enable`。
K210 固件烧录：`python3 k210/push_file.py k210/k210_main_standalone.py /flash/main.py`（K210 需连电脑 COM 口）。

## 🌐 网络方案（稳定：Pi 自开热点）
- 树莓派开机自动开热点 **`HuiQian`（密码 `12345678`）**，IP `10.42.0.1`；
- 电脑/手机连上热点后，后端地址 = **`http://10.42.0.1:8000`**；
- 小程序/真机需勾选「不校验合法域名」；接口细节见 `docs/小程序API接口文档.md`。

## 🔑 密码登录
- 录入人脸时自动生成默认密码 **`123456qmx`**；
- `/api/login`（姓名+密码）登录并绑定 openid；`/api/set_password` 管理员改密码；
- 规则：≥8 位、至少两种字符；密码**加盐哈希**存储。

## 🛡️ 网页管理端

- 🖥️ **Vue + Express 管理台**：在管理电脑上查看和维护考勤数据
- 👥 **人员档案管理**：查看人员、修改姓名和角色
- 📷 **考勤记录查询**：查看签到、签退、考勤照片和在场人数
- 📊 **统计与日志**：查看周统计、操作日志和考勤汇总
- ⚙️ **系统配置**：调整打卡时间窗口并管理普通管理员账号
- 🔌 **本地网关代理**：Vite 开发服务器使用 `5173`，Express 网关使用 `3001`，统一代理树莓派 API

管理网页代码位于 `admin-web/`，运行前需要先启动树莓派后端。

### 配置

```bash
cd admin-web
cp .env.example .env
```

编辑 `.env`，将 `PI_BASE_URL` 设置为树莓派地址。例如：

```env
PI_BASE_URL=http://10.42.0.1:8000
WEB_PORT=3001
WEB_HOST=0.0.0.0
WEB_SESSION_SECRET=请替换为足够长的随机字符串
```

不要提交 `.env`，只提交 `.env.example`。

### 开发运行

需要先启动树莓派后端，再在 `admin-web` 目录安装依赖：

```bash
cd admin-web
npm ci
```

另开两个终端分别启动网关和页面：

```bash
# 终端一
npm run server:dev
```

```bash
# 终端二
npm run dev -- --host 0.0.0.0 --port 5173
```

浏览器访问 `http://127.0.0.1:5173/`。

### 生产运行

```bash
cd admin-web
npm ci
npm run start
```

浏览器访问 `http://127.0.0.1:3001/`。生产模式下 Express 网关会同时提供网页静态文件。



## 🖥 核心流程
| 流程 | 说明 |
|---|---|
| 打卡 | K210 检测人脸 → TRIGGER → Pi 指纹(可选) → 人脸+随机动作活体 → 写库+语音 |
| 录入 | 录入信息：人脸 3 张 →（有 AS608）指纹 2 次 → 自动编号/默认密码 |
| 排行榜 | K210 请求 → Pi 生成排行图片 → K210 显示翻页 |
| 小程序 | 登录 → 我的/周统计/明细/照片/排行榜/在场人数 |

## 🤝 团队
2 软件 + 2 硬件，全链路自研（含自制蓝牙音箱、自主调试解决蜂鸣器/串口/音频等工程问题）。
