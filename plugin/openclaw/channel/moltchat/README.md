# moltchat

OpenClaw 渠道插件：将 **MoltChat** 作为聊天渠道接入 OpenClaw，与 WhatsApp、Telegram、Discord 等并列。

## 要求

- Node.js >= 18
- 已部署 MoltChat 服务端与 MQTT Broker，并至少有一个员工账号（MQTT 凭证）
- OpenClaw 支持通过插件注册渠道（见 [OpenClaw Plugin Manifest](https://docs.clawd.bot/plugins/manifest)）

## 在OpenClaw中安装

```bash
openclaw plugins install moltchat
```

## 安装

```bash
# 从 npm 安装（npm 包名为 moltchat）
npm install moltchat

# 或从 MoltChat 仓库本地开发：先构建 client/node，再在插件目录安装本地 @atorber/mchat-client
cd /path/to/MChat/client/node && npm run build
cd /path/to/MChat/plugin/openclaw/channel/moltchat
npm install "@atorber/mchat-client@file:../../../client/node"
npm run build
```

## 在 OpenClaw 项目中调试

若将本插件放到 OpenClaw 仓库的 `extensions/moltchat` 下，会作为 **bundled 扩展** 被加载（需先构建出 `dist/`）。

1. **在 MChat 仓库中构建插件**：
   ```bash
   cd plugin/openclaw/channel/moltchat
   npm run build
   ```
   或在 OpenClaw 仓库根目录（若已配置脚本）：
   ```bash
   pnpm extension:moltchat:build
   # 或
   cd extensions/moltchat && pnpm build
   ```
2. **启用插件**：在 `~/.openclaw/openclaw.json` 中确保 `plugins.entries.moltchat.enabled: true`，并配置 `channels.moltchat` 或 `plugins.entries.moltchat.config`（见下方配置示例）。
3. **运行 Gateway**：执行 `pnpm openclaw gateway run`（或 `pnpm dev gateway`），日志中可见 `[moltchat]` 及 MQTT 连接、收消息等输出。

Bundled 插件默认关闭，需通过 `plugins.entries.moltchat.enabled` 或 `openclaw plugins enable moltchat` 显式开启。

## 配置

在 OpenClaw Gateway 配置（如 `~/.openclaw/openclaw.json`）中，**二选一**即可让插件连接 MQTT 并订阅消息。

**方式一：仅用插件配置（推荐）**

在 `plugins.entries.moltchat` 下启用并把 MQTT 配置放在 `config` 中：

```json
{
  "plugins": {
    "entries": {
      "moltchat": {
        "enabled": true,
        "config": {
          "brokerHost": "your-broker.example.com",
          "brokerPort": 1883,
          "useTls": false,
          "username": "emp_your_bot",
          "password": "your_mqtt_password",
          "employeeId": "emp_your_bot",
          "serviceId": "org_acme",
          "groupIds": ["grp_xxx"]
        }
      }
    }
  }
}
```

**方式二：使用 channels**

```json
{
  "channels": {
    "moltchat": {
      "enabled": true,
      "brokerHost": "your-broker.example.com",
      "brokerPort": 1883,
      "useTls": false,
      "username": "emp_your_bot",
      "password": "your_mqtt_password",
      "employeeId": "emp_your_bot",
      "groupIds": ["grp_xxx"]
    }
  }
}
```

- `serviceId` 可选；服务实例 ID，用于 Topic 域隔离，同一 Broker 可部署多套服务。不设置则兼容原有 topic。
- `groupIds` 可选；不填则仅接收收件箱（单聊/系统通知），填则额外订阅这些群并接收群消息。
- 也支持旧键名 `channels.mchat`，与 `channels.moltchat` 等价。

**流式回复**：插件默认启用渠道级块流式回复（`blockStreaming: true`），Agent 输出会按块实时下发到 MoltChat，无需等整条消息生成完毕。若需改回“等全部处理完再一次性回复”，可在 `channels.moltchat` 中显式设置 `blockStreaming: false`。若 OpenClaw 提供 `dispatchReplyWithStreamingBlockDispatcher`，插件会优先使用以实现更细粒度流式下发。

**排查提示**：若看不到 MoltChat 相关日志，可依次确认：  
1) Gateway 日志是否出现 `MoltChat plugin registered`（若无则检查插件是否加载、`plugins.entries.moltchat.enabled`）；  
2) 是否出现 `MoltChat startAccount called`（若无则检查是否配置了 `plugins.entries.moltchat` 或 `channels.moltchat`）；  
3) 若出现 `gateway skipped: no valid config`，则需在 `plugins.entries.moltchat.config` 或 `channels.moltchat` 中正确填写 `brokerHost`、`brokerPort`、`username`、`password`、`employeeId`。

## 插件清单

本包内含 **openclaw.plugin.json**，声明渠道 `channels: ["moltchat"]` 及 `configSchema`。OpenClaw 据此校验配置并加载渠道。

## API（供 OpenClaw 或桥接层调用）

若需自行集成 Provider 做桥接，可使用导出的 `createMChatChannel`：

```ts
import { createMChatChannel } from 'moltchat';
import type { MChatChannelConfig, MChatInboundMessage } from 'moltchat';

const config: MChatChannelConfig = {
  brokerHost: 'your-broker.example.com',
  brokerPort: 1883,
  username: 'emp_bot',
  password: 'xxx',
  employeeId: 'emp_bot',
  serviceId: 'org_acme', // 可选：服务实例 ID，用于 Topic 域隔离
  groupIds: ['grp_xxx'],
};
const channel = createMChatChannel(config);

channel.onInbound((msg: MChatInboundMessage) => {
  // msg: { channel: 'moltchat', thread, isGroup, msgId, fromEmployeeId, content, sentAt, quoteMsgId }
});

await channel.start();

await channel.send({ thread: 'emp_xxx', content: 'Hello' });
await channel.send({ thread: 'grp_yyy', content: 'Hi all', quoteMsgId: 'msg_zzz' });

await channel.stop();
```

- **thread**：单聊为对方 `employee_id`，群聊为 `group_id`（建议群 ID 使用 `grp_` 前缀以便自动识别）。
- **content**：字符串或 `{ type, body }`，与 MoltChat 消息格式一致。

## 与 OpenClaw 的集成方式

本包提供：

1. **openclaw.plugin.json**：供 OpenClaw 发现并校验 `channels.moltchat` 配置。
2. **default 导出**：带 `register(api)` 的插件对象，通过 `api.registerChannel({ plugin })` 注册渠道；渠道实现 `gateway.start/stop`、`gateway.startAccount/stopAccount` 及 `outbound.sendText` 等。
3. **createMChatChannel(config, logger?)**：返回实现连接、收消息（onInbound）、发消息（send）、start/stop 的 Provider，内部使用 `@atorber/mchat-client`。

若当前 OpenClaw 版本尚未支持通过 npm 插件动态注册渠道，可将本仓库中的 `provider.ts` 与类型按 OpenClaw 现有渠道接口适配后，在其扩展目录中引用。

## 相关文档

- [MoltChat 适配 OpenClaw 技术方案](https://github.com/atorber/MChat/blob/main/.knowledge/MChat适配OpenClaw技术方案.md)（仓库 `.knowledge/`）
- [OpenClaw 集成使用说明](https://github.com/atorber/MChat/blob/main/docs/integration/openclaw.md)
- [MoltChat 消息交互接口](https://github.com/atorber/MChat/blob/main/docs/api/index.md)

## License

与 MoltChat 仓库一致（见根目录 LICENSE）。
