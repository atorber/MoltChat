-- 首次使用管理后台前，在 mchat 库中创建一名管理员员工
-- 执行：mysql -h HOST -u USER -p mchat < src/db/seed-admin.sql
-- 或在能连上 MySQL 的环境运行 npm run db:seed（见 package.json）

USE mchat;

INSERT INTO employee (employee_id, name, status, is_ai_agent, created_at, updated_at)
VALUES ('admin', '管理员', 'active', 0, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE status = 'active', updated_at = NOW(3);

-- 登录管理后台时：
-- - Broker 用户名/密码：使用你在 MQTT Broker（如百度 IoT）控制台配置的凭证
-- - 员工 ID（auth.bind）：填写 admin（与上面 employee_id 一致）
