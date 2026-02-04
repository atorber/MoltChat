/**
 * department.create / department.update / department.delete
 */

import type { Pool } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';

export async function handleDepartmentCreate(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const name = typeof ctx.payload.name === 'string' ? ctx.payload.name : '';
  const parent_id = typeof ctx.payload.parent_id === 'string' ? ctx.payload.parent_id : null;
  const sort_order = typeof ctx.payload.sort_order === 'number' ? ctx.payload.sort_order : 0;
  if (!name) return { code: Code.BAD_REQUEST, message: 'Missing name' };

  const department_id = 'dept_' + uuidv4().replace(/-/g, '').slice(0, 8);
  await deps.pool.execute(
    'INSERT INTO department (department_id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)',
    [department_id, name, parent_id, sort_order]
  );
  return {
    code: Code.OK,
    message: 'ok',
    data: { department_id, name, parent_id, sort_order, created_at: new Date().toISOString() },
  };
}

export async function handleDepartmentUpdate(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const department_id = typeof ctx.payload.department_id === 'string' ? ctx.payload.department_id : null;
  const updates = ctx.payload.updates && typeof ctx.payload.updates === 'object' ? ctx.payload.updates as Record<string, unknown> : null;
  if (!department_id || !updates) return { code: Code.BAD_REQUEST, message: 'Missing department_id or updates' };

  const allowed = ['name', 'parent_id', 'sort_order'];
  const setParts: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (!allowed.includes(k)) continue;
    setParts.push(`${k} = ?`);
    values.push(v);
  }
  if (setParts.length === 0) return { code: Code.BAD_REQUEST, message: 'No valid updates' };
  values.push(department_id);
  await deps.pool.execute(
    `UPDATE department SET ${setParts.join(', ')}, updated_at = NOW(3) WHERE department_id = ?`,
    values
  );
  return { code: Code.OK, message: 'ok', data: { department_id, updated_at: new Date().toISOString() } };
}

export async function handleDepartmentDelete(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const department_id = typeof ctx.payload.department_id === 'string' ? ctx.payload.department_id : null;
  if (!department_id) return { code: Code.BAD_REQUEST, message: 'Missing department_id' };
  await deps.pool.execute('DELETE FROM department WHERE department_id = ?', [department_id]);
  return { code: Code.OK, message: 'ok', data: { department_id, deleted_at: new Date().toISOString() } };
}
