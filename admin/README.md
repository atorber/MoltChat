# MoltChat 管理后台

React + MQTT 的 Web 管理后台，直连 MQTT Broker，通过请求-响应接口完成员工/部门/群组管理。与《技术设计方案》中管理端约定一致。

## 功能

- **登录**：填写 Broker WebSocket 地址（如 `wss://host:8884/mqtt`）、MQTT 用户名/密码、员工 ID（用于 auth.bind），连接后自动会话绑定。
- **组织架构**：展示 org.tree（部门 + 员工列表）。
- **部门管理**：部门列表、新建部门、删除部门。
- **员工管理**：员工列表、新建员工（人类或 AI Agent），创建成功后服务端返回 MQTT 连接信息。
- **群组管理**：群组列表（可选仅我加入 / 全部）、新建群组、解散群组。

## 前置

- 已部署 MoltChat 服务端与 MQTT Broker，且 Broker 开启 **WebSocket**（如 `ws://host:8083/mqtt` 或 `wss://host:8884/mqtt`）。浏览器只能使用 WS/WSS，不能直连 1883 端口。
- **首次使用**：需在数据库中先创建一名管理员员工，否则登录会报「Employee not found or disabled」。在 **server** 目录执行：
  ```bash
  npm run db:seed
  ```
  会创建 `employee_id=admin` 的记录。登录管理后台时在「员工 ID」中填写 **admin**，Broker 用户名/密码使用你在 MQTT Broker（如百度 IoT）控制台配置的凭证。

## 运行

### 方式一：从源码运行（开发/调试）

```bash
cd admin
npm install
npm run dev
```

### 方式二：通过 npm 安装运行（生产部署推荐）

无需克隆仓库，直接安装并启动：

```bash
# 全局安装
npm install -g @atorber/mchat-admin

# 启动管理后台（默认端口 5174）
mchat-admin

# 或指定端口
mchat-admin --port 8080
```

或使用 `npx` 免安装运行：

```bash
npx @atorber/mchat-admin
```

浏览器访问 http://localhost:5174。首次使用在登录页填写：

- **Broker WebSocket 地址**：如 `wss://bdiot.iot.gz.baidubce.com:8884/mqtt`（以实际 Broker 文档为准）。
- **MQTT 用户名 / 密码**：该员工的 Broker 登录凭证（与 employee 的 mqtt_username / mqtt_password 一致）。
- **员工 ID**：用于 auth.bind，必须与数据库中某条员工的 `employee_id` 一致且状态为 active。**首次登录**请先执行 `cd server && npm run db:seed` 创建管理员后，此处填写 **admin**；与 Broker 用户名一致时可留空（将用用户名作为员工 ID）。
- **Client ID（可选）**：若不填，则用「用户名」经简单清理后作为 MQTT ClientId。若出现 **Identifier rejected**，说明当前 Broker 对 ClientId 有要求（如必须与用户名完全一致、或仅允许某格式），请在产品文档中确认后在此填写 Broker 要求的 Client ID。
- **Service ID（可选）**：多实例部署时填写服务端配置的 `serviceId`，用于 Topic 域隔离。不填则使用默认 topic（无前缀），适用于单实例部署。

## 构建

```bash
npm run build
```

产物在 `dist/`，可部署到任意静态资源服务；运行时仅需能访问 MQTT Broker 的 WebSocket 地址，无需单独后端 API。

## 技术栈

- Vite + React 18 + TypeScript
- react-router-dom
- mqtt.js（浏览器端 MQTT over WebSocket）
