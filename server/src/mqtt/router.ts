/**
 * 请求路由：鉴权（client_id -> employee_id），按 action 分发到对应 handler
 */

import type { MqttClient } from 'mqtt';
import type { AppConfig, ReqContext, RespPayload } from '../types';
import { Code } from '../types';
import { getPool } from '../db/pool';
import { getEmployeeIdByClientId } from '../db/session';
import { handleAuthBind } from '../handlers/auth';
import { handleEmployeeCreate, handleEmployeeUpdate } from '../handlers/employee';
import { handleOrgTree } from '../handlers/org';
import { handleGroupCreate, handleGroupDismiss, handleGroupMemberAdd, handleGroupMemberRemove, handleGroupList } from '../handlers/group';
import { handleMsgSendPrivate, handleMsgSendGroup, handleMsgReadAck } from '../handlers/msg';
import { handleConfigStorage } from '../handlers/config';
import { handleAgentCapabilityList } from '../handlers/agent';
import { handleDepartmentCreate, handleDepartmentUpdate, handleDepartmentDelete } from '../handlers/department';
import { handleFileUploadUrl, handleFileDownloadUrl } from '../handlers/file';
import { handleAuthChallenge } from '../handlers/auth';

const NO_AUTH_ACTIONS = new Set(['auth.bind']);

export interface Deps {
  pool: ReturnType<typeof getPool>;
  config: AppConfig;
  mqttClient: MqttClient;
}

export async function routeRequest(
  config: AppConfig,
  mqttClient: MqttClient,
  client_id: string,
  seq_id: string,
  action: string,
  payload: Record<string, unknown>
): Promise<RespPayload> {
  const pool = getPool(config.mysql);
  const deps: Deps = { pool, config, mqttClient };

  const employee_id = await getEmployeeIdByClientId(pool, client_id);
  const ctx: ReqContext = { client_id, seq_id, action, payload, employee_id: employee_id ?? undefined };

  if (!NO_AUTH_ACTIONS.has(action) && !employee_id) {
    return { code: Code.UNAUTHORIZED, message: 'Unauthorized' };
  }

  const handler = getHandler(action);
  if (!handler) {
    return { code: Code.BAD_REQUEST, message: `Unknown action: ${action}` };
  }

  return handler(ctx, deps);
}

function getHandler(action: string): ((ctx: ReqContext, deps: Deps) => Promise<RespPayload>) | null {
  const map: Record<string, (ctx: ReqContext, deps: Deps) => Promise<RespPayload>> = {
    'auth.bind': handleAuthBind,
    'auth.challenge': handleAuthChallenge,
    'employee.create': handleEmployeeCreate,
    'employee.update': handleEmployeeUpdate,
    'org.tree': handleOrgTree,
    'department.create': handleDepartmentCreate,
    'department.update': handleDepartmentUpdate,
    'department.delete': handleDepartmentDelete,
    'group.create': handleGroupCreate,
    'group.list': handleGroupList,
    'group.dismiss': handleGroupDismiss,
    'group.member_add': handleGroupMemberAdd,
    'group.member_remove': handleGroupMemberRemove,
    'msg.send_private': handleMsgSendPrivate,
    'msg.send_group': handleMsgSendGroup,
    'msg.read_ack': handleMsgReadAck,
    'config.storage': handleConfigStorage,
    'agent.capability_list': handleAgentCapabilityList,
    'file.upload_url': handleFileUploadUrl,
    'file.download_url': handleFileDownloadUrl,
  };
  return map[action] ?? null;
}
