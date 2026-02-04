/**
 * 统一配置文件加载与校验
 * 支持 YAML，通过环境变量 CONFIG_PATH 指定路径，默认 config/config.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { AppConfig } from './types';

const defaultPath = path.join(__dirname, '..', 'config', 'config.yaml');

function loadRaw(): unknown {
  const configPath = process.env.CONFIG_PATH || defaultPath;
  if (!fs.existsSync(configPath)) {
    throw new Error(`配置文件不存在: ${configPath}，可参考 config/config.sample.yaml`);
  }
  const content = fs.readFileSync(configPath, 'utf8');
  if (configPath.endsWith('.json')) {
    return JSON.parse(content);
  }
  return yaml.load(content);
}

function validate(config: unknown): asserts config is AppConfig {
  if (!config || typeof config !== 'object') throw new Error('配置必须为对象');
  const c = config as Record<string, unknown>;

  const broker = c.broker as Record<string, unknown> | undefined;
  if (!broker || typeof broker.host !== 'string' || typeof broker.port !== 'number') {
    throw new Error('配置缺少 broker.host / broker.port');
  }

  const mysql = c.mysql as Record<string, unknown> | undefined;
  if (!mysql || typeof mysql.host !== 'string' || typeof mysql.database !== 'string') {
    throw new Error('配置缺少 mysql.host / mysql.database');
  }

  const storage = c.storage as Record<string, unknown> | undefined;
  if (!storage || typeof storage.endpoint !== 'string' || typeof storage.bucket !== 'string') {
    throw new Error('配置缺少 storage.endpoint / storage.bucket');
  }
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const raw = loadRaw();
  validate(raw);
  cached = raw as AppConfig;
  return cached;
}
