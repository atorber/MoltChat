/**
 * org.tree
 */

import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';

export async function handleOrgTree(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const pool = deps.pool;
  const [deptRows] = await pool.execute(
    'SELECT department_id, name, parent_id, sort_order FROM department ORDER BY sort_order, department_id'
  );
  const departments = (deptRows as { department_id: string; name: string; parent_id: string | null; sort_order: number }[]).map(
    (d) => ({ department_id: d.department_id, name: d.name, parent_id: d.parent_id, sort_order: d.sort_order })
  );

  const [empRows] = await pool.execute(
    'SELECT employee_id, name, department_id, manager_id, is_ai_agent, skills_badge FROM employee WHERE status = ?',
    ['active']
  );
  const employees = (empRows as { employee_id: string; name: string; department_id: string | null; manager_id: string | null; is_ai_agent: number; skills_badge: string | null }[]).map(
    (r) => ({
      employee_id: r.employee_id,
      name: r.name,
      department_id: r.department_id,
      manager_id: r.manager_id,
      is_ai_agent: Boolean(r.is_ai_agent),
      skills_badge: r.skills_badge ? (JSON.parse(r.skills_badge) as unknown) : null,
    })
  );

  return {
    code: Code.OK,
    message: 'ok',
    data: {
      departments: departments.map((d) => ({
        department_id: d.department_id,
        name: d.name,
        parent_id: d.parent_id,
        sort_order: d.sort_order,
      })),
      employees,
    },
  };
}
