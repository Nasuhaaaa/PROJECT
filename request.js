const mysql = require('mysql2/promise');
const { sendPolicyUpdateEmail } = require('./emailService');

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'policy management system',
  port: 3306
};

// Validate input data
function validateRequestData(data) {
  const { staff_ID, action, policy_ID, department_ID } = data;

  if (!staff_ID || !action || !department_ID) {
    throw new Error('Missing required fields: staff_ID, action, or department_ID');
  }

  const allowedActions = ['view', 'upload', 'delete', 'edit'];
  const actionLower = action.toLowerCase();

  if (!allowedActions.includes(actionLower)) {
    throw new Error(`Invalid action: ${action}`);
  }

  if (actionLower !== 'upload' && !policy_ID) {
    throw new Error('policy_ID is required for this action');
  }
}

// Send email to the user
async function notifyUserEmail(connection, staff_ID, policy_ID, action) {
  let policyName = 'N/A';

  if (policy_ID) {
    const [[policyRow]] = await connection.execute(
      `SELECT policy_name FROM Policy WHERE policy_ID = ?`,
      [policy_ID]
    );
    policyName = policyRow?.policy_name || 'Unknown Policy';
  }

  // Get user email
  const [userRows] = await connection.execute(
    `SELECT staff_email FROM User WHERE staff_ID = ?`,
    [staff_ID]
  );

  if (userRows.length === 0) return;

  const userEmail = userRows[0].staff_email;

  const subject = `Policy Permission Request by ${staff_ID}`;
  const body = `
Hello,

Your request to ${action} the policy "${policyName}" (Policy ID: ${policy_ID || 'N/A'}) has been submitted and is pending approval.

Thank you.
  `;

  await sendPolicyUpdateEmail(userEmail, subject, body);
}

// Send email to all admins
async function notifyAdmins(connection, staff_ID, policy_ID, action) {
  let policyName = 'N/A';

  if (policy_ID) {
    const [[policyRow]] = await connection.execute(
      `SELECT policy_name FROM Policy WHERE policy_ID = ?`,
      [policy_ID]
    );
    policyName = policyRow?.policy_name || 'Unknown Policy';
  }

  // Get admin emails (assuming role_id = 1 is Admin)
  const [adminRows] = await connection.execute(
    `SELECT staff_email FROM User WHERE role_ID = 1`
  );

  if (adminRows.length === 0) return;

  const subject = `New Policy Permission Request Submitted`;
  const body = `
Hello Admin,

User ${staff_ID} has submitted a request to ${action} the policy "${policyName}" (Policy ID: ${policy_ID || 'N/A'}). Please review and take necessary actions.

Thank you.
  `;

  // Send email to each admin
  for (const admin of adminRows) {
    await sendPolicyUpdateEmail(admin.staff_email, subject, body);
  }
}

// Main function to submit request
async function submitRequest(data) {
  validateRequestData(data);

  const connection = await mysql.createConnection(dbConfig);

  try {
    const { staff_ID, action, policy_ID, department_ID } = data;
    const actionLower = action.toLowerCase();

    // Check for existing pending request
    const [existing] = await connection.execute(
      `SELECT * FROM Permission_Request 
       WHERE staff_ID = ? AND permission_ID = (
         SELECT permission_ID FROM Permission WHERE permission_name = ?
       ) AND policy_ID = ? AND status = 'Pending'`,
      [staff_ID, actionLower.charAt(0).toUpperCase() + actionLower.slice(1) + ' Document', policy_ID]
    );

    if (existing.length > 0) {
      throw new Error('You already have a pending request for this action on this policy.');
    }

    // Get permission ID
    const [[permRow]] = await connection.execute(
      `SELECT permission_ID FROM Permission WHERE permission_name = ?`,
      [actionLower.charAt(0).toUpperCase() + actionLower.slice(1) + ' Document']
    );

    if (!permRow) {
      throw new Error(`Permission not found for action: ${action}`);
    }

    // Insert into Permission_Request table
    await connection.execute(
      `INSERT INTO Permission_Request 
       (staff_ID, policy_ID, permission_ID, request_date, status)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'Pending')`,
      [staff_ID, policy_ID, permRow.permission_ID]
    );

    // Log into Audit
    const auditDescription = `Permission request submitted for "${action}" on policy ID ${policy_ID || 'N/A'} by ${staff_ID}.`;

    await connection.execute(
      `INSERT INTO Audit (policy_ID, modified_by, change_type, change_description)
       VALUES (?, ?, 'Permission Request', ?)`,
      [policy_ID || null, staff_ID, auditDescription]
    );

    // Notify user
    await notifyUserEmail(connection, staff_ID, policy_ID, action);

    // Notify admins
    await notifyAdmins(connection, staff_ID, policy_ID, action);

    return { message: 'Request submitted and audit logged successfully' };

  } catch (err) {
    console.error('[submitRequest] Error:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
}

module.exports = { submitRequest };
