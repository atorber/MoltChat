import { useEffect, useState } from 'react';
import { useMqtt } from '../context/MqttContext';

interface Employee {
  employee_id: string;
  name: string;
  department_id: string | null;
  manager_id: string | null;
  is_ai_agent: boolean;
  status?: string;
  skills_badge?: unknown;
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
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', is_ai_agent: false, department_id: '', manager_id: '' });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; department_id: string; manager_id: string; status: string } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const load = () => {
    request<{ departments: Department[]; employees: Employee[] }>('org.tree').then((res) => {
      if (res.code === 0 && res.data) {
        setDepartments(res.data.departments || []);
        if (!includeDisabled) setEmployees(res.data.employees || []);
      }
    });
    if (includeDisabled) {
      request<{ employees: Employee[] }>('employee.list', { include_disabled: true }).then((res) => {
        if (res.code === 0 && res.data?.employees) setEmployees(res.data.employees);
      });
    }
  };

  useEffect(() => {
    load();
  }, [request, includeDisabled]);

  useEffect(() => {
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

  const openEdit = async (employee_id: string) => {
    setEditError('');
    setEditForm(null);
    setEditingId(employee_id);
    try {
      const r = await request<{
        employee_id: string;
        name: string;
        department_id: string | null;
        manager_id: string | null;
        status: string;
      }>('employee.get', { employee_id });
      if (r.code === 0 && r.data) {
        setEditForm({
          name: r.data.name,
          department_id: r.data.department_id ?? '',
          manager_id: r.data.manager_id ?? '',
          status: r.data.status ?? 'active',
        });
      } else {
        setEditError(r.message || '获取失败');
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '请求失败');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editForm) return;
    setEditError('');
    setEditSubmitting(true);
    try {
      const updates: Record<string, unknown> = {
        name: editForm.name,
        department_id: editForm.department_id || null,
        manager_id: editForm.manager_id || null,
        status: editForm.status,
      };
      const r = await request('employee.update', { employee_id: editingId, updates });
      if (r.code !== 0) setEditError(r.message || '更新失败');
      else {
        setEditingId(null);
        setEditForm(null);
        load();
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (employee_id: string) => {
    if (!confirm(`确定停用/删除员工「${employee_id}」？停用后该账号将无法登录。`)) return;
    try {
      const r = await request('employee.delete', { employee_id });
      if (r.code === 0) load();
      else alert(r.message || '操作失败');
    } catch (err) {
      alert(err instanceof Error ? err.message : '请求失败');
    }
  };

  return (
    <div className="card">
      <h2>员工管理</h2>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>新建员工</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={includeDisabled} onChange={(e) => setIncludeDisabled(e.target.checked)} />
              显示已禁用员工
            </label>
          </div>
          {showForm && (
            <form onSubmit={handleCreate} style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>新建员工</h3>
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
                <label>部门</label>
                <select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}>
                  <option value="">无</option>
                  {departments.map((d) => (
                    <option key={d.department_id} value={d.department_id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>上级</label>
                <select value={form.manager_id} onChange={(e) => setForm((f) => ({ ...f, manager_id: e.target.value }))}>
                  <option value="">无</option>
                  {employees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>{emp.name}（{emp.employee_id}）</option>
                  ))}
                </select>
              </div>
              {submitError && <div className="error">{submitError}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>创建</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              </div>
            </form>
          )}
          {editingId && (
            <form onSubmit={handleUpdate} style={{ marginBottom: 20, padding: 16, background: '#f0fdf4', borderRadius: 8 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>编辑员工 <code>{editingId}</code></h3>
              {editForm ? (
                <>
                  <div className="form-row">
                    <label>姓名</label>
                    <input value={editForm.name} onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)} required />
                  </div>
                  <div className="form-row">
                    <label>部门</label>
                    <select value={editForm.department_id} onChange={(e) => setEditForm((f) => f ? { ...f, department_id: e.target.value } : f)}>
                      <option value="">无</option>
                      {departments.map((d) => (
                        <option key={d.department_id} value={d.department_id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>上级</label>
                    <select value={editForm.manager_id} onChange={(e) => setEditForm((f) => f ? { ...f, manager_id: e.target.value } : f)}>
                      <option value="">无</option>
                      {employees.filter((e) => e.employee_id !== editingId).map((emp) => (
                        <option key={emp.employee_id} value={emp.employee_id}>{emp.name}（{emp.employee_id}）</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>状态</label>
                    <select value={editForm.status} onChange={(e) => setEditForm((f) => f ? { ...f, status: e.target.value } : f)}>
                      <option value="active">正常</option>
                      <option value="disabled">已禁用</option>
                    </select>
                  </div>
                  {editError && <div className="error">{editError}</div>}
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={editSubmitting}>保存</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setEditForm(null); setEditError(''); }}>取消</button>
                  </div>
                </>
              ) : (
                <p>加载中…</p>
              )}
            </form>
          )}
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>姓名</th>
                <th>部门</th>
                <th>类型</th>
                {includeDisabled && <th>状态</th>}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.employee_id}>
                  <td><code>{e.employee_id}</code></td>
                  <td>{e.name}</td>
                  <td>{e.department_id ? (departments.find((d) => d.department_id === e.department_id)?.name ?? e.department_id) : '-'}</td>
                  <td>{e.is_ai_agent ? 'AI Agent' : '人类'}</td>
                  {includeDisabled && <td>{e.status === 'disabled' ? '已禁用' : '正常'}</td>}
                  <td>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => openEdit(e.employee_id)}>编辑</button>
                    <button type="button" className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(e.employee_id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
