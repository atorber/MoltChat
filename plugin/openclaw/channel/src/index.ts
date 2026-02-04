/**
 * openclaw-channel-mchat
 * OpenClaw 渠道插件：将 MoltChat 作为聊天渠道接入 OpenClaw
 */

import { createMChatChannel } from './provider';
import type { MChatChannelConfig, MChatChannelProvider, MChatInboundMessage, MChatSendParams } from './types';
import { CHANNEL_ID } from './types';

export { createMChatChannel, CHANNEL_ID };
export type { MChatChannelConfig, MChatChannelProvider, MChatInboundMessage, MChatSendParams };

/** 当前运行中的渠道实例，由 gateway.start 创建、gateway.stop 清除 */
let currentProvider: MChatChannelProvider | null = null;

/** OpenClaw 渠道插件描述（config 在 channels.mchat 下） */
const mchatChannelPlugin = {
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: 'MoltChat',
    selectionLabel: 'MoltChat (MQTT)',
    docsPath: '/channels/mchat',
    blurb: 'MoltChat 企业 IM 渠道，基于 MQTT，支持单聊与群聊',
    aliases: ['mchat'],
  },
  capabilities: {
    chatTypes: ['direct', 'group'] as const,
  },
  config: {
    listAccountIds: (cfg: { channels?: { mchat?: unknown } }) =>
      cfg.channels?.mchat != null ? ['default'] : [],
    resolveAccount: (cfg: { channels?: { mchat?: MChatChannelConfig } }, accountId?: string) =>
      cfg.channels?.mchat ?? {},
  },
  outbound: {
    deliveryMode: 'direct' as const,
    sendText: async (params: { text: string; thread?: string; channel?: string }) => {
      const provider = currentProvider;
      if (!provider?.connected) throw new Error('MoltChat channel not connected');
      const thread = params.thread ?? '';
      await provider.send({ thread, content: params.text });
      return { ok: true };
    },
  },
  gateway: {
    start: async (ctx: { config?: { channels?: { mchat?: MChatChannelConfig } }; emitChat?: (ev: unknown) => void }) => {
      const config = ctx.config?.channels?.mchat;
      if (!config || config.enabled === false) return;
      const provider = createMChatChannel(config);
      provider.onInbound((msg) => {
        try {
          const emit = (ctx as { emitChat?: (ev: unknown) => void }).emitChat;
          if (typeof emit === 'function') emit(msg);
        } catch (e) {
          console.error('[openclaw-channel-mchat] emitChat error:', e);
        }
      });
      await provider.start();
      currentProvider = provider;
    },
    stop: async () => {
      if (currentProvider) {
        await currentProvider.stop();
        currentProvider = null;
      }
    },
  },
};

/** OpenClaw 插件入口：default 导出带 register 的对象（与 Matrix/Line 一致） */
const plugin = {
  id: CHANNEL_ID,
  name: 'MoltChat',
  description: 'MoltChat channel plugin (MQTT-based enterprise IM)',
  register(api: { registerChannel: (arg: { plugin: typeof mchatChannelPlugin }) => void }): void {
    api.registerChannel({ plugin: mchatChannelPlugin });
  },
};

export default plugin;
