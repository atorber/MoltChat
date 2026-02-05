#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 默认端口
const DEFAULT_PORT = 5174;

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  let port = DEFAULT_PORT;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-p' || args[i] === '--port') && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error('Invalid port number');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '-h' || args[i] === '--help') {
      console.log(`
MoltChat Admin - Web 管理后台

用法: mchat-admin [选项]

选项:
  -p, --port <端口>    指定监听端口 (默认: ${DEFAULT_PORT})
  -h, --help           显示帮助信息

示例:
  mchat-admin                 # 使用默认端口 ${DEFAULT_PORT}
  mchat-admin --port 8080     # 使用端口 8080
`);
      process.exit(0);
    }
  }

  return { port };
}

// 静态文件目录（相对于此脚本）
const DIST_DIR = path.join(__dirname, '..', 'dist');

// 检查 dist 目录是否存在
if (!fs.existsSync(DIST_DIR)) {
  console.error('Error: dist 目录不存在，请先运行 npm run build');
  process.exit(1);
}

const { port } = parseArgs();

const server = http.createServer((req, res) => {
  // 解析 URL
  const parsedUrl = url.parse(req.url || '/', true);
  let pathname = parsedUrl.pathname || '/';

  // 安全检查：防止目录遍历
  pathname = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');

  // 默认文件
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(DIST_DIR, pathname);

  // 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 对于 SPA，所有未找到的路由返回 index.html
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    // 获取文件扩展名和 MIME 类型
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 读取并返回文件
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`
  MoltChat Admin 管理后台已启动

  本地访问: http://localhost:${port}

  首次使用请在登录页填写:
  - Broker WebSocket 地址 (如 wss://broker.emqx.io:8084/mqtt)
  - MQTT 用户名 / 密码
  - 员工 ID (首次可用 admin)

  按 Ctrl+C 停止服务
`);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  server.close(() => {
    console.log('服务已停止');
    process.exit(0);
  });
});
