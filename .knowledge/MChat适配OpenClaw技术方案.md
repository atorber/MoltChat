# MChat 适配 OpenClaw 技术方案

> 目标：将 MChat 作为 OpenClaw 支持的聊天渠道之一，使用户可在 OpenClaw 中通过「MChat」通道与 MChat 单聊/群聊及 AI Agent 交互，与 WhatsApp、Telegram、Discord、iMessage 等并列。

**文档版本**：1.0

---

## 一、目标与范围

### 1.1 目标

- 在 OpenClaw 的「Chat Channels」中新增 **MChat** 渠道。
- 用户配置 MChat 连接信息（Broker、员工身份）后，OpenClaw Gateway 通过 MQTT 连接 MChat，接收收件箱/群消息并投递给 Agent；Agent 回复通过 MChat 发送单聊/群消息。
- 与现有 MChat 协议、服务端、SDK 完全兼容，不修改 MChat 服务端与 Broker 行为。

### 1.2 范围

- **在 OpenClaw 侧**：新增 MChat 渠道实现（推荐以 **OpenClaw 插件 / Channel Provider** 形式）。
- **在 MChat 侧**：无变更；复用现有 MQTT Topic、Payload、auth.bind、msg.send_private、msg.send_group、inbox/group 订阅等。
- **不包含**：OpenClaw 核心代码 fork、MChat 服务端或 Broker 改造。

---

## 二、OpenClaw 架构要点（与适配相关）

### 2.1 Gateway 与渠道

- **Gateway**：单进程常驻守护进程，**拥有所有 messaging surfaces**（WhatsApp、Telegram、Discord、Slack、Signal、iMessage、WebChat 等）。
- **渠道**：每个 IM 平台对应一个「渠道」实现，由 Gateway 加载；渠道负责与该平台建立连接、接收消息并转为 Gateway 内部 **chat** 事件、处理 Gateway 下发的 **send** 请求并调用平台 API 发消息。
- **协议**：Gateway 对外暴露 **WebSocket API**（默认 `127.0.0.1:18789`），帧格式：请求 `{type:"req", id, method, params}`、响应 `{type:"res", id, ok, payload|error}`、服务端推送事件 `{type:"event", event, payload}`。首帧必须为 **connect** 握手。

### 2.2 插件与渠道注册

- OpenClaw 支持 **插件**，插件可在清单文件 **`openclaw.plugin.json`** 中声明：
  - **`channels`**：该插件注册的渠道 ID 数组（如 `["matrix"]`、`["mattermost"]`）。
  - **`configSchema`**：插件配置的 JSON Schema，用于校验而不执行插件代码。
- 渠道配置写在 Gateway 配置中（如 `channels.mchat`），与 WhatsApp、Telegram 等并列；未在任一插件 manifest 中声明的 channel id 会导致配置校验失败。

### 2.3 消息与会话模型（概念）

- Gateway 内部有 **会话（session）**、**消息** 等抽象；不同渠道的「会话」映射为统一模型（通常包含 channel、thread/conversation id、参与者等）。
- **chat** 事件：由各渠道在收到平台消息时向 Gateway 核心上报，用于驱动 Agent 与路由。
- **send** 请求：由 CLI/Web/Agent 发起，Gateway 根据目标 channel/thread 路由到对应渠道的发送实现。

---

## 三、MChat 侧能力摘要（与适配相关）

### 3.1 连接与身份

- 使用 **MQTT** 连接 Broker；连接参数：broker host/port、useTls、username、password；身份为「员工」**employee_id**。
- 连接后可调用 **auth.bind**（payload 含 `employee_id`），在服务端建立 client_id ↔ employee_id 映射，后续请求均基于该映射鉴权。

### 3.2 收消息（订阅）

| 来源     | MQTT Topic                  | 说明 |
|----------|-----------------------------|------|
| 单聊/系统 | `mchat/inbox/{employee_id}` | 当前员工的收件箱 |
| 群聊     | `mchat/group/{group_id}`    | 需先通过 org.tree 或 group 相关接口获知已加入的群，再逐群订阅 |

