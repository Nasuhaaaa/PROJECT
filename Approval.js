const mysql = require('mysql2/promise');
const { sendPolicyUpdateEmail } = require('./emailService');
const logAuditAction = require('./logAuditAction'); 

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
async function updateRequestStatus(request_ID, newStatus, actor_ID) {
  const connection = await mysql.createConnection(dbConfig);
  try {
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

    const [admins] = await connection.execute(`
      SELECT staff_email FROM user WHERE role_ID = 1
    `);

    const [departmentUsers] = await connection.execute(`
      SELECT staff_email FROM user WHERE department_ID = ? AND staff_ID != ?
    `, [department_ID, staff_ID]);

    const to = staff_email;
    const cc = [...admins, ...departmentUsers].map(user => user.staff_email);

    const subject = `Policy Access Request ${newStatus}`;
    const actionType = newStatus === 'Approved' ? 'approved' : 'rejected';
    const message = `
Hi ${staff_name},

Your request to access the policy "${policy_name}" has been ${actionType}.

Regards,
Policy Management System
    `.trim();

    await sendPolicyUpdateEmail(to, subject, message);

    const statusMap = {
      Approved: 'APPROVED',
      Rejected: 'REJECTED',
      Denied: 'REJECTED'
    };

    const actionTypeValue = statusMap[newStatus] || newStatus.toUpperCase();

    await logAuditAction({
      actor_ID,
      action_type: `PERMISSION_${actionTypeValue}`,
      policy_ID,
      policy_name,
      description: `Request for "${policy_name}" was ${newStatus.toLowerCase()}`
    });

    return { message: `Request ${newStatus.toLowerCase()} successfully.` };
  } finally {
    await connection.end();
  }
}

// Fetch all edited policies awaiting approval
async function getPendingEditedPolicies() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.execute(`
      SELECT ep.id, ep.policy_ID, ep.file_path, ep.file_format, ep.edited_at AS uploaded_at,
             u.staff_name, p.policy_name
      FROM edited_policy ep
      JOIN user u ON ep.modified_by = u.staff_ID
      JOIN policy p ON ep.policy_ID = p.policy_ID
      WHERE ep.status = 'Pending'
      ORDER BY ep.edited_at DESC
    `);
    return rows;
  } finally {
    await connection.end();
  }
}

// Approve an edited policy and replace the original file in the Policy table
async function approveEditedPolicy(edit_id, actor_ID) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [editRows] = await connection.execute(`
      SELECT ep.*, u.staff_name, u.staff_email, p.policy_name
      FROM edited_policy ep
      JOIN user u ON ep.modified_by = u.staff_ID
      JOIN policy p ON ep.policy_ID = p.policy_ID
      WHERE ep.id = ?
    `, [edit_id]);

    if (editRows.length === 0) {
      throw new Error('Edited policy not found');
    }

    const edit = editRows[0];

    await connection.execute(`
      UPDATE policy
      SET file_path = ?, file_format = ?, modified_by = ?, last_updated = NOW()
      WHERE policy_ID = ?
    `, [edit.file_path, edit.file_format, edit.modified_by, edit.policy_ID]);

    await connection.execute(`
      DELETE FROM edited_policy WHERE id = ?
    `, [edit_id]);

    await logAuditAction({
      actor_ID,
      action_type: 'APPROVED_EDIT',
      policy_ID: edit.policy_ID,
      policy_name: edit.policy_name,
      description: `Edit (ID: ${edit_id}) for policy "${edit.policy_name}" uploaded by ${edit.staff_name} was approved.`
    });

    const subject = `Your Edited Policy Has Been Approved`;
    const message = `
Hi ${edit.staff_name},

Your uploaded changes to Policy "${edit.policy_name}" (ID: ${edit.policy_ID}) have been approved by an administrator.

The file you submitted is now the official version of this policy.

Regards,  
Policy Management System
    `.trim();

    await sendPolicyUpdateEmail(edit.staff_email, subject, message);

    return { message: 'Edited policy approved and applied to main policy.' };
  } finally {
    await connection.end();
  }
}

// Reject an edited policy without applying it
async function rejectEditedPolicy(edit_id, actor_ID) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [editRows] = await connection.execute(`
      SELECT ep.*, u.staff_name, u.staff_email, p.policy_name
      FROM edited_policy ep
      JOIN user u ON ep.modified_by = u.staff_ID
      JOIN policy p ON ep.policy_ID = p.policy_ID
      WHERE ep.id = ?
    `, [edit_id]);

    if (editRows.length === 0) {
      throw new Error('Edited policy not found');
    }

    const edit = editRows[0];

    await connection.execute(`
      UPDATE edited_policy
      SET status = 'Rejected'
      WHERE id = ?
    `, [edit_id]);

    await logAuditAction({
      actor_ID,
      action_type: 'REJECTED_EDIT',
      policy_ID: edit.policy_ID,
      policy_name: edit.policy_name,
      description: `Edit (ID: ${edit_id}) for policy "${edit.policy_name}" uploaded by ${edit.staff_name} was rejected.`
    });


    const subject = `Your Edited Policy Was Rejected`;
    const message = `
Hi ${edit.staff_name},

Your uploaded changes to Policy "${edit.policy_name}" (ID: ${edit.policy_ID}) have been reviewed and **rejected** by an administrator.

The official policy remains unchanged.

Regards,  
Policy Management System
    `.trim();

    await sendPolicyUpdateEmail(edit.staff_email, subject, message);

    return { message: 'Edited policy rejected successfully.' };
  } finally {
    await connection.end();
  }
}



module.exports = {
  getPendingRequests,
  updateRequestStatus,
  getPendingEditedPolicies,
  approveEditedPolicy,
  rejectEditedPolicy
};
