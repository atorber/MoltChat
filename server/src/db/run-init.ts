/**
 * 用 Node + mysql2 执行 init-db.sql：创建数据库并建表（无需本机安装 mysql 客户端）
 * 使用 config/config.yaml 中的 mysql 配置
 */

import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';
import { loadConfig } from '../config';

async function main(): Promise<void> {
  const config = loadConfig();
  const { host, port, user, password, database } = config.mysql;

  const sqlPath = path.join(__dirname, 'init-db.sql');
  const fullSql = fs.readFileSync(sqlPath, 'utf8');

  // 第一段：CREATE DATABASE（不指定 database 连接）
  const connNoDb = await mysql.createConnection({
    host,
    port: port ?? 3306,
    user,
    password,
  });
  await connNoDb.query('CREATE DATABASE IF NOT EXISTS `mchat` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await connNoDb.end();
  console.log('[db:init] database mchat created or exists');

  // 第二段：USE 之后的全部内容（在 mchat 库中建表）
  const useIndex = fullSql.indexOf('USE mchat;');
  const schemaSql = useIndex >= 0 ? fullSql.slice(useIndex + 'USE mchat;'.length).trim() : fullSql;
  const conn = await mysql.createConnection({
    host,
    port: port ?? 3306,
    user,
    password,
    database: 'mchat',
    multipleStatements: true,
  });
  await conn.query(schemaSql);
  await conn.end();
  console.log('[db:init] tables created');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
