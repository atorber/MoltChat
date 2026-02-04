import { useEffect, useState } from 'react';
import { useMqtt } from '../context/MqttContext';

interface GroupItem {
  group_id: string;
  name: string;
  creator_employee_id: string;
  member_count: number;
  created_at: string;
}

export default function Groups() {
  const { request } = useMqtt();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', member_ids: '' });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadGroups = () => {
    request<{ groups: GroupItem[] }>('group.list', { all: showAll }).then((res) => {
      if (res.code === 0 && res.data?.groups) setGroups(res.data.groups);
    });
  };

  useEffect(() => {
    loadGroups();
    setLoading(false);
  }, [request, showAll]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    const member_ids = createForm.member_ids.trim() ? createForm.member_ids.trim().split(/\s*,\s*/) : [];
    try {
      const r = await request<{ group_id: string }>('group.create', {
        name: createForm.name,
        member_ids,
      });
      if (r.code !== 0) setSubmitError(r.message || '创建失败');
      else {
        setShowCreate(false);
        setCreateForm({ name: '', member_ids: '' });
        loadGroups();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async (group_id: string, name: string) => {
    if (!confirm(`确定解散群组「${name}」？`)) return;
    const r = await request('group.dismiss', { group_id });
    if (r.code === 0) loadGroups();
    else alert(r.message);
  };

  return (
    <div className="card">
      <h2>群组管理</h2>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>新建群组</button>
            <label>
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              显示全部群组
            </label>
          </div>
          {showCreate && (
            <form onSubmit={handleCreate} style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
              <div className="form-row">
                <label>群名称</label>
                <input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>初始成员 employee_id（逗号分隔）</label>
                <input value={createForm.member_ids} onChange={(e) => setCreateForm((f) => ({ ...f, member_ids: e.target.value }))} placeholder="emp_xxx, emp_yyy" />
              </div>
              {submitError && <div className="error">{submitError}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>创建</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
              </div>
            </form>
          )}
          <table>
            <thead>
              <tr>
                <th>群 ID</th>
                <th>名称</th>
                <th>创建者</th>
                <th>成员数</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.group_id}>
                  <td><code>{g.group_id}</code></td>
                  <td>{g.name}</td>
                  <td><code>{g.creator_employee_id}</code></td>
                  <td>{g.member_count}</td>
                  <td>{g.created_at ? new Date(g.created_at).toLocaleString() : '-'}</td>
                  <td>
                    <button type="button" className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDismiss(g.group_id, g.name)}>解散</button>
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
