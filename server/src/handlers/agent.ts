/**
 * agent.capability_list
 */

import type { ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import type { Deps } from '../mqtt/router';

export async function handleAgentCapabilityList(ctx: ReqContext, deps: Deps): Promise<RespPayload> {
  const skill = typeof ctx.payload.skill === 'string' ? ctx.payload.skill : null;
  const pool = deps.pool;

  const [rows] = await pool.execute(
    'SELECT employee_id, name, agent_profile, skills_badge FROM employee WHERE is_ai_agent = 1 AND status = ?',
    ['active']
  );

  let list = rows as { employee_id: string; name: string; agent_profile: string | null; skills_badge: string | null }[];
  if (skill) {
    list = list.filter((r) => {
      if (!r.agent_profile) return false;
      try {
        const profile = JSON.parse(r.agent_profile) as { capabilities?: string[] };
        const caps = profile.capabilities;
        return Array.isArray(caps) && caps.some((c) => c.includes(skill) || skill.includes(c));
      } catch {
        return false;
      }
    });
  }

  const agent_ids = list.map((r) => r.employee_id);
  const agent_profiles = list.map((r) => ({
    employee_id: r.employee_id,
    name: r.name,
    agent_profile: r.agent_profile ? (JSON.parse(r.agent_profile) as Record<string, unknown>) : null,
    skills_badge: r.skills_badge ? (JSON.parse(r.skills_badge) as string[]) : null,
  }));

  return {
    code: Code.OK,
    message: 'ok',
    data: { skill: skill ?? null, agent_ids, agent_profiles },
  };
}
