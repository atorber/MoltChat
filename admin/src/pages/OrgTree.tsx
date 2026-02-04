import { useEffect, useState } from 'react';
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
}

export default function OrgTree() {
  const { request } = useMqtt();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <div className="card">加载中…</div>;
  if (error) return <div className="card"><span className="error">{error}</span></div>;

  const deptMap = new Map(departments.map((d) => [d.department_id, d]));
  const byDept = new Map<string | null, Employee[]>();
  employees.forEach((e) => {
    const key = e.department_id ?? null;
    if (!byDept.has(key)) byDept.set(key, []);
    byDept.get(key)!.push(e);
  });

  return (
    <div className="card">
      <h2>组织架构</h2>
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>部门（{departments.length}）</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>上级</th>
              <th>排序</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.department_id}>
                <td><code>{d.department_id}</code></td>
                <td>{d.name}</td>
                <td>{d.parent_id ? deptMap.get(d.parent_id)?.name ?? d.parent_id : '-'}</td>
                <td>{d.sort_order}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3 style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>员工（{employees.length}）</h3>
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
                <td>{e.department_id ? deptMap.get(e.department_id)?.name ?? e.department_id : '-'}</td>
                <td>{e.is_ai_agent ? 'AI Agent' : '人类'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
