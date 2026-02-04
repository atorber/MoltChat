import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { mqttApi } from '../mqtt/api';

interface MqttContextValue {
  connected: boolean;
  employeeId: string | null;
  connect: (wsUrl: string, username: string, password: string, employeeId: string, clientIdOverride?: string) => Promise<void>;
  disconnect: () => void;
  request: <T = unknown>(action: string, params?: Record<string, unknown>) => Promise<{ code: number; message: string; data?: T }>;
}

const stubConnect = async () => {
  throw new Error('MqttProvider 未就绪，请刷新页面后重试');
};
const stubRequest = async () => {
  throw new Error('MqttProvider 未就绪，请刷新页面后重试');
};
const defaultMqttValue: MqttContextValue = {
  connected: false,
  employeeId: null,
  connect: stubConnect,
  disconnect: () => {},
  request: stubRequest,
};

const MqttContext = createContext<MqttContextValue>(defaultMqttValue);

export function MqttProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const connect = useCallback(async (wsUrl: string, username: string, password: string, empId: string, clientIdOverride?: string) => {
    await mqttApi.connect(wsUrl, username, password, clientIdOverride);
    const r = await mqttApi.request('auth.bind', { employee_id: empId });
    if (r.code !== 0) throw new Error(r.message || 'auth.bind failed');
    setEmployeeId(empId);
    setConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    mqttApi.disconnect();
    setConnected(false);
    setEmployeeId(null);
  }, []);

  const request = useCallback(<T,>(action: string, params?: Record<string, unknown>) => {
    return mqttApi.request<T>(action, params);
  }, []);

  return (
    <MqttContext.Provider value={{ connected, employeeId, connect, disconnect, request }}>
      {children}
    </MqttContext.Provider>
  );
}

export function useMqtt(): MqttContextValue {
  return useContext(MqttContext);
}
