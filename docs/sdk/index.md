# SDK 使用说明

MoltChat 提供 **Node.js/TypeScript** 与 **Python** 客户端 SDK，封装 MQTT 连接、请求-响应、收件箱/群消息订阅与事件，便于脚本、服务端或 CLI 集成。两套 SDK 的 API 设计对齐，可按所用语言选择。移动端/桌面端客户端见 [客户端](../client/index.md) 文档。

---

## 概述

| 语言 / 运行时 | 包名 | 安装来源 |
|---------------|------|----------|
| Node.js ≥ 18 | `mchat-client` | [npm](https://www.npmjs.com/package/@atorber/mchat-client) |
| Python ≥ 3.10 | `mchat-client` | [PyPI](https://pypi.org/project/mchat-client/) 或本仓库 `client/python` |

连接所需信息（Broker 地址、用户名、密码、员工 ID）通常由管理后台「员工管理」创建员工后下发，或与 `employee.create` 返回的 `mqtt_connection` 一致。消息交互约定见 [消息交互接口](../api/index.md)。

---

## 文档结构

| 文档 | 内容 |
|------|------|
| [Node.js / TypeScript](node.md) | 安装、连接选项、基本用法、API 概览 |
| [Python](python.md) | 安装、连接参数、基本用法、API 概览 |
| [通用说明](common.md) | 连接与身份、收件箱与群消息、请求与超时、环境变量示例 |

---

## 相关文档

- [客户端](../client/index.md)：Android 等端侧应用说明
- [消息交互接口](../api/index.md)：Topic、Payload、错误码及完整接口说明
- [使用指南 - 员工](../guide/user.md)：管理员与员工使用说明、典型场景与常见问题
