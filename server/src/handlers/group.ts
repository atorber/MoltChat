/**
 * group.create / group.dismiss / group.member_add / group.member_remove
 */

import type { Pool } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';

function parseMemberIds(payload: Record<string, unknown>): string[] {
  const v = payload.member_ids;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

export async function handleGroupCreate(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const name = typeof ctx.payload.name === 'string' ? ctx.payload.name : '';
  const member_ids = parseMemberIds(ctx.payload);
  const opts = ctx.payload.opts && typeof ctx.payload.opts === 'object' ? ctx.payload.opts as Record<string, unknown> : {};
  if (!name) return { code: Code.BAD_REQUEST, message: 'Missing name' };

  const group_id = 'grp_' + uuidv4().replace(/-/g, '').slice(0, 12);
  const pool = deps.pool;
  const description = typeof opts.description === 'string' ? opts.description : null;
  const avatar = typeof opts.avatar === 'string' ? opts.avatar : null;

  await pool.execute(
    'INSERT INTO `group` (group_id, name, creator_employee_id, description, avatar) VALUES (?, ?, ?, ?, ?)',
    [group_id, name, ctx.employee_id!, description, avatar]
  );

  const allMembers = [...new Set([ctx.employee_id!, ...member_ids])];
  for (let i = 0; i < allMembers.length; i++) {
    const role = i === 0 ? 'owner' : 'member';
    await pool.execute(
      'INSERT INTO group_member (group_id, employee_id, role) VALUES (?, ?, ?)',
      [group_id, allMembers[i], role]
    );
  }

  const created_at = new Date();
  return {
    code: Code.OK,
    message: 'ok',
    data: { group_id, name, member_ids: allMembers, created_at: created_at.toISOString() },
  };
}

export async function handleGroupDismiss(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const group_id = typeof ctx.payload.group_id === 'string' ? ctx.payload.group_id : null;
  if (!group_id) return { code: Code.BAD_REQUEST, message: 'Missing group_id' };

  const pool = deps.pool;
  const [rows] = await pool.execute('SELECT creator_employee_id FROM `group` WHERE group_id = ?', [group_id]);
  const list = rows as { creator_employee_id: string }[];
  if (!list[0]) return { code: Code.NOT_FOUND, message: 'Group not found' };
  if (list[0].creator_employee_id !== ctx.employee_id) {
    return { code: Code.FORBIDDEN, message: 'Only creator can dismiss' };
  }

  await pool.execute('DELETE FROM group_member WHERE group_id = ?', [group_id]);
  await pool.execute('DELETE FROM `group` WHERE group_id = ?', [group_id]);

  return {
    code: Code.OK,
    message: 'ok',
    data: { group_id, dismissed_at: new Date().toISOString() },
  };
}

export async function handleGroupMemberAdd(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const group_id = typeof ctx.payload.group_id === 'string' ? ctx.payload.group_id : null;
  const member_ids = parseMemberIds(ctx.payload);
  if (!group_id || member_ids.length === 0) return { code: Code.BAD_REQUEST, message: 'Missing group_id or member_ids' };

  const pool = deps.pool;
  const [rows] = await pool.execute(
    'SELECT group_id FROM group_member WHERE group_id = ? AND employee_id = ?',
    [group_id, ctx.employee_id]
  );
  const list = rows as { group_id: string }[];
  if (list.length === 0) return { code: Code.FORBIDDEN, message: 'Not a member' };

  const added: string[] = [];
  for (const eid of member_ids) {
    const [ex] = await pool.execute('SELECT 1 FROM group_member WHERE group_id = ? AND employee_id = ?', [group_id, eid]);
    if ((ex as unknown[]).length > 0) continue;
    await pool.execute(
      'INSERT INTO group_member (group_id, employee_id, role) VALUES (?, ?, ?)',
      [group_id, eid, 'member']
    );
    added.push(eid);
  }
  const [countRows] = await pool.execute('SELECT COUNT(*) as c FROM group_member WHERE group_id = ?', [group_id]);
  const count = (countRows as { c: number }[])[0]?.c ?? 0;

  return {
    code: Code.OK,
    message: 'ok',
    data: { group_id, added_ids: added, current_member_count: count },
  };
}

export async function handleGroupMemberRemove(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const group_id = typeof ctx.payload.group_id === 'string' ? ctx.payload.group_id : null;
  const member_ids = parseMemberIds(ctx.payload);
  if (!group_id || member_ids.length === 0) return { code: Code.BAD_REQUEST, message: 'Missing group_id or member_ids' };

  const pool = deps.pool;
  const [creatorRows] = await pool.execute('SELECT creator_employee_id FROM `group` WHERE group_id = ?', [group_id]);
  const creator = (creatorRows as { creator_employee_id: string }[])[0]?.creator_employee_id;
  if (!creator) return { code: Code.NOT_FOUND, message: 'Group not found' };

  for (const eid of member_ids) {
    if (eid === creator) continue;
    await pool.execute('DELETE FROM group_member WHERE group_id = ? AND employee_id = ?', [group_id, eid]);
  }

  const [countRows] = await pool.execute('SELECT COUNT(*) as c FROM group_member WHERE group_id = ?', [group_id]);
  const count = (countRows as { c: number }[])[0]?.c ?? 0;

  return { code: Code.OK, message: 'ok', data: { group_id, current_member_count: count } };
}

/** 群组列表（管理端）：当前员工加入的群组，或传 all=true 时返回全部（管理用） */
export async function handleGroupList(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const pool = deps.pool;
  const all = ctx.payload.all === true;
  let groups: { group_id: string; name: string; creator_employee_id: string; member_count: number; created_at: string }[];

  if (all) {
    const [rows] = await pool.execute(
      `SELECT g.group_id, g.name, g.creator_employee_id, g.created_at,
        (SELECT COUNT(*) FROM group_member m WHERE m.group_id = g.group_id) AS member_count
       FROM \`group\` g ORDER BY g.created_at DESC`
    );
    const list = rows as { group_id: string; name: string; creator_employee_id: string; created_at: Date; member_count: number }[];
    groups = list.map((r) => ({
      group_id: r.group_id,
      name: r.name,
      creator_employee_id: r.creator_employee_id,
      member_count: Number(r.member_count),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  } else {
    const [rows] = await pool.execute(
      `SELECT g.group_id, g.name, g.creator_employee_id, g.created_at,
        (SELECT COUNT(*) FROM group_member m WHERE m.group_id = g.group_id) AS member_count
       FROM \`group\` g
       INNER JOIN group_member gm ON g.group_id = gm.group_id AND gm.employee_id = ?
       ORDER BY g.created_at DESC`,
      [ctx.employee_id!]
    );
    const list = rows as { group_id: string; name: string; creator_employee_id: string; created_at: Date; member_count: number }[];
    groups = list.map((r) => ({
      group_id: r.group_id,
      name: r.name,
      creator_employee_id: r.creator_employee_id,
      member_count: Number(r.member_count),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }
  return { code: 0, message: 'ok', data: { groups } };
}
