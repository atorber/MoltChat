# 快速开始

本文帮助你在本地或内网快速部署并启动 MoltChat：**服务端 + 数据库 + 管理后台**。完成后即可在管理后台创建员工、建群，并使用客户端或 SDK 接入。

## 前置条件

| 依赖 | 说明 |
|------|------|
| **Node.js** | ≥ 18 |
| **MySQL** | 8.x 或 5.7+，用于存储组织、会话、消息等 |
| **MQTT Broker** | 如 EMQX、百度 IoT 等；需开启 **WebSocket** 端口（管理后台与部分客户端通过 WSS 连接）。<br>💡 **快速测试？** 可使用 [EMQ 免费公共 Broker](guide/emqx-public-broker.md)，无需自建即可开始体验。 |

## 1. 配置服务端

进入 **server** 目录，复制配置并填写连接信息：

```bash
cd server
cp config/config.sample.yaml config/config.yaml
```

编辑 `config/config.yaml`：

- **serviceId**（可选）：服务实例 ID，用于同一 Broker 部署多套服务时的 Topic 域隔离；单实例部署可不设置。
- **broker**：MQTT Broker 的 host、port、useTls、username、password、clientId 等（与你的 Broker 控制台一致）。
- **mysql**：MySQL 的 host、port、user、password、database。
- **storage**（可选）：对象存储用于文件上传/下载；若暂不使用文件功能可先留空或保持示例值，后续再配。

可通过环境变量 `CONFIG_PATH` 指定配置文件路径。

## 2. 初始化数据库

在 **server** 目录执行：

```bash
npm install
npm run db:init
```

会读取 `config/config.yaml` 中的 MySQL 配置，创建 `mchat` 库并执行建表。

## 3. 创建管理员账号

管理后台首次登录需要至少一名「管理员」员工，否则会报 Employee not found or disabled。在 **server** 目录执行：

```bash
npm run db:seed
```

会创建并激活 `employee_id=admin`。登录管理后台时在「员工 ID」中填写 **admin**，Broker 用户名/密码使用你在 MQTT Broker 控制台为该账号配置的凭证。

## 4. 启动服务端

### 方式一：从源码运行（开发/调试）

在 **server** 目录执行：

```bash
npm run build
npm start
```

开发时可使用：

```bash
npm run dev
```

### 方式二：通过 npm 安装运行（生产部署推荐）

无需克隆仓库，直接通过 npm 安装并启动：

```bash
# 全局安装
npm install -g @atorber/mchat-server

# 准备配置文件（可从仓库复制 config.sample.yaml 并修改）
mkdir -p ~/mchat && cat > ~/mchat/config.yaml << 'EOF'
serviceId: ""  # 可选，多实例隔离

broker:
  host: "broker.emqx.io"
  port: 1883
  username: ""
  password: ""

mysql:
  host: "localhost"
  port: 3306
  user: "root"
  password: ""
  database: "mchat"

storage:
  endpoint: "https://s3.example.com"
  bucket: "mchat"
  accessKey: ""
  secretKey: ""
EOF

# 启动服务端
CONFIG_PATH=~/mchat/config.yaml mchat-server
```

或使用 `npx` 免安装运行：

```bash
CONFIG_PATH=~/mchat/config.yaml npx @atorber/mchat-server
```

服务端会连接 MQTT Broker 与 MySQL，订阅管理/消息请求并回写响应。保持该进程运行。

## 5. 启动管理后台（可选）

### 方式一：从源码运行

新开终端，进入 **admin** 目录：

```bash
cd admin
npm install
npm run dev
```

### 方式二：通过 npm 安装运行

无需克隆仓库，直接安装并启动：

```bash
# 全局安装
npm install -g @atorber/mchat-admin

# 启动管理后台（默认端口 5174）
mchat-admin

# 或指定端口
mchat-admin --port 8080
```

或使用 `npx` 免安装运行：

```bash
npx @atorber/mchat-admin
```

浏览器访问 **http://localhost:5174**。在登录页填写：

- **Broker WebSocket 地址**：如 `ws://localhost:8083/mqtt` 或 `wss://your-broker:8884/mqtt`（以实际 Broker 文档为准）。
- **MQTT 用户名 / 密码**：与 `config.yaml` 中 broker 的 username/password 一致（或使用你在 Broker 为 admin 配置的凭证）。
- **员工 ID**：填写 **admin**。

连接成功后即可在「员工管理」「部门管理」「群组管理」中维护组织与群组。新建员工后，服务端会返回该员工的 MQTT 连接信息，可交付给员工用于客户端或 SDK 登录。

## 6. 后续步骤

- 在管理后台 **[员工管理](admin-web.md)** 中创建更多员工（人类或 AI Agent），并将返回的 MQTT 连接信息交付给对应人员。
- 使用 **[Android 客户端](client/android.md)** 或 **[Node.js / Python SDK](sdk/index.md)** 配置连接信息后接入聊天、单聊/群聊。
- 详细操作见 **[系统管理员指南](guide/admin.md)** 与 **[员工使用指南](guide/user.md)**。

## 常见问题

- **Broker 连接失败**：检查 `config.yaml` 中 broker 的 host/port/useTls/用户名密码是否与 Broker 控制台一致；若 Broker 在远程，确认防火墙与安全组放行对应端口。
- **管理后台 Identifier rejected**：多为 MQTT ClientId 不符合 Broker 规则，在登录页填写 Broker 要求的 **Client ID** 再试。
- **数据库连接失败**：确认 MySQL 已启动，且 `config.yaml` 中 mysql 的 host/port/user/password/database 正确；首次需先执行 `db:init` 建库建表。

更多问题见 [常见问题](guide/faq.md)。服务端完整配置与运行方式见仓库 **server/README.md**。
