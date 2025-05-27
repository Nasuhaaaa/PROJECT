const mysql = require('mysql2/promise');

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'policy management system',
  port: 3306
};

// Validate the input data before DB operations
function validateRequestData(data) {
  const { staff_ID, action, policy_ID, department_ID } = data;
  if (!staff_ID || !action || !policy_ID || !department_ID) {
    throw new Error('Missing required request fields');
  }

  // Only allow these actions
  const allowedActions = ['view', 'upload', 'delete', 'edit'];
  if (!allowedActions.includes(action.toLowerCase())) {
    throw new Error(`Invalid action: ${action}`);
  }
}

async function submitRequest(data) {
  validateRequestData(data);

  const connection = await mysql.createConnection(dbConfig);

  try {
    const { staff_ID, action, policy_ID, department_ID } = data;

    // Check for existing pending request with same parameters
    const [existing] = await connection.execute(
      `SELECT * FROM permission_request 
       WHERE staff_ID = ? AND action_type = ? AND policy_ID = ? AND status = 'Pending'`,
      [staff_ID, action, policy_ID]
    );

    if (existing.length > 0) {
      throw new Error('You already have a pending request for this action on this policy.');
    }

    // Insert new request into permission_request
    const query = `
      INSERT INTO permission_request (staff_ID, action_type, policy_ID, department_ID, status, request_at)
      VALUES (?, ?, ?, ?, 'Pending', CURRENT_TIMESTAMP)
    `;

    await connection.execute(query, [staff_ID, action, policy_ID, department_ID]);

    return { message: 'Request submitted successfully' };

  } finally {
    await connection.end();
  }
}

module.exports = { submitRequest };
