/**
 * msg.send_private / msg.send_group / msg.read_ack
 * 消息不落库，仅实时中继
 */

import { v4 as uuidv4 } from 'uuid';
import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';

function msgId(): string {
  return 'msg_' + uuidv4().replace(/-/g, '').slice(0, 12);
}

function isoNow(): string {
  return new Date().toISOString();
}

export async function handleMsgSendPrivate(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const to_employee_id = typeof ctx.payload.to_employee_id === 'string' ? ctx.payload.to_employee_id : null;
  const content = ctx.payload.content;
  if (!to_employee_id) return { code: Code.BAD_REQUEST, message: 'Missing to_employee_id' };

  const pool = deps.pool;
  const [rows] = await pool.execute('SELECT 1 FROM employee WHERE employee_id = ? AND status = ?', [to_employee_id, 'active']);
  const list = rows as { '1': number }[];
  if (list.length === 0) return { code: Code.NOT_FOUND, message: 'Target employee not found' };

  const msg_id = msgId();
  const sent_at = isoNow();
  const topic = `mchat/inbox/${to_employee_id}`;
  const payload = JSON.stringify({
    msg_id,
    type: 'private',
    from_employee_id: ctx.employee_id,
    content: content ?? '',
    sent_at,
    quote_msg_id: ctx.payload.quote_msg_id ?? undefined,
  });
  await new Promise<void>((resolve, reject) => {
    deps.mqttClient.publish(topic, payload, { qos: 1 }, (err) => (err ? reject(err) : resolve()));
  });

  return {
    code: Code.OK,
    message: 'ok',
    data: { msg_id, to_employee_id, sent_at },
  };
}

export async function handleMsgSendGroup(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const group_id = typeof ctx.payload.group_id === 'string' ? ctx.payload.group_id : null;
  const content = ctx.payload.content;
  if (!group_id) return { code: Code.BAD_REQUEST, message: 'Missing group_id' };

  const pool = deps.pool;
  const [rows] = await pool.execute(
    'SELECT 1 FROM group_member WHERE group_id = ? AND employee_id = ?',
    [group_id, ctx.employee_id!]
  );
  const list = rows as { '1': number }[];
  if (list.length === 0) return { code: Code.FORBIDDEN, message: 'Not a group member' };

  const msg_id = msgId();
  const sent_at = isoNow();
  const topic = `mchat/group/${group_id}`;
  const payload = JSON.stringify({
    msg_id,
    group_id,
    from_employee_id: ctx.employee_id,
    content: content ?? '',
    sent_at,
    quote_msg_id: ctx.payload.quote_msg_id ?? undefined,
  });
  await new Promise<void>((resolve, reject) => {
    deps.mqttClient.publish(topic, payload, { qos: 1 }, (err) => (err ? reject(err) : resolve()));
  });

  return {
    code: Code.OK,
    message: 'ok',
    data: { msg_id, group_id, sent_at },
  };
}

export async function handleMsgReadAck(ctx: ReqContext, _deps: Deps): Promise<RespPayload> {
  const msg_id = typeof ctx.payload.msg_id === 'string' ? ctx.payload.msg_id : null;
  if (!msg_id) return { code: Code.BAD_REQUEST, message: 'Missing msg_id' };
  // 可选：落库已读状态或转发；此处仅响应成功
  return { code: Code.OK, message: 'ok', data: {} };
}
