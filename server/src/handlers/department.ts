/**
 * department.create / department.update / department.delete / department.get / department.list
 */

import type { Pool } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';

export async function handleDepartmentGet(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const department_id = typeof ctx.payload.department_id === 'string' ? ctx.payload.department_id : null;
  if (!department_id) return { code: Code.BAD_REQUEST, message: 'Missing department_id' };

  const [rows] = await deps.pool.execute(
    'SELECT department_id, name, parent_id, sort_order, created_at, updated_at FROM department WHERE department_id = ? LIMIT 1',
    [department_id]
  );
  const list = rows as { department_id: string; name: string; parent_id: string | null; sort_order: number; created_at: Date; updated_at: Date }[];
  if (list.length === 0) return { code: Code.NOT_FOUND, message: 'Department not found' };

  const d = list[0];
  return {
    code: Code.OK,
    message: 'ok',
    data: {
      department_id: d.department_id,
      name: d.name,
      parent_id: d.parent_id,
      sort_order: d.sort_order,
      created_at: d.created_at instanceof Date ? d.created_at.toISOString() : d.created_at,
      updated_at: d.updated_at instanceof Date ? d.updated_at.toISOString() : d.updated_at,
    },
  };
}

export async function handleDepartmentList(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const parent_id = ctx.payload.parent_id === null || (typeof ctx.payload.parent_id === 'string' && ctx.payload.parent_id === '') ? null : typeof ctx.payload.parent_id === 'string' ? ctx.payload.parent_id : undefined;

  let sql = 'SELECT department_id, name, parent_id, sort_order, created_at, updated_at FROM department';
  let params: (string | null)[] = [];
  if (parent_id !== undefined) {
    if (parent_id === null) {
      sql += ' WHERE parent_id IS NULL';
    } else {
      sql += ' WHERE parent_id = ?';
      params = [parent_id];
    }
  }
  sql += ' ORDER BY sort_order, department_id';

  const [rows] = params.length > 0 ? await deps.pool.execute(sql, params) : await deps.pool.execute(sql);
  const list = rows as { department_id: string; name: string; parent_id: string | null; sort_order: number; created_at: Date; updated_at: Date }[];
  const departments = list.map((d) => ({
    department_id: d.department_id,
    name: d.name,
    parent_id: d.parent_id,
    sort_order: d.sort_order,
    created_at: d.created_at instanceof Date ? d.created_at.toISOString() : d.created_at,
    updated_at: d.updated_at instanceof Date ? d.updated_at.toISOString() : d.updated_at,
  }));

  return { code: Code.OK, message: 'ok', data: { departments } };
}

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

  const pool = deps.pool;
  const [childDept] = await pool.execute('SELECT 1 FROM department WHERE parent_id = ? LIMIT 1', [department_id]);
  if (Array.isArray(childDept) && childDept.length > 0) {
    return { code: Code.BAD_REQUEST, message: 'Cannot delete department with child departments; move or delete children first' };
  }
  const [empRows] = await pool.execute('SELECT 1 FROM employee WHERE department_id = ? AND status = ? LIMIT 1', [department_id, 'active']);
  const empList = empRows as { '1': number }[];
  if (empList.length > 0) {
    return { code: Code.BAD_REQUEST, message: 'Cannot delete department with active employees; reassign or disable them first' };
  }

  await pool.execute('DELETE FROM department WHERE department_id = ?', [department_id]);
  return { code: Code.OK, message: 'ok', data: { department_id, deleted_at: new Date().toISOString() } };
}
