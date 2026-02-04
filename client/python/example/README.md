# MChat Python SDK 示例

本目录为 **client/python** 下的 Python SDK 示例：连接 Broker、拉取组织架构与 Agent 列表、接收收件箱/群消息，可选发送一条测试单聊。

## 前置

- 已部署 MChat 服务端与 MQTT Broker。
- 至少有一个员工账号（MQTT 用户名/密码），可由管理后台「员工管理」创建；或执行 `server` 下 `npm run db:seed` 后使用 `admin` 账号。

## 步骤

1. **安装 Python SDK（可编辑模式）**
   ```bash
   cd client/python
   pip install -e .
   ```

2. **配置环境变量并运行**

   在 **client/python** 目录下执行（以便正确解析 `mchat_client` 包）：

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
   python example/main.py
   ```

   或一行（仅示例，勿在脚本中写密码）：

   ```bash
   MCHAT_BROKER_HOST=localhost MCHAT_BROKER_PORT=1883 MCHAT_USERNAME=admin MCHAT_PASSWORD=xxx python example/main.py
   ```

3. 终端会打印连接状态、组织架构摘要、Agent 列表；之后收到的收件箱/群消息会持续打印。按 **Ctrl+C** 退出并断开连接。
