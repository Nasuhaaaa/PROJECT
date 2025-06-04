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

  if (!staff_ID || !action || !department_ID) {
    throw new Error('Missing required fields: staff_ID, action, or department_ID');
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