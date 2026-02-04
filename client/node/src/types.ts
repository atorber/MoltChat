/**
 * MChat Node 客户端类型定义
 */

/** 连接选项（与 employee.create 返回的 mqtt_connection 对应） */
export interface MChatClientOptions {
  /** Broker 主机 */
  brokerHost: string;
  /** Broker 端口 */
  brokerPort: number;
  /** 是否 TLS */
  useTls?: boolean;
  /** MQTT 用户名（如 employee_id） */
  username: string;
  /** MQTT 密码 */
  password: string;
  /** 当前员工 ID，用于 auth.bind、收件箱订阅、状态发布 */
  employeeId: string;
  /** 可选：指定 clientId；不传则自动生成 */
  clientId?: string;
  /** 可选：设备标识，用于生成 clientId */
  deviceId?: string;
  /** 请求超时毫秒，默认 30000 */
  requestTimeoutMs?: number;
  /** 为 true 时连接后不调用 auth.bind（Broker 已按身份认证时可省） */
  skipAuthBind?: boolean;
}

/** 请求响应体 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

/** 收件箱消息 payload（服务端投递格式） */
export interface InboxMessage {
  msg_id?: string;
  type?: string;
  from_employee_id?: string;
  content?: unknown;
  sent_at?: string;
  quote_msg_id?: string;
}

/** 群消息 payload */
export interface GroupMessage {
  msg_id?: string;
  group_id?: string;
  from_employee_id?: string;
  content?: unknown;
  sent_at?: string;
  quote_msg_id?: string;
}
