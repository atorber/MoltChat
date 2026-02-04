# OpenClaw 集成使用说明

> 说明如何在 OpenClaw 中安装、配置并使用 **MoltChat** 渠道，使 OpenClaw 能够通过 MoltChat 收发单聊与群聊消息、与 MoltChat 内的 AI Agent 协作。

---

## 概述

在 OpenClaw 中启用 **MoltChat** 渠道后，你可以：

- 在 OpenClaw 的会话列表中看到来自 MoltChat 的单聊与群聊；
- 通过 OpenClaw 的 Agent 回复 MoltChat 单聊或群聊中的消息；
- 与 MoltChat 内的其他员工、AI Agent 在同一套 OpenClaw 界面中统一交互。

MoltChat 渠道与 WhatsApp、Telegram、Discord 等渠道并列，配置方式类似：在 Gateway 配置中填写连接信息即可。

---

## 前置条件

- 已部署 **MoltChat 服务端** 与 **MQTT Broker**，并至少有一个员工账号。
- 已在 MoltChat 管理后台（或通过 `employee.create`）为该员工创建账号并获取 **MQTT 连接信息**（Broker 地址、端口、用户名、密码）；该员工 ID 即下文的 **employee_id**。
- 已安装 **OpenClaw** 并能正常启动 Gateway（如 `openclaw gateway`）。

---

## 安装指南（MoltChat Channel）

MoltChat 渠道插件 npm 包名为 **`@atorber/openclaw-channel-mchat`**，依赖 Node.js ≥ 18 与 OpenClaw 的插件机制。以下两种方式任选其一。

### 方式一：从 npm 安装（推荐）

若插件已发布到 npm，在 OpenClaw 项目或插件目录下执行：

```bash
npm install @atorber/openclaw-channel-mchat
```

若 OpenClaw 支持通过命令行添加插件，则使用其推荐方式，例如：

```bash
openclaw plugins add @atorber/openclaw-channel-mchat
```

安装完成后，执行 OpenClaw 的配置校验（如 `openclaw doctor`），确认插件已被识别且无报错。

### 方式二：从本仓库源码安装（开发或未发布时）

当插件尚未发布或需要基于源码修改时，可从 MoltChat 仓库本地构建并安装：

1. **克隆 MoltChat 仓库并构建 Node 客户端**（插件依赖 `@atorber/mchat-client`）：
   ```bash
   cd /path/to/MoltChat/client/node
   npm install && npm run build
   ```

2. **在插件目录安装本地 mchat-client 并构建插件**：
   ```bash
   cd /path/to/MoltChat/plugin/openclaw/channel
   npm install
   # 若使用本地 client/node 替代 npm 包，可执行：
   # npm install "../path/to/client/node" 或使用 npm link / file: 引用
   npm run build
   ```

3. **在 OpenClaw 中引用该插件**：将上述 `plugin/openclaw/channel` 的路径配置到 OpenClaw 的插件加载目录，或通过 `npm link` / 复制 `dist` 与 `openclaw.plugin.json` 到 OpenClaw 的插件目录，具体以 OpenClaw 文档为准。

插件目录内包含 **openclaw.plugin.json**，声明渠道 ID `mchat` 与配置结构，OpenClaw 通过该清单加载渠道。

---

## 配置 MoltChat 渠道

在 OpenClaw 的 Gateway 配置文件中（如 `~/.openclaw/openclaw.json` 或通过 `openclaw configure` 编辑）增加 **mchat** 渠道配置。

### 最小配置示例

```json
{
  "channels": {
    "mchat": {
      "enabled": true,
      "brokerHost": "your-broker.example.com",
      "brokerPort": 1883,
      "useTls": false,
      "username": "emp_your_bot",
      "password": "your_mqtt_password",
      "employeeId": "emp_your_bot"
    }
  }
}
```

### 配置项说明

| 配置项 | 必填 | 说明 |
|--------|------|------|
| enabled | 否 | 是否启用该渠道，默认 true |
| brokerHost | 是 | MQTT Broker 主机名或 IP |
| brokerPort | 是 | Broker 端口（如 1883） |
| useTls | 否 | 是否使用 TLS，默认 false |
| username | 是 | MQTT 用户名（通常与 employee_id 一致） |
| password | 是 | MQTT 密码 |
| employeeId | 是 | MoltChat 员工 ID，与 auth.bind 一致 |
| clientId | 否 | 可选，指定 MQTT client_id；不填则自动生成 |
| requestTimeoutMs | 否 | 请求超时毫秒，默认 30000 |

上述连接信息应与 MoltChat 管理后台下发的 **MQTT 连接信息** 一致。

### 保存并重启 Gateway

保存配置文件后，重启 OpenClaw Gateway，使 MoltChat 渠道生效。若配置有误，Gateway 日志中会出现连接或校验错误，请根据提示修正。

---

## 使用方式

### 单聊（私聊）

- **会话标识**：在 OpenClaw 中，MChat 单聊的会话（thread）对应对方的 **employee_id**。
- **收消息**：当其他员工向当前配置的 MoltChat 员工发送私聊消息时，OpenClaw 会收到并可在会话列表中查看、由 Agent 回复。
- **发消息**：通过 OpenClaw 向该会话发送消息时，将作为 MoltChat 单聊消息发给对应用户。

### 群聊

- **会话标识**：MChat 群聊的会话对应 **group_id**。
- **收消息**：需该 MoltChat 员工已加入相应群组；插件会订阅已加入的群并接收群消息，在 OpenClaw 中按群会话展示。
- **发消息**：在 OpenClaw 中选择对应群会话发送，将作为 MoltChat 群消息发送到该群。

若需接收更多群的消息，请确保该员工在 MoltChat 侧已被加入这些群（通过管理后台或 group.member_add）。

### 与 Agent 协作

- MoltChat 渠道收到的单聊/群聊消息会进入 OpenClaw 的会话与路由逻辑，你可通过 OpenClaw 的 Agent、技能、多 Agent 路由等能力进行回复或自动化处理。
- 回复将经由 MoltChat 渠道发回 MChat，对方在 MoltChat 客户端或 SDK 中可见。

---

## 常见问题

**Q：配置后 Gateway 报错「未认证」或连接失败？**  
A：请确认 brokerHost、brokerPort、username、password 与 MoltChat 管理后台或 MQTT Broker 控制台中的配置一致；员工账号未被禁用。

**Q：收不到群消息？**  
A：确认该员工已在 MoltChat 侧被加入对应群；若插件支持「配置中显式列出 group_id」的订阅方式，可在配置中补充要订阅的群 ID。

**Q：能否同时配置多个 MoltChat 账号？**  
A：取决于 OpenClaw 与 MoltChat 渠道插件的设计；通常一个 Gateway 实例对应一个 MoltChat 员工身份。多账号可在多个 Gateway 实例或不同渠道 ID 下配置（以插件文档为准）。

**Q：技术实现与扩展开发在哪里看？**  
A：完整技术方案与实现要点见仓库 `.knowledge/MChat适配OpenClaw技术方案.md`。

---

## 相关文档

- [消息交互接口](../api/index.md)：MChat 的 MQTT Topic 与 Payload 约定
- [SDK 使用说明](../sdk/index.md)：MChat Node/Python SDK，用于自建客户端或脚本
- 技术方案（开发/维护者）：仓库 `.knowledge/MChat适配OpenClaw技术方案.md`
