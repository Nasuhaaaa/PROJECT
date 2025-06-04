const express = require('express');
const fs = require('fs');
const connectToDatabase = require('./Connection_MySQL');
const { sendPolicyUpdateEmail } = require('./emailService');
const { authenticateUser, checkRole } = require('./auth'); // adjust path as needed


const router = express.Router();

// DELETE a policy by ID with email notification
// Apply middlewares: user must be authenticated AND have role_ID === 1 (Admin)
router.delete('/:id', authenticateUser, async (req, res) => {
  const policyID = req.params.id;
  const db = connectToDatabase();
  const deleterStaffID = req.user?.username; // From JWT
  const userRole = req.user?.role_ID;

  if (!deleterStaffID || userRole === undefined) {
    return res.status(401).json({ error: 'Unauthorized: Missing user data' });
  }

  try {
    // 1. Get policy details
    const [policyResults] = await db.promise().query(
      'SELECT policy_name, file_path, department_ID FROM Policy WHERE policy_ID = ?',
      [policyID]
    );

    if (policyResults.length === 0) {
      db.end();
      return res.status(404).json({ error: 'Policy not found' });
    }

    const { policy_name, file_path, department_ID: policyDeptID } = policyResults[0];

    // 2. Authorization logic
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
        db.end();
        return res.status(403).json({ error: 'Permission denied: Department mismatch' });
      }
    } else {
      db.end();
      return res.status(403).json({ error: 'Permission denied: Insufficient privileges' });
    }

    // Continue with file and DB deletion...

    // 2. Delete the file if it exists
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

    // 3. Delete the policy from database
    await db.promise().query('DELETE FROM Policy WHERE policy_ID = ?', [policyID]);

    // 4. Get emails for notification
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

    // Email content
    const subject = `Policy Document Deleted: ${policy_name}`;
    const message = `
The policy document titled "${policy_name}" (ID: ${policyID}) has been deleted from the system.

Deleted by: ${deleterRows.length ? deleterRows[0].staff_name : 'Unknown User'} (ID: ${deleterStaffID})

If you have any questions, please contact the administrator.
    `.trim();

    // Collect unique recipients
    const recipientsSet = new Set();

    if (deleterRows.length && deleterRows[0].staff_email) {
      recipientsSet.add(deleterRows[0].staff_email);
    }

    adminRows.forEach(admin => {
      if (admin.staff_email) recipientsSet.add(admin.staff_email);
    });

    departmentUsers.forEach(user => {
      if (user.staff_email) recipientsSet.add(user.staff_email);
    });

    // Send emails
    for (const email of recipientsSet) {
      try {
        await sendPolicyUpdateEmail(email, subject, message);
      } catch (emailErr) {
        console.error(`Failed to send email to ${email}:`, emailErr.message);
      }
    }

    res.status(200).json({ message: 'Policy deleted successfully and notification sent' });
  } catch (error) {
    db.end();
    console.error('Error during policy deletion:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

// Optional: Validate policy existence before deletion
router.get('/:id/validate', async (req, res) => {
  const policyID = req.params.id;
  const db = connectToDatabase();

  try {
    const [rows] = await db.promise().query(
      'SELECT policy_name FROM Policy WHERE policy_ID = ?',
      [policyID]
    );
    db.end();

    if (rows.length === 0) {
      return res.status(404).json({ valid: false, message: 'Policy not found' });
    }

    return res.json({ valid: true, policyName: rows[0].policy_name });
  } catch (err) {
    db.end();
    console.error('Validation error:', err);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
});

module.exports = router;
