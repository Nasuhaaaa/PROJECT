// approval.js
const mysql = require('mysql2/promise');

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'policy management system',
  port: 3306
};

async function getPendingRequests() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.execute(`
      SELECT r.request_ID, r.staff_ID, r.permission_ID, r.policy_ID, r.status, r.request_date AS request_at,
             u.staff_name, p.policy_name
      FROM permission_request r
      JOIN user u ON r.staff_ID = u.staff_ID
      JOIN policy p ON r.policy_ID = p.policy_ID
      WHERE r.status = 'Pending'
      ORDER BY r.request_date DESC
    `);
    return rows;
  } finally {
    await connection.end();
  }
}

async function updateRequestStatus(request_ID, newStatus) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    await connection.execute(`
      UPDATE permission_request
      SET status = ?, decision_at = CURRENT_TIMESTAMP
      WHERE request_ID = ?
    `, [newStatus, request_ID]);

    return { message: `Request ${newStatus.toLowerCase()} successfully.` };
  } finally {
    await connection.end();
  }
}

module.exports = { getPendingRequests, updateRequestStatus };
