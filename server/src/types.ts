/**
 * 服务端通用类型：请求上下文、响应、配置等
 */

export interface BrokerConfig {
  host: string;
  port: number;
  useTls: boolean;
  clientId: string;
  username?: string;
  password?: string;
  shareSubscription?: string;
}

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolSize?: number;
  connectTimeout?: number;
}

export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  presignExpires?: number;
}

export interface AppConfig {
  broker: BrokerConfig;
  mysql: MysqlConfig;
  storage: StorageConfig;
}

/** 请求上下文：从 topic + payload 解析，传给 handler */
export interface ReqContext {
  client_id: string;
  seq_id: string;
  action: string;
  employee_id?: string;  // 鉴权后填入（auth.bind 除外）
  payload: Record<string, unknown>;
}

/** 统一响应体 */
export interface RespPayload {
  code: number;
  message: string;
  data?: unknown;
}

/** 错误码 */
export const Code = {
  OK: 0,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
  GATEWAY_TIMEOUT: 504,
} as const;