Payload 为 JSON，含 `msg_id`、`from_employee_id`、`content`、`sent_at`、`quote_msg_id` 等（详见《消息交互接口与示例》）。

### 3.3 发消息（请求-响应）

- **单聊**：action **msg.send_private**，params：`to_employee_id`、`content`（可 string 或 `{type, body}`）、可选 `quote_msg_id`。
- **群聊**：action **msg.send_group**，params：`group_id`、`content`、可选 `quote_msg_id`。
- 请求发布到 `mchat/msg/req/{client_id}/{seq_id}`，响应在 `mchat/msg/resp/{client_id}/{seq_id}`；客户端需先订阅 `mchat/msg/resp/{client_id}/+`。

### 3.4 群列表与组织

- **org.tree**：返回部门与员工列表；群列表目前可从业务侧或后续 **group.list** 等接口获取，用于决定订阅哪些 `mchat/group/{group_id}`。

---

## 四、适配方案：OpenClaw MChat 渠道插件

### 4.1 方案选择

| 方案 | 说明 | 可行性 |
|------|------|--------|
| **A. OpenClaw 渠道插件** | 开发符合 OpenClaw 插件与渠道规范的「MChat」渠道，由 Gateway 加载，与 WhatsApp/Telegram 等同等对待。 | **推荐**。需基于 OpenClaw 源码确认渠道 Provider 接口与注册方式。 |
| **B. 独立桥接进程 + Gateway 注入** | 独立进程用 MChat SDK 连 MQTT，再通过某种方式向 Gateway 注入 chat 事件。 | Gateway 的 chat 事件来自内部渠道实现，无公开「注入外部消息」API，不可行。 |
| **C. 独立桥接进程模拟 WebChat** | 桥接进程连接 Gateway WebSocket 作为 operator，再以「模拟用户」方式发消息。 | 无法以渠道身份接收并上报 chat 事件，无法完整扮演「一个 IM 渠道」，不推荐。 |

**结论**：采用 **方案 A**，在 OpenClaw 侧实现 **MChat Channel Plugin**。

### 4.2 插件形态与仓库建议

- **形态**：独立 npm 包（如 `@atorber/openclaw-channel-mchat` 或 `openclaw-channel-mchat`），实现 OpenClaw 的 Channel Provider 接口；包内包含 **openclaw.plugin.json** 及实现代码。
- **仓库**：可放在 MChat 仓库内（如 `integrations/openclaw-channel/`）或单独仓库；通过 npm 发布，用户通过 `openclaw plugins add` 或 OpenClaw 文档中推荐的插件安装方式安装。

### 4.3 插件清单（openclaw.plugin.json）

```json
{
  "id": "mchat",
  "name": "MChat",
  "description": "MChat 企业 IM 渠道，基于 MQTT，支持单聊与群聊",
  "version": "0.1.0",
  "channels": ["mchat"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "brokerHost": { "type": "string", "description": "MQTT Broker 主机" },
      "brokerPort": { "type": "number", "description": "Broker 端口" },
      "useTls": { "type": "boolean", "default": false },
      "username": { "type": "string", "description": "MQTT 用户名（如 employee_id）" },
      "password": { "type": "string", "description": "MQTT 密码" },
      "employeeId": { "type": "string", "description": "员工 ID，与 auth.bind 一致" },
      "clientId": { "type": "string", "description": "可选，MQTT client_id" },
      "requestTimeoutMs": { "type": "number", "default": 30000 }
    },
    "required": ["brokerHost", "brokerPort", "username", "password", "employeeId"]
  }
}
```

（若 OpenClaw 对敏感字段有 `sensitive` 或 `uiHints` 约定，可增加对应标注。）

### 4.4 会话与消息映射

