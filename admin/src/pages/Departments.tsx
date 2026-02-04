import { useEffect, useState } from 'react';
import { useMqtt } from '../context/MqttContext';

interface Department {
  department_id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export default function Departments() {
  const { request } = useMqtt();
  const [list, setList] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', parent_id: '', sort_order: 0 });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    request<{ departments: Department[]; employees: unknown[] }>('org.tree').then((res) => {
      if (res.code === 0 && res.data?.departments) setList(res.data.departments);
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
      const r = await request('department.create', {
        name: form.name,
        parent_id: form.parent_id || undefined,
        sort_order: form.sort_order,
      });
      if (r.code !== 0) setSubmitError(r.message || '创建失败');
      else {
        setShowForm(false);
        setForm({ name: '', parent_id: '', sort_order: 0 });
        load();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (department_id: string) => {
    if (!confirm(`确定删除部门 ${department_id}？`)) return;
    const r = await request('department.delete', { department_id });
    if (r.code === 0) load();
    else alert(r.message);
  };

  return (
    <div className="card">
      <h2>部门管理</h2>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>新建部门</button>
          </div>
          {showForm && (
            <form onSubmit={handleCreate} style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
              <div className="form-row">
                <label>名称</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>上级部门 ID</label>
                <input value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))} placeholder="可选" />
              </div>
              <div className="form-row">
                <label>排序</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
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
                <th>名称</th>
                <th>上级</th>
                <th>排序</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.department_id}>
                  <td><code>{d.department_id}</code></td>
                  <td>{d.name}</td>
                  <td>{d.parent_id || '-'}</td>
                  <td>{d.sort_order}</td>
                  <td>
                    <button type="button" className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(d.department_id)}>删除</button>
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
