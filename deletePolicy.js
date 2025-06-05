const express = require('express');
const fs = require('fs');
const connectToDatabase = require('./Connection_MySQL');
const { sendPolicyUpdateEmail } = require('./emailService');
const { authenticateUser, checkRole } = require('./auth'); // adjust path as needed
const logAuditAction = require('./logAuditAction'); // ✅ Import this

const router = express.Router();

router.delete('/:id', authenticateUser, async (req, res) => {
  const policyID = req.params.id;
  const db = connectToDatabase();
  const deleterStaffID = req.user?.username;
  const userRole = req.user?.role_ID;

  if (!deleterStaffID || userRole === undefined) {
    return res.status(401).json({ error: 'Unauthorized: Missing user data' });
  }

  try {
    const [policyResults] = await db.promise().query(
      'SELECT policy_name, file_path, department_ID FROM Policy WHERE policy_ID = ?',
      [policyID]
    );

    if (policyResults.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const { policy_name, file_path, department_ID: policyDeptID } = policyResults[0];

    if (userRole === 1) {
      // Admin – allowed
    } else if (userRole === 2) {
      const [userResults] = await db.promise().query(
        'SELECT department_ID FROM User WHERE staff_ID = ?',
        [deleterStaffID]
      );

      if (userResults.length === 0) {
        db.end();
        return res.status(403).json({ error: 'User not found for permission check' });
      }

      const userDeptID = userResults[0].department_ID;
      if (userDeptID !== policyDeptID) {
        // 🚨 Log unauthorized attempt
        await logAuditAction({
          actor_ID: deleterStaffID,
          action_type: 'UNAUTHORIZED_ACCESS',
          policy_ID: policyID,
          policy_name,
          description: `Permission denied: Department mismatch. User ${deleterStaffID} tried to delete policy "${policy_name}" (ID: ${policyID}).`
        });

        db.end();
        return res.status(403).json({ error: 'Permission denied: Department mismatch' });
      }
    } else {
      // 🚨 Log unauthorized attempt
      await logAuditAction({
        actor_ID: deleterStaffID,
        action_type: 'UNAUTHORIZED_ACCESS',
        policy_ID: policyID,
        policy_name,
        description: `Permission denied: Insufficient privileges. User ${deleterStaffID} tried to delete policy "${policy_name}" (ID: ${policyID}).`
      });

      db.end();
      return res.status(403).json({ error: 'Permission denied: Insufficient privileges' });
    }

    // ✅ Delete file
    try {
      if (fs.existsSync(file_path)) {
        fs.unlinkSync(file_path);
        console.log(`File deleted: ${file_path}`);
      } else {
        console.warn(`File not found: ${file_path}`);
      }
    } catch (fsErr) {
      console.error('File deletion error:', fsErr.message);
    }

    // ✅ Delete from DB
    await db.promise().query('DELETE FROM Policy WHERE policy_ID = ?', [policyID]);

    // ✅ Audit log for successful deletion
    await logAuditAction({
      actor_ID: deleterStaffID,
      action_type: 'DELETE_DOCUMENT',
      policy_ID: policyID,
      policy_name,
      description: `Policy "${policy_name}" (ID: ${policyID}) deleted by ${deleterStaffID}.`
    });

    // Notify users
    const [deleterRows] = await db.promise().query(
      'SELECT staff_email, staff_name FROM User WHERE staff_ID = ?',
      [deleterStaffID]
    );

    const [adminRows] = await db.promise().query(
      `SELECT staff_email, staff_name FROM User U
       JOIN Role R ON U.role_ID = R.role_id
       WHERE R.role_name = 'Admin'`
    );

    const [departmentUsers] = await db.promise().query(
      'SELECT staff_email, staff_name FROM User WHERE department_ID = ?',
      [policyDeptID]
    );

    db.end();

    const subject = `Policy Document Deleted: ${policy_name}`;
    const message = `
The policy document titled "${policy_name}" (ID: ${policyID}) has been deleted.

Deleted by: ${deleterRows[0]?.staff_name || 'Unknown User'} (ID: ${deleterStaffID})

If you have any questions, please contact the administrator.
    `.trim();

    const recipientsSet = new Set();
    if (deleterRows[0]?.staff_email) recipientsSet.add(deleterRows[0].staff_email);
    adminRows.forEach(({ staff_email }) => staff_email && recipientsSet.add(staff_email));
    departmentUsers.forEach(({ staff_email }) => staff_email && recipientsSet.add(staff_email));

    console.log('Notifying recipients:', Array.from(recipientsSet));

    for (const email of recipientsSet) {
      try {
        await sendPolicyUpdateEmail(email, subject, message);
      } catch (emailErr) {
        console.error(`Failed to send email to ${email}:`, emailErr.message);
      }
    }

    res.status(200).json({ message: 'Policy deleted and notification sent' });
  } catch (error) {
    console.error('Error during policy deletion:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

module.exports = router;
