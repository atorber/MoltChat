/**
 * config.storage：返回统一配置中的对象存储信息（或临时凭证）
 * config.server：返回服务端配置概览（仅展示用，不含密码等敏感信息）
 */

import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';

const EXPIRES_SEC = 3600;

/** 管理端展示用：仅返回可公开的配置项，不含密码、密钥等 */
export async function handleConfigServer(_ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const { broker, mysql, storage } = deps.config;
  return {
    code: Code.OK,
    message: 'ok',
    data: {
      broker: {
        host: broker.host,
        port: broker.port,
        use_tls: broker.useTls,
        client_id: broker.clientId,
      },
      mysql: {
        host: mysql.host,
        port: mysql.port,
        database: mysql.database,
      },
      storage: {
        endpoint: storage.endpoint,
        region: storage.region,
        bucket: storage.bucket,
      },
    },
  };
}

export async function handleConfigStorage(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const s = deps.config.storage;
  const expires_at = new Date(Date.now() + EXPIRES_SEC * 1000);
  return {
    code: Code.OK,
    message: 'ok',
    data: {
      endpoint: s.endpoint,
      bucket: s.bucket,
      region: s.region,
      access_key: s.accessKey,
      secret_key: s.secretKey,
      expires_at: expires_at.toISOString(),
    },
  };
}
