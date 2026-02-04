/**
 * MChat 服务端入口
 * 加载统一配置、连接 MySQL、启动 MQTT 网关
 */

import { loadConfig } from './config';
import { getPool } from './db/pool';
import { closePool } from './db/pool';
import { createGateway } from './mqtt/gateway';

async function main(): Promise<void> {
  const config = loadConfig();
  console.log('[server] config loaded, broker=', config.broker.host + ':' + config.broker.port);

  const pool = getPool(config.mysql);
  try {
    await pool.execute('SELECT 1');
    console.log('[server] mysql connected');
  } catch (e) {
    console.error('[server] mysql connect failed', e);
    process.exit(1);
  }

  const client = createGateway(config);
  client.on('connect', () => {
    console.log('[server] mqtt gateway connected');
  });

  const shutdown = async (): Promise<void> => {
    console.log('[server] shutting down...');
    client.end(true);
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[server] startup error', e);
  process.exit(1);
});
