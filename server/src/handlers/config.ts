/**
 * config.storage：返回统一配置中的对象存储信息（或临时凭证）
 * MVP：直接返回配置中的 endpoint/bucket/region/accessKey/secretKey 与过期时间
 */

import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';

const EXPIRES_SEC = 3600;

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
