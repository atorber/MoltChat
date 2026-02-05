# MoltChat 服务端

依据《技术设计方案》实现的 Node.js + TypeScript 服务端：统一配置、MQTT 网关、MySQL、各 Action Handler。

## 功能

- **统一配置**：`config/config.yaml` 管理 MQTT 连接、MySQL 连接、对象存储鉴权（见 `config/config.sample.yaml`）。
- **MQTT 网关**：连接 Broker，订阅 `mchat/msg/req/+/+`（或共享订阅），解析 topic 得 `client_id`/`seq_id`，payload 得 `action`，路由到对应 Handler，响应发布到 `mchat/msg/resp/{client_id}/{seq_id}`。
- **鉴权**：除 `auth.bind` 外，均需 `client_id` 在 `client_session` 中有关联 `employee_id`。
- **Handler**：auth、employee、org、department、group、msg（send_private/send_group/read_ack）、config.storage、agent.capability_list、file.upload_url/download_url。

## 前置

- Node.js >= 18
- MySQL 8（或 5.7+）
- MQTT Broker（如 EMQX）

## 配置

1. 复制 `config/config.sample.yaml` 为 `config/config.yaml`。
2. 填写 `broker`（host/port/useTls/clientId/username/password）、`mysql`（host/port/user/password/database）、`storage`（endpoint/region/bucket/accessKey/secretKey）。
3. 可选：配置 `serviceId` 用于多实例隔离（同一 Broker 部署多套服务时），格式为小写字母+数字+下划线，1-32字符。不设置则兼容原有 topic（无前缀）。
4. 可通过环境变量 `CONFIG_PATH` 指定配置文件路径。

## 数据库

**首次部署**：创建数据库并建表（无需本机安装 mysql 客户端），在 `server` 目录执行：

```bash
npm run db:init
```

会读取 `config/config.yaml` 中的 MySQL 配置，先创建 `mchat` 库再执行建表。

若已安装 mysql 客户端，也可：

```bash
mysql -h HOST -P PORT -u USER -p < src/db/init-db.sql
```

**管理后台首次登录**：需在库中有一条「管理员」员工，否则管理端 auth.bind 会报 Employee not found or disabled。执行：

```bash
npm run db:seed
```

会创建/激活 `employee_id=admin`。登录管理后台时在「员工 ID」中填 **admin**，Broker 用户名/密码用你在 MQTT Broker 控制台配置的凭证。

## 运行

**从源码运行**：

```bash
cd server
npm install
npm run build
npm start
```

开发时可直接：

```bash
npm run dev
```

**通过 npm 安装并 CLI 启动**（适合已发布到 npm 或本地 link）：

```bash
# 全局安装
npm install -g @atorber/mchat-server

# 指定配置文件路径启动
CONFIG_PATH=/path/to/your/config.yaml mchat-server
```

或临时运行（不安装到全局）：

```bash
CONFIG_PATH=/path/to/your/config.yaml npx @atorber/mchat-server
```

使用全局安装或 `npx` 时，默认会查找包内 `config/config.yaml`（包内仅含示例文件），因此**必须通过环境变量 `CONFIG_PATH` 指定实际配置文件路径**。

## 项目结构

```
server/
├── config/
│   ├── config.sample.yaml   # 配置示例
│   └── config.yaml          # 实际配置（勿提交）
├── src/
│   ├── index.ts             # 入口
│   ├── config.ts             # 配置加载与校验
│   ├── types.ts              # 类型定义
│   ├── db/
│   │   ├── schema.sql        # 建表 SQL
│   │   ├── pool.ts           # MySQL 连接池
│   │   └── session.ts        # client_session 查询/写入
│   ├── mqtt/
│   │   ├── gateway.ts        # MQTT 订阅与响应发布
│   │   └── router.ts         # 鉴权与 action 分发
│   └── handlers/
│       ├── auth.ts           # auth.bind / auth.challenge
│       ├── employee.ts       # employee.create / update
│       ├── org.ts             # org.tree
│       ├── department.ts     # department.create / update / delete
│       ├── group.ts           # group.create / dismiss / member_add / remove
│       ├── msg.ts             # msg.send_private / send_group / read_ack
│       ├── config.ts         # config.storage
│       ├── agent.ts           # agent.capability_list
│       └── file.ts            # file.upload_url / download_url
├── package.json
├── tsconfig.json
└── README.md
```

## 接口约定

与《消息交互接口与示例》一致：

- 请求 Topic：`mchat/msg/req/{client_id}/{seq_id}`
- 响应 Topic：`mchat/msg/resp/{client_id}/{seq_id}`
- Payload 含 `action` 及业务参数；响应含 `code`、`message`、`data`

### 多实例隔离（serviceId）

若配置了 `serviceId`，所有 Topic 将增加前缀 `{serviceId}/`：

- 请求 Topic：`{serviceId}/mchat/msg/req/{client_id}/{seq_id}`
- 响应 Topic：`{serviceId}/mchat/msg/resp/{client_id}/{seq_id}`
- 收件箱：`{serviceId}/mchat/inbox/{employee_id}`
- 群消息：`{serviceId}/mchat/group/{group_id}`

不设置 `serviceId` 时保持原有格式，向后兼容。
