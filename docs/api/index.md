# 消息交互接口

汇总**全部 MQTT 消息交互接口**的 Topic、Payload 约定及示例，便于开发对接与联调。

---

## 文档结构

| 文档 | 内容 |
|------|------|
| [通用约定](convention.md) | 请求/响应 Topic、Payload 格式、错误码、消息 content 类型 |
| [认证与会话](auth.md) | auth.bind、auth.challenge |
| [管理类接口](management.md) | employee、org.tree、department、group |
| [消息类接口](messaging.md) | msg.send_private、msg.send_group、msg.read_ack 及收件箱/群投递 |
| [状态与扩展](status-and-ext.md) | 在线状态、个人资料、系统通知、config.storage、agent.*、file.* |

---

## 接口一览表

### 认证与会话

| action        | 说明 |
|---------------|------|
| auth.bind     | 会话绑定（可选），建立 client_id ↔ employee_id 映射 |
| auth.challenge| 敏感操作二次验证，获取 challenge_id + token |

### 管理类

| action             | 说明 |
|--------------------|------|
| employee.create    | 创建员工（人类或 AI Agent），成功返回 mqtt_connection |
| employee.update    | 更新员工资料或 Agent 配置 |
| org.tree           | 获取组织树（部门 + 员工列表） |
| department.create | 创建部门（若实现支持） |
| department.update  | 更新部门（若实现支持） |
| department.delete  | 删除/停用部门（若实现支持） |
| group.create       | 创建群组 |
| group.dismiss      | 解散群组 |
| group.member_add   | 添加群成员 |
| group.member_remove| 移除群成员 |

### 消息类

| action           | 说明 |
|------------------|------|
| msg.send_private | 发送单聊消息 |
| msg.send_group   | 发送群聊消息 |
| msg.read_ack     | 已读回执（请求-响应方式） |

**服务端投递（客户端订阅）**：

| Topic                       | 说明 |
|-----------------------------|------|
| mchat/inbox/{employee_id}   | 个人收件箱（单聊、系统通知等） |
| mchat/group/{group_id}      | 群聊消息 |

### 状态与资料（订阅/发布）

| Topic                         | 说明 |
|-------------------------------|------|
| mchat/status/{employee_id}    | 在线状态（LWT，retain=true） |
| mchat/profile/{employee_id}   | 个人资料变更通知 |
| mchat/system/notify           | 全局系统通知 |

### 扩展与可选

| action               | 说明 |
|----------------------|------|
| config.storage       | 获取对象存储读写配置 |
| agent.capability_list| 查询 Agent 能力列表 |
| file.upload_url      | 获取单次上传临时 URL（若实现） |
| file.download_url    | 获取单次下载临时 URL（若实现） |

---

## 文档与更新

- 示例中的 broker_host、employee_id、group_id、凭证等均为示例值，实际以服务端返回为准。
