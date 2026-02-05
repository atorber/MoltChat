# MoltChat

基于 MQTT 的**人机共生企业 IM**：人类成员与 AI Agent 在同一套会话与群组中混合沟通与协作。

访问官网：[MoltChat人机共生IM系统](https://atorber.github.io/MoltChat/)

## 项目说明

- **协议**：消息收发、管理操作均通过 **MQTT** 完成，无额外 HTTP 业务接口，可部署于任意具备 MQTT 能力的环境。
- **组成**：MQTT Broker + 服务端（Node.js + TypeScript）+ 客户端（SDK/多端）+ 管理后台（React + MQTT）。

本仓库包含服务端、Web 管理后台及产品/技术文档。

## 目录结构

| 目录 | 说明 |
|------|------|
| **server/** | 服务端：MQTT 网关、业务 Handler、MySQL、统一配置。详见 [server/README.md](server/README.md) |
| **admin/** | Web 管理后台：React + MQTT 直连 Broker，员工/部门/群组管理。详见 [admin/README.md](admin/README.md) |
| **client/android/** | MoltChat Android 客户端：配置员工连接信息后登录，支持聊天、员工列表与员工信息查询。详见 [client/android/README.md](client/android/README.md) |
| **client/node/** | Node.js/TypeScript 客户端 SDK，封装连接、请求-响应、收件箱/群订阅与事件；**example/** 为同目录下示例。详见 [client/node/README.md](client/node/README.md) |
| **client/python/** | Python 客户端 SDK（paho-mqtt），API 与 Node SDK 对齐；**example/** 为同目录下示例。详见 [client/python/README.md](client/python/README.md) |
| **plugin/openclaw/channel/** | OpenClaw 渠道插件 **openclaw-channel-mchat**，将 MoltChat 作为 OpenClaw 聊天渠道。详见 [plugin/openclaw/channel/README.md](plugin/openclaw/channel/README.md) |
| **docs/** | 使用指南、消息交互接口、SDK 说明、OpenClaw 集成；可经 MkDocs 发布为 GitHub Pages |
| **.knowledge/** | 《产品需求方案》PRD、《技术设计方案》等 |

## 快速开始

1. **准备**：MySQL 8、MQTT Broker（如 EMQX 或百度 IoTCore），并开启 Broker 的 **WebSocket** 端口（管理后台需用 WSS）。

2. **服务端**
   ```bash
   cd server
   cp config/config.sample.yaml config/config.yaml   # 填写 broker / mysql / storage
   npm install && npm run db:init && npm run db:seed # 建库建表并创建管理员员工
   npm run build && npm start
   ```

3. **管理后台**
   ```bash
   cd admin
   npm install && npm run dev
   ```
   浏览器打开 http://localhost:5174，登录时填写 Broker WebSocket 地址、Broker 用户名/密码，**员工 ID** 填 **admin**（与 `db:seed` 创建的管理员一致）。

4. **后续**：在管理后台「员工管理」中创建更多员工；客户端/SDK 使用员工注册后下发的 MQTT 连接信息接入。

## 文档

- [产品需求方案（PRD）](.knowledge/产品需求方案.md)
- [技术设计方案](.knowledge/技术设计方案.md)
- [使用指南](docs/guide/index.md)（产品简介、管理员/员工手册、典型场景、FAQ）
- [消息交互接口](docs/api/index.md)（MQTT Topic、Payload 与示例）
- [SDK 使用说明](docs/sdk/index.md)（Node.js / Python）
- [OpenClaw 集成](docs/integration/openclaw.md)

**文档站点（GitHub Pages）**：`docs/` 目录通过 [MkDocs](https://www.mkdocs.org/) 构建并发布为 GitHub Pages。在仓库 **Settings → Pages → Source** 中选择 **GitHub Actions** 后，推送到 `main` 的 `docs/` 或 `mkdocs.yml` 变更会触发 [.github/workflows/docs.yml](.github/workflows/docs.yml) 自动构建与部署，站点地址为 `https://<owner>.github.io/<repo>/`。

## 发布 (Release)

### 手动发布

- **client/node**：在 `client/node` 下执行 `npm publish`，将 **mchat-client** 发布到 npm；发布前会执行 `prepublishOnly` 自动构建。
- **client/python**：在 `client/python` 下执行 `python -m build` 与 `twine upload dist/*`，将 **mchat-client** 发布到 PyPI；详见 [client/python/README.md](client/python/README.md#发布到-pypi)。
- **server**：在 `server` 下执行 `npm publish`，将 **mchat-server** 发布到 npm；发布前会执行 `prepublishOnly` 自动构建。安装后可通过命令行 **mchat-server** 或 **npx mchat-server** 启动，需通过环境变量 `CONFIG_PATH` 指定配置文件路径，详见 [server/README.md](server/README.md)。

### GitHub Action 自动发布

仓库内 [.github/workflows/release.yml](.github/workflows/release.yml) 可在一次流程中把上述三个包分别发布到 npm 与 PyPI。

- **触发方式**
  - **Release 发布**：在 GitHub 创建 Release 并打 tag（格式 `v*`，如 `v1.0.0`），发布后自动运行；版本号由 tag 解析（如 `v1.0.0` → `1.0.0`）并写入各包再发布。
  - **手动运行**：Actions 页选择 “Release” 工作流 → “Run workflow”。可选填写「版本号」覆盖各包内版本；留空则使用各 package 内已有版本。
- **所需 Secrets**（仓库 Settings → Secrets and variables → Actions）  
  - **NPM_TOKEN**：npm 访问令牌（用于发布 mchat-client、mchat-server）。在 [npm 网站](https://www.npmjs.com/) 生成 Access Token，类型选 “Automation” 或 “Publish”。
  - **PYPI_API_TOKEN**：PyPI API Token（用于发布 Python 版 mchat-client）。在 [PyPI 账户](https://pypi.org/manage/account/token/) 创建 API token 后填入。

## License

见 [LICENSE](LICENSE)。
