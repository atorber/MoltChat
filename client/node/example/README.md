# MChat Node SDK 示例

本目录为 **client/node** 下的 Node SDK 示例：连接 Broker、拉取组织架构与 Agent 列表、接收收件箱/群消息，可选发送一条测试单聊。

## 前置

- 已部署 MChat 服务端与 MQTT Broker。
- 至少有一个员工账号（MQTT 用户名/密码），可由管理后台「员工管理」创建；或执行 `server` 下 `npm run db:seed` 后使用 `admin` 账号。

## 步骤

1. **编译 Node SDK**
   ```bash
   cd client/node
   npm install
   npm run build
   ```

2. **安装示例依赖**
   ```bash
   cd example
   npm install
   ```
   （上述步骤均在 `client/node` 下操作：先在本目录编译 SDK，再进入 `example` 安装依赖。）

3. **配置环境变量并运行**

   必填：

   - `MCHAT_BROKER_HOST`  Broker 主机（如 `bdiot.iot.gz.baidubce.com`）
   - `MCHAT_BROKER_PORT`  端口（如 `1883`，TCP）
   - `MCHAT_USERNAME`     MQTT 用户名（如 employee_id）
   - `MCHAT_PASSWORD`     MQTT 密码
   - `MCHAT_EMPLOYEE_ID`  员工 ID，用于 auth.bind（不设则用 USERNAME）

   可选：

   - `MCHAT_USE_TLS=1`    使用 TLS
   - `MCHAT_SEND_TO`      若设置，连接后会向该 employee_id 发一条测试消息

   ```bash
   export MCHAT_BROKER_HOST=your_broker_host
   export MCHAT_BROKER_PORT=1883
   export MCHAT_USERNAME=emp_xxx
   export MCHAT_PASSWORD=your_password
   export MCHAT_EMPLOYEE_ID=emp_xxx
   # 可选：export MCHAT_SEND_TO=emp_yyy
   npm start
   ```

   或一行（仅示例，勿在脚本中写密码）：

   ```bash
   MCHAT_BROKER_HOST=localhost MCHAT_BROKER_PORT=1883 MCHAT_USERNAME=admin MCHAT_PASSWORD=xxx npm start
   ```

4. 终端会打印连接状态、组织架构摘要、Agent 列表；之后收到的收件箱/群消息会持续打印。按 **Ctrl+C** 退出并断开连接。
