# Node.js / TypeScript SDK

## 安装

从 npm 安装（发布后）：

```bash
npm install mchat-client
```

从本仓库引用：

```bash
cd client/node && npm install && npm run build
```

## 连接选项

与 `employee.create` 返回的 `mqtt_connection` 对应：

| 选项 | 说明 |
|------|------|
| `brokerHost` / `brokerPort` / `useTls` | Broker 地址与是否 TLS |
| `username` / `password` | MQTT 用户名（如 employee_id）、密码 |
| `employeeId` | 当前员工 ID，用于 auth.bind、收件箱订阅、在线状态 |
| `clientId`（可选） | 不传则自动生成，格式 `{employeeId}_{deviceId}_{uuid}` |
| `deviceId`（可选） | 设备标识，默认 `node` |
| `requestTimeoutMs`（可选） | 请求超时毫秒，默认 30000 |
| `skipAuthBind`（可选） | 为 true 时连接后不调用 auth.bind |

## 基本用法

```ts
import { MChatClient, sendPrivateMessage, getOrgTree } from 'mchat-client';

const client = new MChatClient({
  brokerHost: 'broker.example.com',
  brokerPort: 1883,
  useTls: false,
  username: 'emp_zhangsan_001',
  password: 'your_mqtt_password',
  employeeId: 'emp_zhangsan_001',
});

await client.connect();

// 事件
client.on('inbox', (payload) => console.log('收件箱:', payload));
client.on('group', (groupId, payload) => console.log('群消息', groupId, payload));
client.on('connect', () => console.log('已连接'));
client.on('offline', () => console.log('已断开'));
client.on('error', (err) => console.error('错误:', err));

// 发单聊
await sendPrivateMessage(client, 'emp_lisi_002', '你好');

// 获取组织树
const tree = await getOrgTree(client);
console.log(tree.data?.employees);

// 订阅某群（需已知 group_id）
await client.subscribeGroup('grp_xxx');

await client.disconnect();
```

## API 概览

- **MChatClient**
  - `connect()` / `disconnect()`
  - `request(action, params)`：通用请求
  - `subscribeGroup(groupId)` / `unsubscribeGroup(groupId)`
  - `on('inbox' | 'group' | 'connect' | 'offline' | 'error', fn)`
- **便捷方法**：`sendPrivateMessage`、`sendGroupMessage`、`getOrgTree`、`getStorageConfig`、`getAgentCapabilityList`

可运行示例见仓库 `client/node/example/`，执行 `npm install` 与 `npm start`，通过环境变量配置连接信息。
