import { useEffect, useState, useMemo } from 'react';
import { useMqtt } from '../context/MqttContext';

interface Department {
  department_id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

interface Employee {
  employee_id: string;
  name: string;
  department_id: string | null;
  manager_id: string | null;
  is_ai_agent: boolean;
  skills_badge?: string[] | null;
}

function buildTree(depts: Department[], parentId: string | null): Department[] {
  return depts
    .filter((d) => (parentId == null ? d.parent_id == null : d.parent_id === parentId))
    .sort((a, b) => a.sort_order - b.sort_order || a.department_id.localeCompare(b.department_id));
}

function collectDescendantIds(depts: Department[], departmentId: string): Set<string> {
  const set = new Set<string>([departmentId]);
  const queue = [departmentId];
  while (queue.length > 0) {
    const pid = queue.shift()!;
    depts.forEach((d) => {
      if (d.parent_id === pid && !set.has(d.department_id)) {
        set.add(d.department_id);
        queue.push(d.department_id);
      }
    });
  }
  return set;
}

function DeptNode({
  dept,
  depth,
  departments,
  selectedId,
  onSelect,
}: {
  dept: Department;
  depth: number;
  departments: Department[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const children = useMemo(() => buildTree(departments, dept.department_id), [departments, dept.department_id]);
  const isSelected = selectedId === dept.department_id;

  return (
    <div key={dept.department_id} style={{ marginLeft: depth * 16 }}>
      <button
        type="button"
        onClick={() => onSelect(dept.department_id)}
        style={{
          display: 'block',
          width: '100%',
          padding: '8px 10px',
          textAlign: 'left',
          border: 'none',
          borderRadius: 6,
          background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
          color: isSelected ? '#1d4ed8' : '#334155',
          fontWeight: isSelected ? 600 : 400,
          cursor: 'pointer',
        }}
      >
        {dept.name}
      </button>
      {children.map((c) => (
        <DeptNode
          key={c.department_id}
          dept={c}
          depth={depth + 1}
          departments={departments}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default function OrgTree() {
  const { request } = useMqtt();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    request<{ departments: Department[]; employees: Employee[] }>('org.tree')
      .then((res) => {
        if (res.code !== 0 || !res.data) {
          setError(res.message || '获取失败');
          return;
        }
        if (!cancelled) {
          setDepartments(res.data.departments || []);
          setEmployees(res.data.employees || []);
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [request]);

  const deptMap = useMemo(() => new Map(departments.map((d) => [d.department_id, d])), [departments]);
  const rootDepts = useMemo(() => buildTree(departments, null), [departments]);

  const filteredEmployees = useMemo(() => {
    if (selectedId == null) return employees;
    const ids = collectDescendantIds(departments, selectedId);
    return employees.filter((e) => e.department_id != null && ids.has(e.department_id));
  }, [employees, departments, selectedId]);

  if (loading) return <div className="card">加载中…</div>;
  if (error) return <div className="card"><span className="error">{error}</span></div>;

  const isAllSelected = selectedId === null;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <h2 style={{ margin: 0, padding: '20px 20px 16px' }}>组织架构</h2>
      <div style={{ display: 'flex', minHeight: 400 }}>
        <aside
          style={{
            width: 240,
            borderRight: '1px solid #e5e7eb',
            padding: '8px 12px 16px',
            background: '#f8fafc',
            overflowY: 'auto',
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 10px',
                textAlign: 'left',
                border: 'none',
                borderRadius: 6,
                background: isAllSelected ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                color: isAllSelected ? '#1d4ed8' : '#334155',
                fontWeight: isAllSelected ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              全部员工
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, paddingLeft: 10 }}>部门</div>
          {rootDepts.map((d) => (
            <DeptNode
              key={d.department_id}
              dept={d}
              depth={0}
              departments={departments}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </aside>
        <section style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          <h3 style={{ fontSize: 14, color: '#64748b', margin: '0 0 12px' }}>
            {selectedId == null
              ? `全部员工（${filteredEmployees.length}）`
              : `员工（${deptMap.get(selectedId)?.name ?? selectedId}，${filteredEmployees.length} 人）`}
          </h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>姓名</th>
                <th>部门</th>
                <th>类型</th>
                <th>技能标签</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: '#94a3b8', padding: 24 }}>
                    {selectedId == null ? '暂无员工' : '该部门下暂无员工'}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((e) => (
                  <tr key={e.employee_id}>
                    <td><code>{e.employee_id}</code></td>
                    <td>{e.name}</td>
                    <td>{e.department_id ? (deptMap.get(e.department_id)?.name ?? e.department_id) : '-'}</td>
                    <td>{e.is_ai_agent ? 'AI Agent' : '人类'}</td>
                    <td>{Array.isArray(e.skills_badge) && e.skills_badge.length > 0 ? e.skills_badge.join(' ') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
