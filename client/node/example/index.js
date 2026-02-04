/**
 * MChat Node SDK 示例
 *
 * 使用前：
 * 1. 在 client/node 下执行 npm install && npm run build
 * 2. 在 client/node/example 下执行 npm install
 * 3. 设置环境变量后执行 node index.js 或 npm start
 *
 * 环境变量（必填）：
 *   MCHAT_BROKER_HOST   Broker 主机
 *   MCHAT_BROKER_PORT   Broker 端口（如 1883）
 *   MCHAT_USERNAME      MQTT 用户名（如 employee_id）
 *   MCHAT_PASSWORD      MQTT 密码
 *   MCHAT_EMPLOYEE_ID   员工 ID（与 auth.bind 一致，通常同 username）
 *
 * 可选：
 *   MCHAT_USE_TLS       为 1 时使用 TLS
 *   MCHAT_SEND_TO       若设置，连接后会向该 employee_id 发一条测试消息
 */

const {
  MChatClient,
  sendPrivateMessage,
  getOrgTree,
  getAgentCapabilityList,
} = require('mchat-client');

const host = process.env.MCHAT_BROKER_HOST || 'localhost';
const port = parseInt(process.env.MCHAT_BROKER_PORT || '1883', 10);
const useTls = process.env.MCHAT_USE_TLS === '1';
const username = process.env.MCHAT_USERNAME;
const password = process.env.MCHAT_PASSWORD;
const employeeId = process.env.MCHAT_EMPLOYEE_ID || username;
const sendTo = process.env.MCHAT_SEND_TO;

if (!username || !password) {
  console.error('请设置 MCHAT_USERNAME 和 MCHAT_PASSWORD');
  process.exit(1);
}

const client = new MChatClient({
  brokerHost: host,
  brokerPort: port,
  useTls,
  username,
  password,
  employeeId,
  requestTimeoutMs: 15000,
});

client.on('connect', () => {
  console.log('[example] 已连接');
});

client.on('offline', () => {
  console.log('[example] 已断开');
});

client.on('error', (err) => {
  console.error('[example] 错误:', err.message);
});

client.on('inbox', (payload) => {
  console.log('[example] 收件箱消息:', JSON.stringify(payload, null, 2));
});

client.on('group', (groupId, payload) => {
  console.log('[example] 群消息', groupId, JSON.stringify(payload, null, 2));
});

async function main() {
  try {
    await client.connect();
    console.log('[example] client_id:', client.getClientId());

    const tree = await getOrgTree(client);
    if (tree.data) {
      console.log('[example] 组织架构 - 部门数:', tree.data.departments?.length ?? 0, '员工数:', tree.data.employees?.length ?? 0);
    }

    const agents = await getAgentCapabilityList(client);
    if (agents.data?.agent_ids?.length) {
      console.log('[example] Agent 列表:', agents.data.agent_ids);
    }

    if (sendTo) {
      await sendPrivateMessage(client, sendTo, '来自 Node 示例的测试消息');
      console.log('[example] 已向', sendTo, '发送测试消息');
    }

    console.log('[example] 运行中，收件箱/群消息将打印在上方。按 Ctrl+C 退出。');
  } catch (err) {
    console.error('[example] 失败:', err.message);
    process.exit(1);
  }
}

main();

process.on('SIGINT', async () => {
  console.log('\n[example] 正在断开...');
  await client.disconnect();
  process.exit(0);
});
