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

  if (!staff_ID) throw new Error('Missing required field: staff_ID');
  if (!action) throw new Error('Missing required field: action');
  if (!department_ID) throw new Error('Missing required field: department_ID');

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

// Fetch actor name (staff_name)
async function getActorName(connection, actor_ID) {
  const [[row]] = await connection.execute(
    'SELECT staff_name FROM User WHERE staff_ID = ?',
    [actor_ID]
  );
  return row?.staff_name || 'Unknown User';
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

// Notify user
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

// Notify admins
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

  await Promise.all(adminRows.map(admin =>
    sendPolicyUpdateEmail(admin.staff_email, subject, body)
  ));
}

// Main function to submit request
async function submitRequest(data) {
  validateRequestData(data);
  const connection = await mysql.createConnection(dbConfig);

  try {
    await connection.beginTransaction();

    const { staff_ID, action, policy_ID } = data;
    const actionLower = action.toLowerCase();
    const permissionName = `${action.charAt(0).toUpperCase()}${action.slice(1)} Document`;

    // Check for duplicate pending request (only for non-upload)
    if (actionLower !== 'upload') {
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
    }

    // Get permission ID
    const permissionID = await getPermissionID(connection, actionLower);

    // Insert permission request
    await connection.execute(
    `INSERT INTO Permission_Request 
    (staff_ID, policy_ID, permission_ID, action_type, request_date, status)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'Pending')`,
    [staff_ID, policy_ID || null, permissionID, actionLower]
  );


    // Prepare audit data
    const actorName = await getActorName(connection, staff_ID);
    const policyName = await getPolicyName(connection, policy_ID);

    // Map action to audit action_type enum values
    const actionMap = {
      upload: 'UPLOAD_DOCUMENT',
      edit: 'EDIT_DOCUMENT',
      delete: 'DELETE_DOCUMENT',
      view: 'VIEW_DOCUMENT'
    };

    const auditActionType = actionMap[actionLower] || 'VIEW_DOCUMENT';

    const auditDescription = `Permission request submitted for "${actionLower}" on policy ID ${policy_ID || 'N/A'}.`;

    // Insert audit trail
    await connection.execute(
      `INSERT INTO Audit 
       (actor_ID, actor_name, action_type, policy_ID, policy_name, description) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [staff_ID, actorName, auditActionType, policy_ID || null, policyName, auditDescription]
    );

    await connection.commit();

    // Notify user and admins
    await notifyUserEmail(connection, staff_ID, policy_ID, actionLower);
    await notifyAdmins(connection, staff_ID, policy_ID, actionLower);

    return { message: 'Request submitted and audit logged successfully.' };

  } catch (err) {
    await connection.rollback();
    console.error('[submitRequest] Error:', err);
    throw new Error(`Submission failed: ${err.message}`);
  } finally {
    await connection.end();
  }
}

module.exports = { submitRequest };
