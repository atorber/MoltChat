/**
 * employee.create / employee.update / employee.get / employee.delete / employee.list
 */

import type { Pool } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';
import type { AppConfig } from '../types';

export async function handleEmployeeGet(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const employee_id = typeof ctx.payload.employee_id === 'string' ? ctx.payload.employee_id : null;
  if (!employee_id) return { code: Code.BAD_REQUEST, message: 'Missing employee_id' };

  const pool = deps.pool;
  const [rows] = await pool.execute(
    `SELECT employee_id, name, department_id, manager_id, is_ai_agent, agent_profile, skills_badge, status, created_at, updated_at
     FROM employee WHERE employee_id = ? LIMIT 1`,
    [employee_id]
  );
  const list = rows as { employee_id: string; name: string; department_id: string | null; manager_id: string | null; is_ai_agent: number; agent_profile: string | null; skills_badge: string | null; status: string; created_at: Date; updated_at: Date }[];
  if (list.length === 0) return { code: Code.NOT_FOUND, message: 'Employee not found' };

  const r = list[0];
  return {
    code: Code.OK,
    message: 'ok',
    data: {
      employee_id: r.employee_id,
      name: r.name,
      department_id: r.department_id,
      manager_id: r.manager_id,
      is_ai_agent: Boolean(r.is_ai_agent),
      agent_profile: r.agent_profile ? (JSON.parse(r.agent_profile) as unknown) : null,
      skills_badge: r.skills_badge ? (JSON.parse(r.skills_badge) as unknown) : null,
      status: r.status,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
    },
  };
}

export async function handleEmployeeList(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const pool = deps.pool;
  const department_id = typeof ctx.payload.department_id === 'string' ? ctx.payload.department_id : null;
  const include_disabled = Boolean(ctx.payload.include_disabled);

  let sql = `SELECT employee_id, name, department_id, manager_id, is_ai_agent, agent_profile, skills_badge, status, created_at, updated_at FROM employee`;
  const params: (string | number)[] = [];
  const conditions: string[] = [];
  if (!include_disabled) conditions.push('status = ?');
  if (!include_disabled) params.push('active');
  if (department_id != null) {
    conditions.push('department_id = ?');
    params.push(department_id);
  }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY department_id, employee_id';

  const [rows] = await pool.execute(sql, params);
  const list = rows as { employee_id: string; name: string; department_id: string | null; manager_id: string | null; is_ai_agent: number; agent_profile: string | null; skills_badge: string | null; status: string; created_at: Date; updated_at: Date }[];
  const employees = list.map((r) => ({
    employee_id: r.employee_id,
    name: r.name,
    department_id: r.department_id,
    manager_id: r.manager_id,
    is_ai_agent: Boolean(r.is_ai_agent),
    agent_profile: r.agent_profile ? (JSON.parse(r.agent_profile) as unknown) : null,
    skills_badge: r.skills_badge ? (JSON.parse(r.skills_badge) as unknown) : null,
    status: r.status,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
  }));

  return { code: Code.OK, message: 'ok', data: { employees } };
}

export async function handleEmployeeCreate(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const name = typeof ctx.payload.name === 'string' ? ctx.payload.name : '';
  const is_ai_agent = Boolean(ctx.payload.is_ai_agent);
  const department_id = typeof ctx.payload.department_id === 'string' ? ctx.payload.department_id : null;
  const manager_id = typeof ctx.payload.manager_id === 'string' ? ctx.payload.manager_id : null;
  let employee_id = typeof ctx.payload.employee_id === 'string' ? ctx.payload.employee_id : null;

  if (!name) return { code: Code.BAD_REQUEST, message: 'Missing name' };

  const pool = deps.pool;
  if (!employee_id) {
    employee_id = 'emp_' + uuidv4().replace(/-/g, '').slice(0, 12);
  } else {
    const [existing] = await pool.execute('SELECT 1 FROM employee WHERE employee_id = ?', [employee_id]);
    const arr = Array.isArray(existing) ? existing : (existing as unknown as unknown[]);
    if (arr.length > 0) return { code: Code.BAD_REQUEST, message: 'employee_id already exists' };
  }

  const mqtt_password = 'mqtt_' + uuidv4().replace(/-/g, '').slice(0, 16);
  const agent_profile = is_ai_agent && ctx.payload.agent_profile && typeof ctx.payload.agent_profile === 'object'
    ? JSON.stringify(ctx.payload.agent_profile)
    : null;
  const skills_badge = ctx.payload.skills_badge != null ? JSON.stringify(ctx.payload.skills_badge) : null;

  await pool.execute(
    `INSERT INTO employee (employee_id, name, department_id, manager_id, is_ai_agent, agent_profile, skills_badge, mqtt_password, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [employee_id, name, department_id, manager_id, is_ai_agent ? 1 : 0, agent_profile, skills_badge, mqtt_password]
  );

  const created_at = new Date();
  const mqtt_connection = buildMqttConnection(deps.config, employee_id, mqtt_password);

  return {
    code: Code.OK,
    message: 'ok',
    data: { employee_id, name, created_at: created_at.toISOString(), mqtt_connection },
  };
}

export async function handleEmployeeUpdate(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const employee_id = typeof ctx.payload.employee_id === 'string' ? ctx.payload.employee_id : null;
  const updates = ctx.payload.updates && typeof ctx.payload.updates === 'object' ? ctx.payload.updates as Record<string, unknown> : null;
  if (!employee_id || !updates) return { code: Code.BAD_REQUEST, message: 'Missing employee_id or updates' };

  const pool = deps.pool;
  const allowed = ['name', 'department_id', 'manager_id', 'agent_profile', 'skills_badge', 'status'];
  const setParts: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (!allowed.includes(k)) continue;
    if (k === 'agent_profile' || k === 'skills_badge') {
      setParts.push(`${k} = ?`);
      values.push(JSON.stringify(v));
    } else {
      setParts.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (setParts.length === 0) return { code: Code.BAD_REQUEST, message: 'No valid updates' };
  values.push(employee_id);
  await pool.execute(
    `UPDATE employee SET ${setParts.join(', ')}, updated_at = NOW(3) WHERE employee_id = ?`,
    values
  );
  return {
    code: Code.OK,
    message: 'ok',
    data: { employee_id, updated_at: new Date().toISOString() },
  };
}

/** 软删除：将 status 设为 disabled，不删库记录 */
export async function handleEmployeeDelete(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const employee_id = typeof ctx.payload.employee_id === 'string' ? ctx.payload.employee_id : null;
  if (!employee_id) return { code: Code.BAD_REQUEST, message: 'Missing employee_id' };

  const pool = deps.pool;
  const [rows] = await pool.execute('SELECT 1 FROM employee WHERE employee_id = ? LIMIT 1', [employee_id]);
  const list = rows as { '1': number }[];
  if (list.length === 0) return { code: Code.NOT_FOUND, message: 'Employee not found' };

  await pool.execute("UPDATE employee SET status = 'disabled', updated_at = NOW(3) WHERE employee_id = ?", [employee_id]);
  return {
    code: Code.OK,
    message: 'ok',
    data: { employee_id, deleted_at: new Date().toISOString() },
  };
}

function buildMqttConnection(config: AppConfig, employeeId: string, mqttPassword: string): Record<string, unknown> {
  const broker = config.broker;
  return {
    broker_host: broker.host,
    broker_port: broker.port,
    use_tls: broker.useTls,
    mqtt_username: employeeId,
    mqtt_password: mqttPassword,
    client_id_scheme: `${employeeId}_{device_id}_{uuid}`,
  };
}
