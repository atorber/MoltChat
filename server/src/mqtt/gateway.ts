/**
 * MQTT 网关：连接 Broker，订阅 mchat/msg/req/+/+，解析 topic/payload 后交给 router 处理并发布响应
 */

import mqtt, { type MqttClient } from 'mqtt';
import type { AppConfig } from '../types';
import { routeRequest } from './router';

const REQ_TOPIC_PREFIX = 'mchat/msg/req/';
const RESP_TOPIC_PREFIX = 'mchat/msg/resp/';

export function createGateway(config: AppConfig): MqttClient {
  const { broker } = config;
  const protocol = broker.useTls ? 'mqtts' : 'mqtt';
  const url = `${protocol}://${broker.host}:${broker.port}`;

  const subscribeTopic = broker.shareSubscription
    ? `$share/${broker.shareSubscription}/mchat/msg/req/+/+`
    : 'mchat/msg/req/+/+';

  const client = mqtt.connect(url, {
    clientId: broker.clientId,
    username: broker.username || undefined,
    password: broker.password || undefined,
    clean: false,
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    client.subscribe(subscribeTopic, { qos: 1 }, (err) => {
      if (err) {
        console.error('[gateway] subscribe failed', err);
        return;
      }
      console.log('[gateway] subscribed to', subscribeTopic);
    });
  });

  client.on('message', async (topic: string, payload: Buffer) => {
    const start = Date.now();
    let code = 500;
    let client_id = '';
    let seq_id = '';
    let action = '';
    try {
      if (!topic.startsWith(REQ_TOPIC_PREFIX)) return;
      const rest = topic.slice(REQ_TOPIC_PREFIX.length);
      const parts = rest.split('/');
      client_id = parts[0];
      seq_id = parts[1];
      if (!client_id || !seq_id) return;

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(payload.toString('utf8')) as Record<string, unknown>;
      } catch {
        await publishResponse(client, client_id, seq_id, 400, 'Invalid JSON', undefined);
        return;
      }

      action = typeof body.action === 'string' ? body.action : '';
      if (!action) {
        await publishResponse(client, client_id, seq_id, 400, 'Missing action', undefined);
        return;
      }

      const result = await routeRequest(config, client, client_id, seq_id, action, body);
      code = result.code;
      await publishResponse(client, client_id, seq_id, result.code, result.message, result.data);
    } catch (err) {
      console.error('[gateway] handle error', err);
      if (client_id && seq_id) {
        await publishResponse(client, client_id, seq_id, 500, 'Server error', undefined);
      }
    } finally {
      console.log('[gateway]', { client_id, seq_id, action: action || '-', code, latency_ms: Date.now() - start });
    }
  });

  client.on('error', (err) => console.error('[gateway] mqtt error', err));

  return client;
}

export function respTopic(clientId: string, seqId: string): string {
  return `${RESP_TOPIC_PREFIX}${clientId}/${seqId}`;
}

export async function publishResponse(
  client: MqttClient,
  clientId: string,
  seqId: string,
  code: number,
  message: string,
  data?: unknown
): Promise<void> {
  const topic = respTopic(clientId, seqId);
  const payload = JSON.stringify({ code, message, data: data ?? {} });
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1 }, (err) => (err ? reject(err) : resolve()));
  });
}
