const express = require('express');
const fs = require('fs');
const connectToDatabase = require('./Connection_MySQL');
const { sendPolicyUpdateEmail } = require('./emailService');

const router = express.Router();

// GET all policies - to list on the frontend
router.get('/list', (req, res) => {
  const db = connectToDatabase();

  const sql = `
    SELECT policy_ID, policy_name, file_path 
    FROM Policy
    ORDER BY policy_name ASC
  `;

  db.query(sql, (err, results) => {
    db.end();
    if (err) {
      console.error('Error fetching policies:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// DELETE a policy by ID with email notification
router.delete('/:id', async (req, res) => {
  const policyID = req.params.id;
  const db = connectToDatabase();

  // For demo, hardcoding the deleter user staff_ID here
  const deleterStaffID = 'S12345'; // TODO: Replace with actual logged-in user ID from auth

  try {
    // 1. Get policy details including department_ID and policy_name, file_path
    const [policyResults] = await db.promise().query(
      'SELECT policy_name, file_path, department_ID FROM Policy WHERE policy_ID = ?',
      [policyID]
    );

    if (policyResults.length === 0) {
      db.end();
      return res.status(404).json({ error: 'Policy not found' });
    }

    const { policy_name, file_path, department_ID } = policyResults[0];

    // 2. Delete the file (async, but handle error)
    try {
      fs.unlinkSync(file_path);
      console.log(`File deleted: ${file_path}`);
    } catch (fsErr) {
      console.error('File deletion error:', fsErr);
      // Continue even if file delete fails
    }

    // 3. Delete policy record from DB
    await db.promise().query('DELETE FROM Policy WHERE policy_ID = ?', [policyID]);

    // 4. Fetch emails for notification:
    // - deleter email
    // - all admins emails (Role = Admin)
    // - all users in the same department

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
      [department_ID]
    );

    db.end();

    // Compose the notification email content
    const subject = `Policy Document Deleted: ${policy_name}`;
    const message = `
The policy document titled "${policy_name}" (ID: ${policyID}) has been deleted from the system.

Deleted by: ${deleterRows.length ? deleterRows[0].staff_name : 'Unknown User'} (ID: ${deleterStaffID})

If you have any questions, please contact the administrator.
    `.trim();

    // Prepare unique recipient emails to avoid duplicates
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

    // Send email to all recipients
    for (const email of recipientsSet) {
      try {
        await sendPolicyUpdateEmail(email, subject, message);
      } catch (emailErr) {
        console.error(`Failed to send email to ${email}:`, emailErr.message);
      }
    }

    // Respond success
    res.json({ message: 'Policy deleted successfully and notification sent' });
  } catch (error) {
    db.end();
    console.error('Error during policy deletion:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

module.exports = router;
