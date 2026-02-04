import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMqtt } from '../context/MqttContext';

export default function Login() {
  const navigate = useNavigate();
  const { connect } = useMqtt();
  const [wsUrl, setWsUrl] = useState(() => localStorage.getItem('mchat_admin_ws_url') || 'wss://bdiot.iot.gz.baidubce.com:8884/mqtt');
  const [username, setUsername] = useState(() => localStorage.getItem('mchat_admin_username') || '');
  const [password, setPassword] = useState('');
  const [employeeId, setEmployeeId] = useState(() => localStorage.getItem('mchat_admin_employee_id') || '');
  const [clientIdOverride, setClientIdOverride] = useState(() => localStorage.getItem('mchat_admin_client_id') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await connect(wsUrl, username, password, employeeId || username, clientIdOverride || undefined);
      localStorage.setItem('mchat_admin_ws_url', wsUrl);
      localStorage.setItem('mchat_admin_username', username);
      localStorage.setItem('mchat_admin_employee_id', employeeId || username);
      if (clientIdOverride) localStorage.setItem('mchat_admin_client_id', clientIdOverride);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: 24 }}>
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>MChat 管理后台</h2>
        <p style={{ color: '#64748b', marginBottom: 24, fontSize: 13 }}>使用 MQTT 连接 Broker 并绑定员工身份</p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Broker WebSocket 地址</label>
            <input
              type="text"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              placeholder="wss://host:port/mqtt"
              required
            />
          </div>
          <div className="form-row">
            <label>MQTT 用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="员工 employee_id 或 Broker 用户名"
              required
            />
          </div>
          <div className="form-row">
            <label>MQTT 密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              required
            />
          </div>
          <div className="form-row">
            <label>员工 ID（auth.bind）</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="首次使用填 admin（需在 server 下执行 npm run db:seed）"
            />
          </div>
          <div className="form-row">
            <label>Client ID（可选）</label>
            <input
              type="text"
              value={clientIdOverride}
              onChange={(e) => setClientIdOverride(e.target.value)}
              placeholder="不填则用用户名（/ 会替换为 _）。若报 Identifier rejected 可填 Broker 要求的 Client ID"
            />
          </div>
          {error && <div className="error">{error}</div>}
          <div className="form-actions" style={{ marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '连接中…' : '登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
