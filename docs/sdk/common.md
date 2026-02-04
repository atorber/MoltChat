# 通用说明

## 连接与身份

- 连接成功后 SDK 会**先订阅** `mchat/msg/resp/{client_id}/+` 再发请求，避免丢响应。
- 默认会调用 **auth.bind**（payload 含 `employee_id`），在服务端建立 client_id 与 employee_id 的映射；若 Broker 已按身份认证且服务端能解析，可设置 `skipAuthBind` / `skip_auth_bind` 为 true 跳过。
- 会发布**在线状态**到 `mchat/status/{employee_id}`（online），并设置 LWT 为 offline。

## 收件箱与群消息

- **收件箱**（单聊、系统通知等）：连接后自动订阅 `mchat/inbox/{employee_id}`，通过 `on('inbox', ...)` 接收。
- **群消息**：需先获得已加入的群列表（如通过 `getOrgTree` / `get_org_tree` 或后续 `group.list`），再对每个 `group_id` 调用 `subscribeGroup` / `subscribe_group`；通过 `on('group', ...)` 接收。

## 请求与超时

- 单次请求默认超时 30 秒，可在连接选项中修改。
- 响应中 `code !== 0` 时，Node 版会 reject Promise，Python 版会抛出异常；错误码含义见 [消息交互接口 - 通用约定](../api/convention.md)。

## 环境变量示例（运行 example）

| 变量 | 说明 |
|------|------|
| `MCHAT_BROKER_HOST` | Broker 主机 |
| `MCHAT_BROKER_PORT` | 端口（如 1883） |
| `MCHAT_USERNAME` | MQTT 用户名 |
| `MCHAT_PASSWORD` | MQTT 密码 |
| `MCHAT_EMPLOYEE_ID` | 员工 ID（不设则用 USERNAME） |
| `MCHAT_USE_TLS` | 为 `1` 时使用 TLS |
| `MCHAT_SEND_TO` | 可选，连接后向该 employee_id 发一条测试消息 |
