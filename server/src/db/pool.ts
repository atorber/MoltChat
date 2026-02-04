/**
 * MySQL 连接池，由统一配置创建
 */

import * as mysql from 'mysql2/promise';
import type { MysqlConfig } from '../types';

let pool: mysql.Pool | null = null;

export function getPool(config: MysqlConfig): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.host,
      port: config.port ?? 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: config.poolSize ?? 10,
      connectTimeout: config.connectTimeout ?? 10000,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
