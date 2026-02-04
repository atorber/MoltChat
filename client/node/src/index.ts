/**
 * MChat Node 客户端 SDK 入口
 */

export { MChatClient } from './client';
export {
  sendPrivateMessage,
  sendGroupMessage,
  getOrgTree,
  getStorageConfig,
  getAgentCapabilityList,
} from './api';
export type {
  MChatClientOptions,
  ApiResponse,
  InboxMessage,
  GroupMessage,
} from './types';
