const mysql = require('mysql2/promise');
const { sendPolicyUpdateEmail } = require('./emailService');

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'policy management system',
  port: 3306
};

// Validate input fields
function validateRequestData(data) {
  const { staff_ID, action, policy_ID, department_ID } = data;

  if (!staff_ID || !action || !department_ID) {
    throw new Error('Missing required fields: staff_ID, action, or department_ID');
  }

  const allowedActions = ['view', 'upload', 'delete', 'edit'];
  if (!allowedActions.includes(action.toLowerCase())) {
    throw new Error(`Invalid action: ${action}`);
  }

  if (action.toLowerCase() !== 'upload' && !policy_ID) {
    throw new Error('policy_ID is required for this action');
  }
}

// Fetch policy name
async function getPolicyName(connection, policy_ID) {
  if (!policy_ID) return 'N/A';

  const [[row]] = await connection.execute(
    'SELECT policy_name FROM Policy WHERE policy_ID = ?',
    [policy_ID]
  );

  return row?.policy_name || 'Unknown Policy';
}

// Fetch permission ID
async function getPermissionID(connection, action) {
  const permissionName = `${action.charAt(0).toUpperCase()}${action.slice(1)} Document`;

  const [[permRow]] = await connection.execute(
    'SELECT permission_ID FROM Permission WHERE permission_name = ?',
    [permissionName]
  );

  if (!permRow) throw new Error(`Permission not found for action: ${action}`);
  return permRow.permission_ID;
}

// Notify user of request submission
async function notifyUserEmail(connection, staff_ID, policy_ID, action) {
  const policyName = await getPolicyName(connection, policy_ID);

  const [userRows] = await connection.execute(
    'SELECT staff_email FROM User WHERE staff_ID = ?',
    [staff_ID]
  );

  if (userRows.length === 0) return;

  const subject = `Policy Permission Request by ${staff_ID}`;
  const body = `
Hello,

Your request to ${action} the policy "${policyName}" (Policy ID: ${policy_ID || 'N/A'}) has been submitted and is pending approval.

Thank you.
  `;

  await sendPolicyUpdateEmail(userRows[0].staff_email, subject, body);
}

// Notify all admins
async function notifyAdmins(connection, staff_ID, policy_ID, action) {
  const policyName = await getPolicyName(connection, policy_ID);

  const [adminRows] = await connection.execute(
    'SELECT staff_email FROM User WHERE role_ID = 1'
  );

  if (adminRows.length === 0) return;

  const subject = 'New Policy Permission Request Submitted';
  const body = `
Hello Admin,

User ${staff_ID} has submitted a request to ${action} the policy "${policyName}" (Policy ID: ${policy_ID || 'N/A'}). Please review and take necessary actions.

Thank you.
  `;

  for (const admin of adminRows) {
    await sendPolicyUpdateEmail(admin.staff_email, subject, body);
  }
}

// Main submission function
async function submitRequest(data) {
  validateRequestData(data);
  const connection = await mysql.createConnection(dbConfig);

  try {
    const { staff_ID, action, policy_ID } = data;
    const actionLower = action.toLowerCase();
    const permissionName = `${action.charAt(0).toUpperCase()}${action.slice(1)} Document`;

    // Check for duplicate pending requests
    const [existing] = await connection.execute(
      `SELECT 1 FROM Permission_Request 
       WHERE staff_ID = ? 
         AND permission_ID = (SELECT permission_ID FROM Permission WHERE permission_name = ?) 
         AND policy_ID = ? AND status = 'Pending'`,
      [staff_ID, permissionName, policy_ID]
    );

    if (existing.length > 0) {
      throw new Error('You already have a pending request for this action on this policy.');
    }

    // Get permission ID
    const permissionID = await getPermissionID(connection, actionLower);

    // Insert request
    await connection.execute(
      `INSERT INTO Permission_Request 
       (staff_ID, policy_ID, permission_ID, request_date, status)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'Pending')`,
      [staff_ID, policy_ID, permissionID]
    );

    // Log in audit
    const auditDescription = `Permission request submitted for "${actionLower}" on policy ID ${policy_ID || 'N/A'} by ${staff_ID}.`;

    await connection.execute(
      `INSERT INTO Audit (policy_ID, modified_by, change_type, change_description)
       VALUES (?, ?, 'Permission Request', ?)`,
      [policy_ID || null, staff_ID, auditDescription]
    );

    // Notify user and admins
    await notifyUserEmail(connection, staff_ID, policy_ID, actionLower);
    await notifyAdmins(connection, staff_ID, policy_ID, actionLower);

    return { message: 'Request submitted and audit logged successfully.' };

  } catch (err) {
    console.error('[submitRequest] Error:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
}

module.exports = { submitRequest };
