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

  // Replace with real user ID from authentication middleware
  const deleterStaffID = req.user?.staff_ID || 'S12345';

  try {
    // 1. Get policy details
    const [policyResults] = await db.promise().query(
      'SELECT policy_name, file_path, department_ID FROM Policy WHERE policy_ID = ?',
      [policyID]
    );

    if (policyResults.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const { policy_name, file_path, department_ID } = policyResults[0];

    // 2. Delete file if it exists
    if (fs.existsSync(file_path)) {
      try {
        fs.unlinkSync(file_path);
        console.log(`File deleted: ${file_path}`);
      } catch (fsErr) {
        console.error('File deletion error:', fsErr);
      }
    } else {
      console.warn(`File not found, skipping delete: ${file_path}`);
    }

    // 3. Delete policy from DB
    await db.promise().query('DELETE FROM Policy WHERE policy_ID = ?', [policyID]);

    // 4. Fetch email recipients
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

    // Compose email content
    const subject = `Policy Document Deleted: ${policy_name}`;
    const message = `
The policy document titled "${policy_name}" (ID: ${policyID}) has been deleted from the system.

Deleted by: ${deleterRows[0]?.staff_name || 'Unknown User'} (ID: ${deleterStaffID})

If you have any questions, please contact the administrator.
    `.trim();

    // Collect and de-duplicate recipients
    const recipientsSet = new Set();
    if (deleterRows[0]?.staff_email) recipientsSet.add(deleterRows[0].staff_email);
    adminRows.forEach(({ staff_email }) => staff_email && recipientsSet.add(staff_email));
    departmentUsers.forEach(({ staff_email }) => staff_email && recipientsSet.add(staff_email));

    console.log('Notifying recipients:', Array.from(recipientsSet));

    // Send notifications
    for (const email of recipientsSet) {
      try {
        await sendPolicyUpdateEmail(email, subject, message);
      } catch (emailErr) {
        console.error(`Failed to send email to ${email}:`, emailErr.message);
      }
    }

    res.json({ message: 'Policy deleted successfully and notifications sent.' });
  } catch (error) {
    console.error('Error during policy deletion:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  } finally {
    db.end(); // Always close DB
  }
});

module.exports = router;
