import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useMqtt } from './context/MqttContext';

export default function Layout() {
  const { disconnect, employeeId } = useMqtt();
  const navigate = useNavigate();

  const handleLogout = () => {
    disconnect();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>MChat 管理后台</h1>
        <nav>
          <NavLink to="/org" end className={({ isActive }) => (isActive ? 'active' : '')}>
            组织架构
          </NavLink>
          <NavLink to="/departments" className={({ isActive }) => (isActive ? 'active' : '')}>
            部门管理
          </NavLink>
          <NavLink to="/employees" className={({ isActive }) => (isActive ? 'active' : '')}>
            员工管理
          </NavLink>
          <NavLink to="/groups" className={({ isActive }) => (isActive ? 'active' : '')}>
            群组管理
          </NavLink>
        </nav>
        <div style={{ padding: '16px', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{employeeId || ''}</span>
          <button type="button" onClick={handleLogout} className="btn btn-secondary" style={{ marginTop: 8, width: '100%' }}>
            退出登录
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
