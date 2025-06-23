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
      ORDER BY ep.edited_at DESC
    `);
    return rows;
  } finally {
    await connection.end();
  }
}


// Approve an edited policy and replace the original file in the Policy table
async function approveEditedPolicy(edit_id, approver_ID) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    // Fetch the edited policy row
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

    // Step 1: Update the original policy
    await connection.execute(`
      UPDATE policy
      SET file_path = ?, file_format = ?, modified_by = ?, last_updated = NOW()
      WHERE policy_ID = ?
    `, [edit.file_path, edit.file_format, edit.modified_by, edit.policy_ID]);

    // Step 2: Delete the row from edited_policy (or mark as approved if you prefer)
    await connection.execute('DELETE FROM edited_policy WHERE id = ?', [edit_id]);

    // Step 3: Log to audit (optional)
    await connection.execute(`
      INSERT INTO audit (actor_ID, action_type, policy_ID, description, timestamp)
      VALUES (?, 'Approved, ?, ?, NOW())
    `, [
      approver_ID,
      edit.policy_ID,
      `Admin approved edit (ID: ${edit_id}) for policy "${edit.policy_name}" uploaded by ${edit.staff_name}.`
    ]);

    // Step 4: Send email notification to original editor
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
async function rejectEditedPolicy(edit_id, approver_ID) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    // Fetch edited policy info for audit and email
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

    // Step 1: Delete the pending edited policy
    await connection.execute(`
      UPDATE edited_policy
      SET status = 'Rejected'
      WHERE id = ?
    `, [edit_id]);


    // Step 2: Log the rejection in audit trail
    await connection.execute(`
      INSERT INTO audit (actor_ID, action_type, policy_ID, description, timestamp)
      VALUES (?, 'Rejected', ?, ?, NOW())
    `, [
      approver_ID,
      edit.policy_ID,
      `Admin rejected edit (ID: ${edit_id}) for policy "${edit.policy_name}" uploaded by ${edit.staff_name}.`
    ]);

    // Step 3: Send rejection email
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



// Approval.js
module.exports = {
  getPendingRequests,
  updateRequestStatus,
  getPendingEditedPolicies,
  approveEditedPolicy,
  rejectEditedPolicy
};
