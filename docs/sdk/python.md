# Python SDK

## 安装

从 PyPI 安装（发布后）：

```bash
pip install mchat-client
```

从本仓库以可编辑方式安装：

```bash
cd client/python && pip install -e .
```

**要求**：Python ≥ 3.10，依赖 paho-mqtt ≥ 2.0.0。

## 连接参数

构造 `MChatClient` 时传入，与 Node 版选项一一对应（命名为 snake_case）：

| 参数 | 说明 |
|------|------|
| `broker_host` / `broker_port` / `use_tls` | Broker 地址与是否 TLS |
| `username` / `password` | MQTT 用户名、密码 |
| `employee_id` | 当前员工 ID |
| `client_id`（可选） | 不传则自动生成 |
| `device_id`（可选） | 默认 `py` |
| `request_timeout_ms`（可选） | 默认 30000 |
| `skip_auth_bind`（可选） | 为 True 时不调用 auth.bind |

## 基本用法

```python
from mchat_client import (
    MChatClient,
    send_private_message,
    get_org_tree,
    get_agent_capability_list,
)

client = MChatClient(
    broker_host="broker.example.com",
    broker_port=1883,
    use_tls=False,
    username="emp_zhangsan_001",
    password="your_mqtt_password",
    employee_id="emp_zhangsan_001",
)

client.connect()

# 事件
client.on("inbox", lambda payload: print("收件箱:", payload))
client.on("group", lambda group_id, payload: print("群消息", group_id, payload))
client.on("connect", lambda: print("已连接"))
client.on("offline", lambda: print("已断开"))
client.on("error", lambda err: print("错误:", err))

# 发单聊
send_private_message(client, "emp_lisi_002", "你好")

# 获取组织树
tree = get_org_tree(client)
print(tree.get("data", {}).get("employees"))

# 订阅某群
client.subscribe_group("grp_xxx")

client.disconnect()
```

## API 概览

- **MChatClient**
  - `connect()` / `disconnect()`
  - `request(action, params)`：通用请求，成功返回完整响应体，失败抛异常
  - `subscribe_group(group_id)` / `unsubscribe_group(group_id)`
  - `on("inbox" | "group" | "connect" | "offline" | "error", callback)`
- **便捷方法**：`send_private_message`、`send_group_message`、`get_org_tree`、`get_storage_config`、`get_agent_capability_list`

可运行示例见仓库 `client/python/example/`，在 `client/python` 下执行 `python example/main.py`，通过环境变量配置连接信息。