| OpenClaw 概念 | MChat 对应 | 说明 |
|---------------|------------|------|
| channel id | `mchat` | 固定为插件声明的渠道 ID。 |
| thread / conversation（单聊） | 对方 **employee_id** | 收件箱中 `from_employee_id` 标识发送方；发送时 `to_employee_id` 即 thread。 |
| thread / conversation（群聊） | **group_id** | 订阅 `mchat/group/{group_id}`；发送时 `group_id` 即 thread。 |
| 消息 id | **msg_id** | MChat 下发的 msg_id 可映射为 OpenClaw 消息 id，便于引用/回复。 |
| 引用回复 | **quote_msg_id** | MChat 的 quote_msg_id 与 OpenClaw 的 reply-to 互转。 |

- **收件箱消息** → 转为 OpenClaw **chat** 事件：channel=mchat，thread=from_employee_id（单聊）或需根据业务区分「单聊 vs 系统通知」；若 MChat 有 type 字段可据此区分。
- **群消息** → channel=mchat，thread=group_id，发送方 from_employee_id 放入 payload。
- **send 请求** → 若 thread 形如 `emp_*` 视为单聊（to_employee_id=thread），否则视为 group_id，调用 msg.send_private 或 msg.send_group。

（具体字段名以 OpenClaw 协议 schema 为准，此处为逻辑映射。）

### 4.5 运行时行为

1. **启动**：Gateway 加载 MChat 插件，读取 `channels.mchat` 配置，创建 MChat 渠道 Provider 实例。
2. **连接**：Provider 使用 **mchat-client**（Node SDK）或等价 MQTT 逻辑连接 Broker，使用配置中的 broker、username、password、employeeId；执行 auth.bind；订阅 `mchat/msg/resp/{client_id}/+`、`mchat/inbox/{employee_id}`；可选调用 org.tree 获取已加入群列表并订阅 `mchat/group/{group_id}`。
3. **收消息**：inbox/group 收到 MQTT 消息后，解析 JSON，映射为 OpenClaw 的 chat 事件格式，上报 Gateway（具体 API 以 OpenClaw 源码中渠道上报方式为准）。
4. **发消息**：Gateway 下发 send 请求到 MChat 渠道时，Provider 根据 thread 判断单聊/群聊，调用 `msg.send_private` 或 `msg.send_group`，content 与 OpenClaw 文本/附件格式做适当转换（优先支持 text，image/file 若 OpenClaw 有 URL 可直接用 MChat 的 type+body）。
5. **健康与重连**：Provider 需向 Gateway 报告连接状态；MQTT 断线时按 mchat-client 重连策略重连，重连后重新订阅与 auth.bind。

### 4.6 技术栈与依赖

- **语言/运行时**：Node.js ≥ 18（与 OpenClaw Gateway 一致）。
- **依赖**：**mchat-client**（npm 包，MChat 官方 Node SDK）；若插件与 OpenClaw 同进程加载，需兼容 OpenClaw 的 TypeScript/构建环境。
- **OpenClaw 依赖**：仅依赖 OpenClaw 的「渠道接口」与「插件加载机制」，不修改 OpenClaw 核心；需阅读 OpenClaw 源码中现有渠道（如 Mattermost、Matrix）的实现与注册方式，照同等方式实现并注册 MChat。

---

## 五、实现步骤建议

### 5.1 阶段一：调研与接口对齐

1. **阅读 OpenClaw 源码**：定位 Channel Provider 接口定义、插件加载与渠道注册代码（如 `src/gateway/`、`src/plugins/`、Mattermost/Matrix 等渠道实现）。
2. **确认事件与请求格式**：chat 事件的确切 payload 结构、send 请求的 params（channel、thread、content、options）；确认是否有「会话列表」、「已读」等扩展点。
3. **确认 MChat 能力**：群列表获取方式（org.tree 中是否含群、或需 group.list）；收件箱中单聊与系统通知的区分方式；content 的 type/text/image/file 与 OpenClaw 的互转规则。

### 5.2 阶段二：插件骨架与配置

