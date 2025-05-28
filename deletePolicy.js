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
router.delete('/:id', (req, res) => {
  const policyID = req.params.id;
  const db = connectToDatabase();

  // First, get the policy details (name and file path)
  db.query('SELECT policy_name, file_path FROM Policy WHERE policy_ID = ?', [policyID], (err, results) => {
    if (err) {
      db.end();
      console.error('DB error fetching policy details:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      db.end();
      return res.status(404).json({ error: 'Policy not found' });
    }

    const { policy_name, file_path } = results[0];

    // Delete the file from the uploads folder (continue even if file deletion fails)
    fs.unlink(file_path, (fsErr) => {
      if (fsErr) {
        console.error('File deletion error:', fsErr);
      }

      // Delete the policy record from the database
      db.query('DELETE FROM Policy WHERE policy_ID = ?', [policyID], async (delErr) => {
        db.end();
        if (delErr) {
          console.error('Error deleting policy from DB:', delErr);
          return res.status(500).json({ error: 'Failed to delete policy from DB' });
        }

        // Send email notification after successful deletion
        // Replace the recipient email with the desired recipient(s)
        const to = 'admin@example.com'; // e.g., a fixed admin email address or dynamically determine recipients
        const subject = `Policy Document Deleted: ${policy_name}`;
        const message = `The policy document "${policy_name}" (ID: ${policyID}) has been deleted from the system.`;

        try {
          await sendPolicyUpdateEmail(to, subject, message);
          console.log('Email notification sent to:', to);
        } catch (emailErr) {
          console.error('Failed to send email notification:', emailErr.message);
          // Proceed even if email fails
        }

        res.json({ message: 'Policy deleted successfully and notification sent' });
      });
    });
  });
});

module.exports = router;
