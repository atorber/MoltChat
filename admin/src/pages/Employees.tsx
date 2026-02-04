import { useEffect, useState } from 'react';
import { useMqtt } from '../context/MqttContext';

interface Employee {
  employee_id: string;
  name: string;
  department_id: string | null;
  manager_id: string | null;
  is_ai_agent: boolean;
}

interface Department {
  department_id: string;
  name: string;
}

export default function Employees() {
  const { request } = useMqtt();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', is_ai_agent: false, department_id: '', manager_id: '' });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    request<{ departments: Department[]; employees: Employee[] }>('org.tree').then((res) => {
      if (res.code === 0 && res.data) {
        setDepartments(res.data.departments || []);
        setEmployees(res.data.employees || []);
      }
    });
  };

  useEffect(() => {
    load();
    setLoading(false);
  }, [request]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const r = await request<{ employee_id: string; mqtt_connection?: unknown }>('employee.create', {
        name: form.name,
        is_ai_agent: form.is_ai_agent,
        department_id: form.department_id || undefined,
        manager_id: form.manager_id || undefined,
      });
      if (r.code !== 0) setSubmitError(r.message || '创建失败');
      else {
        setShowForm(false);
        setForm({ name: '', is_ai_agent: false, department_id: '', manager_id: '' });
        load();
        if (r.data?.mqtt_connection) {
          alert('员工已创建。MQTT 连接信息请从响应 data.mqtt_connection 查看（控制台或后续功能展示）。');
        }
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>员工管理</h2>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>新建员工</button>
          </div>
          {showForm && (
            <form onSubmit={handleCreate} style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
              <div className="form-row">
                <label>姓名</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>
                  <input type="checkbox" checked={form.is_ai_agent} onChange={(e) => setForm((f) => ({ ...f, is_ai_agent: e.target.checked }))} />
                  AI Agent
                </label>
              </div>
              <div className="form-row">
                <label>部门 ID</label>
                <select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}>
                  <option value="">无</option>
                  {departments.map((d) => (
                    <option key={d.department_id} value={d.department_id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>上级 ID</label>
                <input value={form.manager_id} onChange={(e) => setForm((f) => ({ ...f, manager_id: e.target.value }))} placeholder="manager employee_id" />
              </div>
              {submitError && <div className="error">{submitError}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>创建</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              </div>
            </form>
          )}
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>姓名</th>
                <th>部门</th>
                <th>类型</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.employee_id}>
                  <td><code>{e.employee_id}</code></td>
                  <td>{e.name}</td>
                  <td>{e.department_id ?? '-'}</td>
                  <td>{e.is_ai_agent ? 'AI Agent' : '人类'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
