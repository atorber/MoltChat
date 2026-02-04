# 管理类接口

以下请求均为 **Topic**：`mchat/msg/req/{client_id}/{seq_id}`，**响应 Topic**：`mchat/msg/resp/{client_id}/{seq_id}`。示例中写出 `seq_id` 仅为示意，实现可以 Topic 为准。

---

## employee.create（员工创建/注册）

- **请求 Payload**：

```json
{
  "action": "employee.create",
  "seq_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "张三",
  "is_ai_agent": false,
  "department_id": "dept_sales",
  "manager_id": "mgr_001"
}
```

- **响应 Payload（成功）**：

```json
{
  "seq_id": "550e8400-e29b-41d4-a716-446655440000",
  "code": 0,
  "message": "ok",
  "data": {
    "employee_id": "emp_zhangsan_001",
    "name": "张三",
    "created_at": "2025-02-03T10:00:00.000Z",
    "mqtt_connection": {
      "broker_host": "broker.example.com",
      "broker_port": 8883,
      "use_tls": true,
      "mqtt_username": "emp_zhangsan_001",
      "mqtt_password": "***"
    }
  }
}
```

---

## employee.update（员工更新）

- **请求 Payload**：

```json
{
  "action": "employee.update",
  "seq_id": "dd0e8400-e29b-41d4-a716-446655440008",
  "employee_id": "emp_zhangsan_001",
  "updates": {
    "name": "张三（销售）",
    "department_id": "dept_sales",
    "manager_id": "mgr_002"
  }
}
```

- **响应 Payload（成功）**：

```json
{
  "seq_id": "dd0e8400-e29b-41d4-a716-446655440008",
  "code": 0,
  "message": "ok",
  "data": {
    "employee_id": "emp_zhangsan_001",
    "updated_at": "2025-02-03T10:20:00.000Z"
  }
}
```

---

## org.tree（组织架构获取）

- **请求 Payload**：

```json
{
  "action": "org.tree",
  "seq_id": "990e8400-e29b-41d4-a716-446655440004"
}
```

- **响应 Payload（成功）**：

```json
{
  "seq_id": "990e8400-e29b-41d4-a716-446655440004",
  "code": 0,
  "message": "ok",
  "data": {
    "departments": [
      { "department_id": "dept_sales", "name": "销售部", "parent_id": null, "sort_order": 1 },
      { "department_id": "dept_tech", "name": "技术部", "parent_id": null, "sort_order": 2 }
    ],
    "employees": [
      { "employee_id": "emp_zhangsan_001", "name": "张三", "department_id": "dept_sales", "manager_id": "mgr_001", "is_ai_agent": false },
      { "employee_id": "ai_sales_001", "name": "销售小助", "department_id": "dept_sales", "is_ai_agent": true }
    ]
  }
}
```

---

## department.create / update / delete（部门管理，若实现支持）

- **department.create 请求**：

```json
{
  "action": "department.create",
  "seq_id": "dept_seq_001",
  "name": "华东区",
  "parent_id": "dept_sales",
  "sort_order": 1
}
```

- **department.update 请求**：

```json
{
  "action": "department.update",
  "seq_id": "dept_seq_002",
  "department_id": "dept_east",
  "updates": { "name": "华东销售区", "parent_id": "dept_sales", "sort_order": 2 }
}
```

- **department.delete 请求**：

```json
{
  "action": "department.delete",
  "seq_id": "dept_seq_003",
  "department_id": "dept_east"
}
```

响应格式同通用（code、message、data）；具体 action 名称以实际实现为准。

---

## group.create（创建群组）

- **请求 Payload**：

```json
{
  "action": "group.create",
  "seq_id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "XX项目组",
  "member_ids": ["emp_zhangsan_001", "emp_lisi_002", "ai_sales_001"],
  "opts": { "description": "项目协作群" }
}
```

- **响应 Payload（成功）**：

```json
{
  "seq_id": "660e8400-e29b-41d4-a716-446655440001",
  "code": 0,
  "message": "ok",
  "data": {
    "group_id": "grp_project_001",
    "name": "XX项目组",
    "member_ids": ["emp_zhangsan_001", "emp_lisi_002", "ai_sales_001"],
    "created_at": "2025-02-03T10:05:00.000Z"
  }
}
```

---

## group.dismiss（解散群组）

- **请求 Payload**：

```json
{
  "action": "group.dismiss",
  "seq_id": "ee0e8400-e29b-41d4-a716-446655440009",
  "group_id": "grp_project_001"
}
```

- **响应 Payload（成功）**：`data` 可含 `group_id`、`dismissed_at`。

---

## group.member_add（添加群成员）

- **请求 Payload**：

```json
{
  "action": "group.member_add",
  "seq_id": "ff0e8400-e29b-41d4-a716-44665544000a",
  "group_id": "grp_project_001",
  "member_ids": ["emp_wangwu_003"]
}
```

- **响应 Payload（成功）**：`data` 含 `group_id`、`added_ids`、`current_member_count`。

---

## group.member_remove（移除群成员）

- **请求 Payload**：

```json
{
  "action": "group.member_remove",
  "seq_id": "000e8400-e29b-41d4-a716-44665544000b",
  "group_id": "grp_project_001",
  "member_ids": ["emp_wangwu_003"]
}
```

响应为通用结构（code、message、data）。
