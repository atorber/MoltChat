/**
 * 在 mchat 库中创建初始管理员员工（employee_id=admin），便于首次登录管理后台
 */

import * as mysql from 'mysql2/promise';
import { loadConfig } from '../config';

async function main(): Promise<void> {
  const config = loadConfig();
  const { host, port, user, password, database } = config.mysql;
  const conn = await mysql.createConnection({
    host,
    port: port ?? 3306,
    user,
    password,
    database,
  });
  await conn.execute(
    `INSERT INTO employee (employee_id, name, status, is_ai_agent, created_at, updated_at)
     VALUES ('admin', '管理员', 'active', 0, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE status = 'active', updated_at = NOW(3)`
  );
  await conn.end();
  console.log('[db:seed] 管理员员工已创建或已激活：employee_id=admin');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
