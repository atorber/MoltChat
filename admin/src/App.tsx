import { Routes, Route, Navigate } from 'react-router-dom';
import { MqttProvider, useMqtt } from './context/MqttContext';
import Login from './pages/Login';
import Layout from './Layout';
import OrgTree from './pages/OrgTree';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Groups from './pages/Groups';

function Protected({ children }: { children: React.ReactNode }) {
  const { connected } = useMqtt();
  if (!connected) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/org" replace />} />
        <Route path="org" element={<OrgTree />} />
        <Route path="departments" element={<Departments />} />
        <Route path="employees" element={<Employees />} />
        <Route path="groups" element={<Groups />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <MqttProvider>
      <AppRoutes />
    </MqttProvider>
  );
}
