const mysql = require('mysql2/promise');

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'policy management system',
  port: 3306
};

// Fetch all pending requests
async function getPendingRequests() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.execute(`
      SELECT r.request_ID, r.staff_ID, r.policy_ID, r.status, r.action_type, r.request_date AS request_at,
             u.staff_name, 
             COALESCE(p.policy_name, 'Deleted Policy') AS policy_name
      FROM permission_request r
      JOIN user u ON r.staff_ID = u.staff_ID
      LEFT JOIN policy p ON r.policy_ID = p.policy_ID
      WHERE LOWER(r.status) = 'pending'
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
    const [requestRows] = await connection.execute(`
      SELECT staff_ID, policy_ID, permission_ID 
      FROM permission_request 
      WHERE request_ID = ?
    `, [request_ID]);

    if (requestRows.length === 0) {
      throw new Error('Request not found');
    }

    const { staff_ID, policy_ID, permission_ID } = requestRows[0];

    await connection.execute(`
      UPDATE permission_request
      SET status = ?, decision_at = CURRENT_TIMESTAMP
      WHERE request_ID = ?
    `, [newStatus, request_ID]);

    if (newStatus === 'Approved') {
      const valid_from = new Date().toISOString().slice(0, 10);

      await connection.execute(`
        INSERT INTO access_right (policy_ID, permission_ID, staff_ID, valid_from)
        VALUES (?, ?, ?, ?)
      `, [policy_ID, permission_ID, staff_ID, valid_from]);
    }

    return { message: `Request ${newStatus.toLowerCase()} successfully.` };
  } finally {
    await connection.end();
  }
}

module.exports = { getPendingRequests, updateRequestStatus };
