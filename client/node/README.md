# MChat Node 客户端

Node.js / TypeScript 版 MChat 客户端 SDK，与《技术设计方案》及《消息交互接口与示例》一致。封装 MQTT 连接、请求-响应、收件箱/群消息订阅与事件。

## 技术方案

详见 [docs/技术方案.md](docs/技术方案.md)。

## 安装

**从 npm 安装**（发布后）：

```bash
npm install @atorber/mchat-client
```

**从本仓库引用**：

```bash
cd client/node && npm install && npm run build
```

## 连接选项

与 `employee.create` 返回的 `mqtt_connection` 对应：

- `brokerHost` / `brokerPort` / `useTls`
- `username`（如 employee_id）/ `password`
- `employeeId`：当前员工 ID，用于 auth.bind、收件箱订阅、在线状态
- 可选 `clientId`、`deviceId`、`requestTimeoutMs`、`skipAuthBind`

## 使用示例

```ts
import { MChatClient, sendPrivateMessage, getOrgTree } from 'mchat-client';
// 或从本仓库：import { MChatClient, ... } from './client/node/dist';

const client = new MChatClient({
  brokerHost: 'broker.example.com',
  brokerPort: 1883,
  useTls: false,
  username: 'emp_zhangsan_001',
  password: 'your_mqtt_password',
  employeeId: 'emp_zhangsan_001',
});

await client.connect();

client.on('inbox', (payload) => {
  console.log('收件箱:', payload);
});
client.on('group', (groupId, payload) => {
  console.log('群消息', groupId, payload);
});

// 发单聊
await sendPrivateMessage(client, 'emp_lisi_002', '你好');

// 获取组织树
const tree = await getOrgTree(client);
console.log(tree.data?.employees);

// 订阅某群（需已知 group_id，如从 org 或业务侧获取）
await client.subscribeGroup('grp_xxx');

await client.disconnect();
```

## API 概览

- **MChatClient**
  - `connect()` / `disconnect()`
  - `request(action, params)`：通用请求
  - `subscribeGroup(groupId)` / `unsubscribeGroup(groupId)`
  - `on('inbox' | 'group' | 'connect' | 'offline' | 'error', fn)`
- **便捷方法**（见 `api.ts`）：`sendPrivateMessage`、`sendGroupMessage`、`getOrgTree`、`getStorageConfig`、`getAgentCapabilityList`

## 示例

同目录下 **example/** 为可运行示例（连接、拉取组织架构与 Agent、收件箱/群消息、可选发测试消息）。进入 `example` 后执行 `npm install` 与 `npm start`，详见 [example/README.md](example/README.md)。

## 构建与发布

```bash
npm run build
```

产物在 `dist/`，main 与 types 已在 package.json 中配置。

**发布到 npm**：在 `client/node` 目录下执行 `npm publish`（会先执行 `prepublishOnly` 构建）。若使用 scope，例如 `@your-org/mchat-client`，需将 package.json 的 `name` 改为 scope 名并执行 `npm publish --access public`。
