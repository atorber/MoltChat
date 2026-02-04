/**
 * auth.bind / auth.challenge
 */

import { v4 as uuidv4 } from 'uuid';
import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';
import { upsertClientSession } from '../db/session';

export async function handleAuthBind(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const employee_id = typeof ctx.payload.employee_id === 'string' ? ctx.payload.employee_id : null;
  if (!employee_id) {
    return { code: Code.BAD_REQUEST, message: 'Missing employee_id' };
  }
  const pool = deps.pool;
  const [rows] = await pool.execute('SELECT employee_id FROM employee WHERE employee_id = ? AND status = ? LIMIT 1', [
    employee_id,
    'active',
  ]);
  const list = rows as { employee_id: string }[];
  if (!list[0]) {
    return { code: Code.NOT_FOUND, message: 'Employee not found or disabled' };
  }
  const device_info = typeof ctx.payload.device_info === 'string' ? ctx.payload.device_info : undefined;
  await upsertClientSession(pool, ctx.client_id, employee_id, device_info);
  return { code: Code.OK, message: 'ok', data: {} };
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min

function hashToken(token: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function handleAuthChallenge(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const pool = deps.pool;
  const challenge_id = 'ch_' + uuidv4().replace(/-/g, '').slice(0, 16);
  const token = uuidv4() + '-' + Date.now();
  const expires_at = new Date(Date.now() + CHALLENGE_TTL_MS);
  await pool.execute(
    'INSERT INTO challenge (challenge_id, token_hash, employee_id, expires_at) VALUES (?, ?, ?, ?)',
    [challenge_id, hashToken(token), ctx.employee_id!, expires_at]
  );
  return {
    code: Code.OK,
    message: 'ok',
    data: { challenge_id, token, expires_at: expires_at.toISOString() },
  };
}
