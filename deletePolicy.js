const express = require('express');
const fs = require('fs');
const connectToDatabase = require('./Connection_MySQL');

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

// DELETE a policy by ID
router.delete('/:id', (req, res) => {
  const policyID = req.params.id;
  const db = connectToDatabase();

  // Find file_path of the policy
  db.query('SELECT file_path FROM Policy WHERE policy_ID = ?', [policyID], (err, results) => {
    if (err) {
      db.end();
      console.error('DB error fetching file path:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      db.end();
      return res.status(404).json({ error: 'Policy not found' });
    }

    const filePath = results[0].file_path;

    // Delete file from uploads folder
    fs.unlink(filePath, (fsErr) => {
      if (fsErr) {
        console.error('File deletion error:', fsErr);
        // Continue with DB deletion even if file deletion failed
      }

      // Delete DB record
      db.query('DELETE FROM Policy WHERE policy_ID = ?', [policyID], (delErr) => {
        db.end();
        if (delErr) {
          console.error('Error deleting policy from DB:', delErr);
          return res.status(500).json({ error: 'Failed to delete policy from DB' });
        }
        res.json({ message: 'Policy deleted successfully' });
      });
    });
  });
});

module.exports = router;
