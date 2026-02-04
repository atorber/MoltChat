/**
 * file.upload_url / file.download_url
 * MVP：基于统一配置生成预签名 URL（需 S3 兼容 API）。此处返回占位或简单 URL 结构，实际可接 @aws-sdk/client-s3 getSignedUrl
 */

import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';

const PRESIGN_EXPIRES = 3600;

export async function handleFileUploadUrl(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const key = typeof ctx.payload.key === 'string' ? ctx.payload.key : `upload/${ctx.employee_id}/${Date.now()}`;
  const s = deps.config.storage;
  const expires_at = new Date(Date.now() + PRESIGN_EXPIRES * 1000);
  // 实际实现可调用 s3.getSignedUrl('putObject', { Bucket, Key, Expires })
  const url = `${s.endpoint}/${s.bucket}/${key}?expires=${Math.floor(expires_at.getTime() / 1000)}`;
  return {
    code: Code.OK,
    message: 'ok',
    data: { url, key, expires_at: expires_at.toISOString() },
  };
}

export async function handleFileDownloadUrl(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const key = typeof ctx.payload.key === 'string' ? ctx.payload.key : null;
  if (!key) return { code: Code.BAD_REQUEST, message: 'Missing key' };
  const s = deps.config.storage;
  const expires_at = new Date(Date.now() + PRESIGN_EXPIRES * 1000);
  const url = `${s.endpoint}/${s.bucket}/${key}?expires=${Math.floor(expires_at.getTime() / 1000)}`;
  return {
    code: Code.OK,
    message: 'ok',
    data: { url, key, expires_at: expires_at.toISOString() },
  };
}
