-- 创建数据库并初始化表（首次部署执行此文件即可）
-- 用法：mysql -h HOST -u USER -p < server/src/db/init-db.sql  （无需指定数据库名）

CREATE DATABASE IF NOT EXISTS mchat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mchat;

SET NAMES utf8mb4;

-- MChat 服务端表结构（与技术方案 2.1 一致）
-- 不存储消息历史，仅组织/员工/群组/会话/审计

CREATE TABLE IF NOT EXISTS department (
  department_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  parent_id VARCHAR(64) NULL,
  sort_order INT DEFAULT 0,
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee (
  employee_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  department_id VARCHAR(64) NULL,
  manager_id VARCHAR(64) NULL,
  is_ai_agent TINYINT(1) NOT NULL DEFAULT 0,
  agent_profile JSON NULL,
  skills_badge JSON NULL,
  status VARCHAR(32) DEFAULT 'active',
  mqtt_password VARCHAR(255) NULL COMMENT 'Broker 登录密码，employee.create 时生成',
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_department (department_id),
  INDEX idx_ai (is_ai_agent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `group` (
  group_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  creator_employee_id VARCHAR(64) NOT NULL,
  description VARCHAR(512) NULL,
  avatar VARCHAR(512) NULL,
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_creator (creator_employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS group_member (
  group_id VARCHAR(64) NOT NULL,
  employee_id VARCHAR(64) NOT NULL,
  role VARCHAR(32) DEFAULT 'member',
  joined_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (group_id, employee_id),
  INDEX idx_employee (employee_id),
  FOREIGN KEY (group_id) REFERENCES `group`(group_id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employee(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_session (
  client_id VARCHAR(255) PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  device_info VARCHAR(255) NULL,
  connected_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NULL,
  INDEX idx_employee (employee_id),
  FOREIGN KEY (employee_id) REFERENCES employee(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  operator_employee_id VARCHAR(64) NULL,
  client_id VARCHAR(255) NULL,
  action VARCHAR(64) NOT NULL,
  params_json TEXT NULL,
  result_code INT NOT NULL,
  ts DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_ts (ts),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS challenge (
  challenge_id VARCHAR(64) PRIMARY KEY,
  token_hash VARCHAR(255) NOT NULL,
  employee_id VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
