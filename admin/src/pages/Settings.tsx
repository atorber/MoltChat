import { useEffect, useState } from 'react';
import { useMqtt } from '../context/MqttContext';

interface ServerConfig {
  broker: { host: string; port: number; use_tls: boolean; client_id: string };
  mysql: { host: string; port: number; database: string };
  storage: { endpoint: string; region: string; bucket: string };
}

export default function Settings() {
  const { request } = useMqtt();
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    request<ServerConfig>('config.server')
      .then((res) => {
        if (res.code === 0 && res.data && !cancelled) setConfig(res.data);
        else if (!cancelled) setError(res.message || '获取失败');
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [request]);

  if (loading) return <div className="card">加载中…</div>;
  if (error) return <div className="card"><span className="error">{error}</span></div>;
  if (!config) return <div className="card">暂无配置信息</div>;

  return (
    <div className="card">
      <h2>设置</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
        当前服务端配置概览（仅展示非敏感信息，不含密码与密钥）
      </p>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>MQTT Broker</h3>
        <table>
          <tbody>
            <tr><td style={{ width: 120, color: '#64748b' }}>主机</td><td><code>{config.broker.host}</code></td></tr>
            <tr><td style={{ color: '#64748b' }}>端口</td><td>{config.broker.port}</td></tr>
            <tr><td style={{ color: '#64748b' }}>TLS</td><td>{config.broker.use_tls ? '是' : '否'}</td></tr>
            <tr><td style={{ color: '#64748b' }}>Client ID</td><td><code>{config.broker.client_id}</code></td></tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>MySQL</h3>
        <table>
          <tbody>
            <tr><td style={{ width: 120, color: '#64748b' }}>主机</td><td><code>{config.mysql.host}</code></td></tr>
            <tr><td style={{ color: '#64748b' }}>端口</td><td>{config.mysql.port}</td></tr>
            <tr><td style={{ color: '#64748b' }}>数据库</td><td><code>{config.mysql.database}</code></td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>对象存储</h3>
        <table>
          <tbody>
            <tr><td style={{ width: 120, color: '#64748b' }}>Endpoint</td><td><code>{config.storage.endpoint}</code></td></tr>
            <tr><td style={{ color: '#64748b' }}>区域</td><td>{config.storage.region}</td></tr>
            <tr><td style={{ color: '#64748b' }}>Bucket</td><td><code>{config.storage.bucket}</code></td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
