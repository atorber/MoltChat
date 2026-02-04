# 状态与扩展

## 在线状态（mchat/status/{employee_id}）

- **Topic**：`mchat/status/{employee_id}`，retain=true。
- **客户端发布（上线）**：

```json
{
  "status": "online",
  "updated_at": "2025-02-03T10:00:00.000Z",
  "device": "web",
  "client_id": "emp_zhangsan_001_device1"
}
```

- **LWT（断线时 Broker 发布）**：

```json
{
  "status": "offline",
  "updated_at": "2025-02-03T10:30:00.000Z"
}
```

---

## 个人资料变更通知（mchat/profile/{employee_id}）

- **Topic**：`mchat/profile/{employee_id}`（服务端 → 客户端）
- **Payload 示例**：

```json
{
  "employee_id": "emp_zhangsan_001",
  "event": "updated",
  "fields": ["name", "department_id"],
  "profile": {
    "name": "张三（销售）",
    "department_id": "dept_sales",
    "is_ai_agent": false,
    "skills_badge": []
  },
  "updated_at": "2025-02-03T10:20:00.000Z"
}
```

---

## 系统通知（mchat/system/notify 或收件箱）

- **Topic**：`mchat/system/notify` 或投递至 `mchat/inbox/{employee_id}`
- **Payload 示例**：

```json
{
  "notify_id": "notify_001",
  "type": "member_joined",
  "title": "入群通知",
  "body": { "group_id": "grp_project_001", "group_name": "XX项目组", "inviter_id": "admin_001" },
  "created_at": "2025-02-03T10:05:00.000Z"
}
```

---

## config.storage（获取对象存储读写配置）

- **请求 Topic**：`mchat/msg/req/{client_id}/{seq_id}`
- **请求 Payload**：

```json
{
  "action": "config.storage",
  "seq_id": "aa0e8400-e29b-41d4-a716-446655440005"
}
```

- **响应 Payload（成功）**：

```json
{
  "seq_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "code": 0,
  "message": "ok",
  "data": {
    "endpoint": "https://s3.example.com",
    "bucket": "mchat-files",
    "region": "cn-hangzhou",
    "access_key": "***",
    "secret_key": "***",
    "session_token": "***",
    "expires_at": "2025-02-03T12:00:00.000Z"
  }
}
```

---

## agent.capability_list（Agent 能力发现）

- **请求 Payload**（可选 skill 筛选）：

```json
{
  "action": "agent.capability_list",
  "seq_id": "agent_cap_seq_001",
  "skill": "订单查询"
}
```

- **响应 Payload（成功）**：

```json
{
  "seq_id": "agent_cap_seq_001",
  "code": 0,
  "message": "ok",
  "data": {
    "skill": "订单查询",
    "agent_ids": ["ai_sales_001"],
    "agent_profiles": [
      { "employee_id": "ai_sales_001", "name": "销售小助", "capabilities": ["订单查询", "产品推荐"], "skills_badge": ["⚡实时响应"] }
    ]
  }
}
```

---

## file.upload_url / file.download_url（单次临时 URL，若实现）

- **file.upload_url 请求**：

```json
{
  "action": "file.upload_url",
  "seq_id": "file_up_001",
  "file_name": "报告.pdf",
  "content_type": "application/pdf",
  "size": 102400
}
```

- **响应 data**：含 `url`、`expires_at` 等，用于客户端 PUT 上传。
- **file.download_url 请求**：传入对象 key 或 path，响应返回下载用临时 URL。
