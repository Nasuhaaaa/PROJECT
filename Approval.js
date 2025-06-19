const mysql = require('mysql2/promise');
const { sendPolicyUpdateEmail } = require('./emailService');

// Define connection config inline
const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'policy management system',
  port: 3306
};

// Fetch all pending permission requests
async function getPendingRequests() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.execute(`
      SELECT r.request_ID, r.staff_ID, r.policy_ID, r.status, r.action_type, r.request_date AS request_at,
             u.staff_name, 
             COALESCE(p.policy_name, 'NULL') AS policy_name
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

// Update request status and notify via email
async function updateRequestStatus(request_ID, newStatus) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    // Get request details (staff_ID, policy_ID, permission_ID)
   const [requestRows] = await connection.execute(`
    SELECT r.staff_ID, r.policy_ID, r.permission_ID,
          u.staff_name, u.staff_email, u.department_ID,
          COALESCE(p.policy_name, 'Deleted Policy') AS policy_name
    FROM permission_request r
    JOIN user u ON r.staff_ID = u.staff_ID
    LEFT JOIN policy p ON r.policy_ID = p.policy_ID
    WHERE r.request_ID = ?
  `, [request_ID]);

    if (requestRows.length === 0) {
      throw new Error('Request not found');
    }

    const {
      staff_ID, policy_ID, permission_ID,
      staff_name, staff_email, department_ID, policy_name
    } = requestRows[0];

    // Update the request status
    await connection.execute(`
      UPDATE permission_request
      SET status = ?, decision_at = CURRENT_TIMESTAMP
      WHERE request_ID = ?
    `, [newStatus, request_ID]);

    // If approved, insert into access_right
    if (newStatus === 'Approved') {
      const valid_from = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      await connection.execute(`
        INSERT INTO access_right (policy_ID, permission_ID, staff_ID, valid_from)
        VALUES (?, ?, ?, ?)
      `, [policy_ID, permission_ID, staff_ID, valid_from]);
    }

    // 4. Get admin and department member emails (excluding requester)
    const [admins] = await connection.execute(`
      SELECT staff_email FROM user WHERE role_ID = 'admin'
    `);

    const [departmentUsers] = await connection.execute(`
      SELECT staff_email FROM user WHERE department_ID = ? AND staff_ID != ?
    `, [department_ID, staff_ID]);

    const to = staff_email;
    const cc = [...admins, ...departmentUsers].map(user => user.staff_email);

    // 5. Compose and send email
    const subject = `Policy Access Request ${newStatus}`;
    const actionType = newStatus === 'Approved' ? 'approved' : 'rejected';
    const message = `
Hi ${staff_name},

Your request to access the policy "${policy_name}" has been ${actionType}.

Regards,
Policy Management System
    `.trim();

    await sendPolicyUpdateEmail(to, subject, message);

    return { message: `Request ${newStatus.toLowerCase()} successfully.` };
  } finally {
    await connection.end();
  }
}


module.exports = { getPendingRequests, updateRequestStatus };
