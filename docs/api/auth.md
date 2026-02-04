# 认证与会话

## auth.bind（会话绑定，可选）

- **请求 Topic**：`mchat/msg/req/{client_id}/{seq_id}`
- **请求 Payload**：

```json
{
  "action": "auth.bind",
  "seq_id": "bb0e8400-e29b-41d4-a716-446655440006",
  "employee_id": "emp_zhangsan_001"
}
```

- **响应 Topic**：`mchat/msg/resp/{client_id}/{seq_id}`
- **响应 Payload（成功）**：

```json
{
  "seq_id": "bb0e8400-e29b-41d4-a716-446655440006",
  "code": 0,
  "message": "ok",
  "data": {}
}
```

---

## auth.challenge（敏感操作二次验证）

- **请求 Topic**：`mchat/msg/req/{client_id}/{seq_id}`
- **请求 Payload**：

```json
{
  "action": "auth.challenge",
  "seq_id": "cc0e8400-e29b-41d4-a716-446655440007"
}
```

- **响应 Payload（成功）**：

```json
{
  "seq_id": "cc0e8400-e29b-41d4-a716-446655440007",
  "code": 0,
  "message": "ok",
  "data": {
    "challenge_id": "ch_abc123",
    "token": "one_time_token_xxx",
    "expires_at": "2025-02-03T10:15:00.000Z"
  }
}
```

后续敏感 action（如 group.dismiss）在 payload 中携带 `challenge_id` 与 `token`。
