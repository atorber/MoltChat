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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; parent_id: string; sort_order: number } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

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

  const openEdit = (d: Department) => {
    setEditError('');
    setEditingId(d.department_id);
    setEditForm({
      name: d.name,
      parent_id: d.parent_id ?? '',
      sort_order: d.sort_order,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editForm) return;
    setEditError('');
    setEditSubmitting(true);
    try {
      const updates: Record<string, unknown> = {
        name: editForm.name,
        parent_id: editForm.parent_id || null,
        sort_order: editForm.sort_order,
      };
      const r = await request('department.update', { department_id: editingId, updates });
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

  const handleDelete = async (department_id: string) => {
    if (!confirm(`确定删除部门「${department_id}」？若有子部门或在职员工将无法删除。`)) return;
    try {
      const r = await request('department.delete', { department_id });
      if (r.code === 0) load();
      else alert(r.message || '删除失败');
    } catch (err) {
      alert(err instanceof Error ? err.message : '请求失败');
    }
  };

  const parentOptions = list.filter((d) => d.department_id !== editingId);

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
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>新建部门</h3>
              <div className="form-row">
                <label>名称</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>上级部门</label>
                <select value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}>
                  <option value="">无（根部门）</option>
                  {list.map((d) => (
                    <option key={d.department_id} value={d.department_id}>{d.name}（{d.department_id}）</option>
                  ))}
                </select>
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
          {editingId && editForm && (
            <form onSubmit={handleUpdate} style={{ marginBottom: 20, padding: 16, background: '#f0fdf4', borderRadius: 8 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>编辑部门 <code>{editingId}</code></h3>
              <div className="form-row">
                <label>名称</label>
                <input value={editForm.name} onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)} required />
              </div>
              <div className="form-row">
                <label>上级部门</label>
                <select value={editForm.parent_id} onChange={(e) => setEditForm((f) => f ? { ...f, parent_id: e.target.value } : f)}>
                  <option value="">无（根部门）</option>
                  {parentOptions.map((d) => (
                    <option key={d.department_id} value={d.department_id}>{d.name}（{d.department_id}）</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>排序</label>
                <input type="number" value={editForm.sort_order} onChange={(e) => setEditForm((f) => f ? { ...f, sort_order: Number(e.target.value) } : f)} />
              </div>
              {editError && <div className="error">{editError}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>保存</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setEditForm(null); setEditError(''); }}>取消</button>
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
                  <td>{d.parent_id ? (list.find((x) => x.department_id === d.parent_id)?.name ?? d.parent_id) : '-'}</td>
                  <td>{d.sort_order}</td>
                  <td>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => openEdit(d)}>编辑</button>
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