1. 新建 npm 包（如 `integrations/openclaw-channel`），加入 **openclaw.plugin.json**（id、channels、configSchema）。
2. 在 OpenClaw 配置中增加 `channels.mchat` 示例，确认插件可被发现与校验通过（不执行逻辑也可）。
3. 实现「空」的 Provider：仅建立 MQTT 连接与 auth.bind，不订阅群、不转发消息，验证在 OpenClaw 中可加载、可配置。

### 5.3 阶段三：收消息与 chat 事件

1. 订阅 inbox 与（可选）若干测试群；收到 MQTT 消息后解析 payload。
2. 将 inbox/group 消息映射为 OpenClaw chat 事件格式并调用 Gateway 内部上报 API（以源码为准）。
3. 在 OpenClaw 端到端验证：MChat 发一条单聊/群聊，OpenClaw 能收到并展示或触发 Agent。

### 5.4 阶段四：发消息与 send 路由

1. 实现 Gateway 对 MChat 渠道的 **send** 处理：根据 thread 判断单聊/群聊，调用 msg.send_private 或 msg.send_group。
2. content 转换：文本直接传；若 OpenClaw 支持 URL 型附件，映射为 MChat 的 image/file content。
3. 可选：quote_msg_id 与 OpenClaw 的 reply-to 互转。

### 5.5 阶段五：群列表与订阅策略

1. 若 MChat 提供 group.list 或可从 org 数据得到已加入群，在连接后拉取并自动订阅 `mchat/group/{group_id}`。
2. 若暂无群列表接口，可先支持「配置中显式列出 group_id」的订阅方式，供内测使用。

### 5.6 阶段六：文档与发布

1. 在 MChat 文档（如《SDK 使用说明》或独立「集成」页）中增加「OpenClaw 集成」：安装方式、配置示例、channel/thread 与 MChat 的对应关系。
2. 在 OpenClaw 侧（若可提交 PR）或自有文档中说明 MChat 渠道的配置与限制。
3. 将插件发布到 npm，版本与 MChat 协议兼容性在 README 中说明。

---

## 六、配置示例（目标形态）

用户在使用 OpenClaw 时，在 Gateway 配置（如 `openclaw.json` 或通过 `openclaw configure`）中增加 MChat 渠道，例如：

```json
{
  "channels": {
    "mchat": {
      "enabled": true,
      "brokerHost": "your-broker.example.com",
      "brokerPort": 1883,
      "useTls": false,
      "username": "emp_openclaw_bot",
      "password": "***",
      "employeeId": "emp_openclaw_bot"
    }
  }
}
```

配置中的 employee 需已在 MChat 管理后台创建并下发 MQTT 凭证；若需接收群消息，该员工需已加入对应群，且插件侧实现群列表拉取与订阅。

---

## 七、风险与依赖

| 项 | 说明 |
|----|------|
| OpenClaw 渠道 API 未公开 | 需阅读源码确认 Provider 接口与注册方式；若仅内部使用或未稳定，存在升级断裂风险，需在文档中注明适配的 OpenClaw 版本。 |
| 群列表接口 | MChat 若暂无 group.list，需在服务端扩展或通过 org/其他接口间接获取，或先支持配置化群列表。 |
| 多实例 Gateway | 若 OpenClaw 多实例部署，每个实例若都配置同一 MChat 员工，会多端在线；MChat 侧可按「多设备」语义支持，或建议单实例使用 MChat 渠道。 |
| 媒体与富文本 | 首版可仅支持文本与 URL 型图片/文件；复杂富文本、语音等可与 OpenClaw 能力对齐后迭代。 |

---

## 八、参考

- OpenClaw 文档：[Gateway Architecture](https://docs.clawd.bot/concepts/architecture)、[Chat Channels](https://docs.clawd.bot/channels)、[Gateway Protocol](https://docs.clawd.bot/gateway/protocol)、[Plugin Manifest](https://docs.clawd.bot/plugins/manifest)、[Bridge Protocol](https://docs.clawd.bot/gateway/bridge-protocol)（legacy，非渠道用）。
- MChat：《消息交互接口与示例》、《技术设计方案》、《SDK 使用说明》；仓库 client/node（mchat-client）、client/python。
