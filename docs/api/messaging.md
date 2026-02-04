# 消息类接口

请求 **Topic**：`mchat/msg/req/{client_id}/{seq_id}`，**响应 Topic**：`mchat/msg/resp/{client_id}/{seq_id}`。

---

## msg.send_private（发送单聊消息）

- **请求 Payload**：

```json
{
  "action": "msg.send_private",
  "seq_id": "770e8400-e29b-41d4-a716-446655440002",
  "to_employee_id": "emp_lisi_002",
  "content": "你好，下午会议改到 3 点。"
}
```

- **响应 Payload（成功）**：

```json
{
  "seq_id": "770e8400-e29b-41d4-a716-446655440002",
  "code": 0,
  "message": "ok",
  "data": {
    "msg_id": "msg_abc123",
    "to_employee_id": "emp_lisi_002",
    "sent_at": "2025-02-03T10:10:00.000Z"
  }
}
```

- **收件箱投递**（对方订阅 `mchat/inbox/{employee_id}` 收到）：
  - **Topic**：`mchat/inbox/emp_lisi_002`
  - **Payload**：

```json
{
  "msg_id": "msg_abc123",
  "type": "private",
  "from_employee_id": "emp_zhangsan_001",
  "content": "你好，下午会议改到 3 点。",
  "sent_at": "2025-02-03T10:10:00.000Z"
}
```

---

## msg.send_group（发送群聊消息）

- **请求 Payload**：

```json
{
  "action": "msg.send_group",
  "seq_id": "880e8400-e29b-41d4-a716-446655440003",
  "group_id": "grp_project_001",
  "content": "大家记得更新进度到文档。"
}
```

- **响应 Payload（成功）**：`data` 含 `msg_id`、`group_id`、`sent_at`。

- **群主题投递**（成员订阅 `mchat/group/{group_id}` 收到）：
  - **Topic**：`mchat/group/grp_project_001`
  - **Payload**：

```json
{
  "msg_id": "msg_grp_xyz789",
  "group_id": "grp_project_001",
  "from_employee_id": "emp_zhangsan_001",
  "content": "大家记得更新进度到文档。",
  "sent_at": "2025-02-03T10:12:00.000Z"
}
```

---

## msg.read_ack（已读回执）

- **请求 Payload**：

```json
{
  "action": "msg.read_ack",
  "seq_id": "read_ack_seq_001",
  "msg_id": "msg_abc123",
  "conversation_type": "private",
  "peer_employee_id": "emp_zhangsan_001"
}
```

群聊时使用 `conversation_type`: `"group"` 与 `group_id`。响应为通用结构（code、message、data）。
