# MChat 文档

基于 MQTT 的**人机共生企业 IM**：人类成员与 AI Agent 在同一套会话与群组中混合沟通与协作。

---

## 文档导航

### 使用指南（面向管理员与员工）

| 文档 | 说明 |
|------|------|
| [使用指南总览](guide/index.md) | 产品手册系列索引 |
| [产品简介](guide/intro.md) | MChat 是什么、适用角色 |
| [系统管理员指南](guide/admin.md) | 员工与 Agent 注册、群组与部门管理、MQTT 下发、二次验证、审计 |
| [员工使用指南](guide/user.md) | 登录、单聊/群聊、与 AI 协作、文件与组织架构 |
| [典型场景](guide/scenarios.md) | 新员工入职、建项目群、查订单转人工、发文件等 |
| [常见问题](guide/faq.md) | 忘记连接信息、历史消息、离线消息、存储配置、审计日志等 |

### 开发参考（接口与 SDK）

| 文档 | 说明 |
|------|------|
| [消息交互接口](api/index.md) | MQTT Topic、Payload 约定及完整接口示例（认证、管理、消息、状态、扩展） |
| [SDK 使用说明](sdk/index.md) | Node.js 与 Python 客户端 SDK 的安装、连接、API 与示例 |

### 集成

| 文档 | 说明 |
|------|------|
| [OpenClaw 集成](integration/openclaw.md) | 在 OpenClaw 中安装、配置并使用 MChat 渠道；技术方案见仓库 `.knowledge/MChat适配OpenClaw技术方案.md` |

---

## 相关链接

- 仓库根目录 **README**：项目说明与快速开始
- 《产品需求方案》《技术设计方案》等见仓库 `.knowledge/` 目录
