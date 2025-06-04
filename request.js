const mysql = require('mysql2/promise');
const { sendNotificationEmail } = require('./emailService');

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'policy management system',
  port: 3306
};

const actionMap = {
  view: 1,
  upload: 2,
  delete: 3,
  edit: 4
};

// Validate input data
function validateRequestData(data) {
  const { staff_ID, action, policy_ID, department_ID } = data;
  if (!staff_ID || !action || !policy_ID || !department_ID) {
    throw new Error('Missing required request fields');
  }

  const allowedActions = ['view', 'upload', 'delete', 'edit'];
  if (!allowedActions.includes(action.toLowerCase())) {
    throw new Error(`Invalid action: ${action}`);
  }
}

// Main submit request function
async function submitRequest(data) {
  validateRequestData(data);

  const connection = await mysql.createConnection(dbConfig);

  try {
    const { staff_ID, action, policy_ID, department_ID } = data;

    // Check for existing pending request
    const [existing] = await connection.execute(
      `SELECT * FROM permission_request 
       WHERE staff_ID = ? AND action_type = ? AND policy_ID = ? AND status = 'Pending'`,
      [staff_ID, action.toLowerCase(), policy_ID]
    );

    if (existing.length > 0) {
      throw new Error('You already have a pending request for this action on this policy.');
    }

    // Insert new request
    await connection.execute(
      `INSERT INTO permission_request 
       (staff_ID, action_type, policy_ID, status, request_date)
       VALUES (?, ?, ?, 'Pending', CURRENT_TIMESTAMP)`,
      [staff_ID, action.toLowerCase(), policy_ID]
    );

    // Fetch user email to notify
    const [userRows] = await connection.execute(
      `SELECT staff_email FROM user WHERE staff_ID = ?`,
      [staff_ID]
    );
    const userEmail = userRows.length > 0 ? userRows[0].staff_email : null;

    if (userEmail) {
      const emailSubject = `New Policy Request Submitted by ${staff_ID}`;
      const emailBody = `
        <p>Hello,</p>
        <p>Your request to <strong>${action}</strong> policy ID <strong>${policy_ID}</strong> has been submitted and is pending approval.</p>
        <p>Thank you.</p>
      `;

      await sendNotificationEmail(userEmail, emailSubject, emailBody);
    }

    return { message: 'Request submitted successfully' };

  } finally {
    await connection.end();
  }
}

module.exports = { submitRequest };
