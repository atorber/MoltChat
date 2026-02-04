# MChat Python 客户端

Python 版 MChat 客户端 SDK，与《技术设计方案》及《消息交互接口与示例》一致。封装 MQTT 连接、请求-响应、收件箱/群消息订阅与事件。

## 要求

- Python >= 3.10
- 依赖：paho-mqtt >= 2.0.0

## 安装

```bash
cd client/python
pip install -e .
# 或从项目外：pip install -e /path/to/MChat/client/python
```

## 连接参数

与 `employee.create` 返回的 `mqtt_connection` 对应，构造 `MChatClient` 时传入：

- `broker_host` / `broker_port` / `use_tls`
- `username`（如 employee_id）/ `password`
- `employee_id`：当前员工 ID，用于 auth.bind、收件箱订阅、在线状态
- 可选：`client_id`、`device_id`、`request_timeout_ms`、`skip_auth_bind`

## 使用示例

```python
from mchat_client import (
    MChatClient,
    send_private_message,
    get_org_tree,
    get_storage_config,
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

client.on("inbox", lambda payload: print("收件箱:", payload))
client.on("group", lambda group_id, payload: print("群消息", group_id, payload))

# 发单聊
send_private_message(client, "emp_lisi_002", "你好")

# 获取组织树
tree = get_org_tree(client)
print(tree.get("data", {}).get("employees"))

# 订阅某群（需已知 group_id）
client.subscribe_group("grp_xxx")

client.disconnect()
```

## API 概览

- **MChatClient**
  - `connect()` / `disconnect()`
  - `request(action, params)`：通用请求，成功返回完整响应体（含 code、message、data），失败抛异常
  - `subscribe_group(group_id)` / `unsubscribe_group(group_id)`
  - `on("inbox" | "group" | "connect" | "offline" | "error", callback)`
- **便捷方法**（见 `api.py`）：`send_private_message`、`send_group_message`、`get_org_tree`、`get_storage_config`、`get_agent_capability_list`

## 示例

同目录下 **example/** 为可运行示例（连接、拉取组织架构与 Agent、收件箱/群消息、可选发测试消息）。详见 [example/README.md](example/README.md)。

## 发布到 PyPI

在 `client/python` 目录下构建并上传（需先安装 `build`、`twine`）：

```bash
cd client/python
pip install build twine
python -m build
twine upload dist/*
```

发布前请将 `pyproject.toml` 中的 `version` 更新为待发布版本号。
