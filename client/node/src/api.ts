/**
 * 便捷 API：基于 request 封装的常用方法
 */

import type { MChatClient } from './client';
import type { ApiResponse } from './types';

export async function sendPrivateMessage(
  client: MChatClient,
  toEmployeeId: string,
  content: string | Record<string, unknown>,
  quoteMsgId?: string
): Promise<ApiResponse<{ msg_id: string; to_employee_id: string; sent_at: string }>> {
  const params: Record<string, unknown> = { to_employee_id: toEmployeeId, content };
  if (quoteMsgId) params.quote_msg_id = quoteMsgId;
  return client.request('msg.send_private', params);
}

export async function sendGroupMessage(
  client: MChatClient,
  groupId: string,
  content: string | Record<string, unknown>,
  quoteMsgId?: string
): Promise<ApiResponse<{ msg_id: string; group_id: string; sent_at: string }>> {
  const params: Record<string, unknown> = { group_id: groupId, content };
  if (quoteMsgId) params.quote_msg_id = quoteMsgId;
  return client.request('msg.send_group', params);
}

export async function getOrgTree(
  client: MChatClient
): Promise<
  ApiResponse<{
    departments: Array<{ department_id: string; name: string; parent_id: string | null; sort_order: number }>;
    employees: Array<{
      employee_id: string;
      name: string;
      department_id: string | null;
      manager_id: string | null;
      is_ai_agent: boolean;
    }>;
  }>
> {
  return client.request('org.tree');
}

export async function getStorageConfig(
  client: MChatClient
): Promise<
  ApiResponse<{
    endpoint: string;
    bucket: string;
    region: string;
    access_key?: string;
    secret_key?: string;
    expires_at?: string;
  }>
> {
  return client.request('config.storage');
}

export async function getAgentCapabilityList(
  client: MChatClient,
  skill?: string
): Promise<
  ApiResponse<{
    skill: string | null;
    agent_ids: string[];
    agent_profiles: unknown[];
  }>
> {
  return client.request('agent.capability_list', skill ? { skill } : {});
}
