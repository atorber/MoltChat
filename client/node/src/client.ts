/**
 * MChat Node 客户端：MQTT 连接、请求-响应、收件箱/群订阅与事件
 */

import mqtt, { type MqttClient } from 'mqtt';
import type { MChatClientOptions, ApiResponse, InboxMessage, GroupMessage } from './types';

const REQ_PREFIX = 'mchat/msg/req/';
const RESP_PREFIX = 'mchat/msg/resp/';
const INBOX_PREFIX = 'mchat/inbox/';
const GROUP_PREFIX = 'mchat/group/';
const STATUS_PREFIX = 'mchat/status/';

type Pending = {
  resolve: (r: ApiResponse) => void;
  reject: (e: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

function genSeqId(): string {
  return 'seq_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now();
}

function genClientId(employeeId: string, deviceId?: string): string {
  const dev = deviceId || 'node';
  const uid = Math.random().toString(36).slice(2, 10);
  return `${employeeId}_${dev}_${uid}`;
}

export class MChatClient {
  private options: MChatClientOptions;
  private client: MqttClient | null = null;
  private clientId: string = '';
  private pending = new Map<string, Pending>();
  private listeners: {
    inbox: ((payload: InboxMessage) => void)[];
    group: ((groupId: string, payload: GroupMessage) => void)[];
    connect: (() => void)[];
    offline: (() => void)[];
    error: ((err: Error) => void)[];
  } = { inbox: [], group: [], connect: [], offline: [], error: [] };

  constructor(options: MChatClientOptions) {
    this.options = {
      requestTimeoutMs: 30000,
      ...options,
    };
  }

  /** 是否已连接 */
  get connected(): boolean {
    return this.client?.connected ?? false;
  }

  getClientId(): string {
    return this.clientId;
  }

  /** 连接 Broker，订阅 resp/inbox，可选 auth.bind，发布 online */
  async connect(): Promise<void> {
    const { brokerHost, brokerPort, useTls, username, password, employeeId, clientId, deviceId } = this.options;
    this.clientId = clientId?.trim() || genClientId(employeeId, deviceId);
    const protocol = useTls ? 'mqtts' : 'mqtt';
    const url = `${protocol}://${brokerHost}:${brokerPort}`;
    const will = {
      topic: `${STATUS_PREFIX}${employeeId}`,
      payload: JSON.stringify({ status: 'offline', updated_at: new Date().toISOString() }),
      retain: true,
    };

    return new Promise((resolve, reject) => {
      const c = mqtt.connect(url, {
        clientId: this.clientId,
        username,
        password,
        clean: false,
        reconnectPeriod: 5000,
        will,
      });
      this.client = c;

      c.on('connect', async () => {
        try {
          await this.subscribeResp(c);
          await this.subscribeInbox(c);
          await this.publishOnline(c);
          if (!this.options.skipAuthBind) {
            const r = await this.requestOnce(c, 'auth.bind', { employee_id: employeeId });
            if (r.code !== 0) console.warn('[mchat] auth.bind failed:', r.message);
          }
          this.listeners.connect.forEach((fn) => fn());
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      c.on('message', (topic: string, payload: Buffer) => {
        this.handleMessage(topic, payload);
      });

      c.on('error', (err) => {
        this.listeners.error.forEach((fn) => fn(err));
      });

      c.on('close', () => {
        this.listeners.offline.forEach((fn) => fn());
      });
    });
  }

  private subscribeResp(c: MqttClient): Promise<void> {
    return new Promise((res, rej) => {
      c.subscribe(`${RESP_PREFIX}${this.clientId}/+`, { qos: 1 }, (err) => (err ? rej(err) : res()));
    });
  }

  private subscribeInbox(c: MqttClient): Promise<void> {
    return new Promise((res, rej) => {
      c.subscribe(`${INBOX_PREFIX}${this.options.employeeId}`, { qos: 1 }, (err) => (err ? rej(err) : res()));
    });
  }

  private publishOnline(c: MqttClient): Promise<void> {
    return new Promise((res, rej) => {
      const topic = `${STATUS_PREFIX}${this.options.employeeId}`;
      const payload = JSON.stringify({ status: 'online', updated_at: new Date().toISOString() });
      c.publish(topic, payload, { qos: 1, retain: true }, (err) => (err ? rej(err) : res()));
    });
  }

  private requestOnce(c: MqttClient, action: string, params: Record<string, unknown>): Promise<ApiResponse> {
    const seqId = genSeqId();
    const topic = `${REQ_PREFIX}${this.clientId}/${seqId}`;
    const payload = JSON.stringify({ action, ...params });
    const timeoutMs = this.options.requestTimeoutMs ?? 30000;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.delete(seqId)) reject(new Error('Request timeout'));
      }, timeoutMs);
      this.pending.set(seqId, { resolve, reject, timeout });

      c.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          this.pending.delete(seqId);
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  private handleMessage(topic: string, payload: Buffer): void {
    if (topic.startsWith(RESP_PREFIX + this.clientId + '/')) {
      const seqId = topic.slice((RESP_PREFIX + this.clientId + '/').length);
      const p = this.pending.get(seqId);
      if (p) {
        this.pending.delete(seqId);
        clearTimeout(p.timeout);
        try {
          const body = JSON.parse(payload.toString('utf8')) as ApiResponse;
          p.resolve(body);
        } catch {
          p.reject(new Error('Invalid response JSON'));
        }
      }
      return;
    }
    if (topic.startsWith(INBOX_PREFIX) && topic === `${INBOX_PREFIX}${this.options.employeeId}`) {
      try {
        const body = JSON.parse(payload.toString('utf8')) as InboxMessage;
        this.listeners.inbox.forEach((fn) => fn(body));
      } catch (_) {}
      return;
    }
    if (topic.startsWith(GROUP_PREFIX)) {
      const groupId = topic.slice(GROUP_PREFIX.length);
      try {
        const body = JSON.parse(payload.toString('utf8')) as GroupMessage;
        this.listeners.group.forEach((fn) => fn(groupId, body));
      } catch (_) {}
    }
  }

  /** 发起一次请求 */
  async request<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
    if (!this.client?.connected) return Promise.reject(new Error('Not connected'));
    const r = await this.requestOnce(this.client, action, params);
    if (r.code !== 0) return Promise.reject(new Error(r.message || `code ${r.code}`));
    return r as ApiResponse<T>;
  }

  /** 订阅群消息（需先订阅再收该群消息） */
  subscribeGroup(groupId: string): Promise<void> {
    if (!this.client?.connected) return Promise.reject(new Error('Not connected'));
    return new Promise((res, rej) => {
      this.client!.subscribe(`${GROUP_PREFIX}${groupId}`, { qos: 1 }, (err) => (err ? rej(err) : res()));
    });
  }

  unsubscribeGroup(groupId: string): void {
    this.client?.unsubscribe(`${GROUP_PREFIX}${groupId}`);
  }

  on(
    event: 'inbox' | 'group' | 'connect' | 'offline' | 'error',
    fn: ((payload: InboxMessage) => void) | ((groupId: string, payload: GroupMessage) => void) | (() => void) | ((err: Error) => void)
  ): void {
    const list = this.listeners[event];
    if (Array.isArray(list)) list.push(fn as never);
  }

  async disconnect(): Promise<void> {
    this.pending.forEach((p) => {
      clearTimeout(p.timeout);
      p.reject(new Error('Disconnected'));
    });
    this.pending.clear();
    return new Promise((res) => {
      this.client?.end(true, {}, () => res());
      this.client = null;
      res();
    });
  }
}
