/**
 * client_session 查询：client_id -> employee_id
 */

import type { Pool } from 'mysql2/promise';

export async function getEmployeeIdByClientId(
  pool: Pool,
  clientId: string
): Promise<string | null> {
  const [rows] = await pool.execute('SELECT employee_id FROM client_session WHERE client_id = ? LIMIT 1', [clientId]);
  const list = (rows as { employee_id: string }[]);
  return list[0]?.employee_id ?? null;
}

export async function upsertClientSession(
  pool: Pool,
  clientId: string,
  employeeId: string,
  deviceInfo?: string
): Promise<void> {
  await pool.execute(
    `INSERT INTO client_session (client_id, employee_id, device_info, connected_at)
     VALUES (?, ?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE employee_id = VALUES(employee_id), device_info = VALUES(device_info), connected_at = NOW(3)`,
    [clientId, employeeId, deviceInfo ?? null]
  );
}
