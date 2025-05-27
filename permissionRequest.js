const express = require('express');
const router = express.Router();
const connectToDatabase = require('./Connection_MySQL');

// Connect once here to reuse connection pool if any
const db = connectToDatabase();

/**
 * POST /permission-request
 * User submits a permission request for a policy
 */
router.post('/permission-request', (req, res) => {
  const { staff_ID, policy_ID, permission_ID } = req.body;

  if (!staff_ID || !policy_ID || !permission_ID) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Insert new request (default status = Pending)
  const sql = `INSERT INTO Permission_Request (staff_ID, policy_ID, permission_ID) VALUES (?, ?, ?)`;

  db.query(sql, [staff_ID, policy_ID, permission_ID], (err, results) => {
    if (err) {
      console.error('Error inserting permission request:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ message: 'Permission request submitted', requestID: results.insertId });
  });
});

/**
 * GET /permission-request/:staffID
 * List all permission requests made by a user
 */
router.get('/permission-request/:staffID', (req, res) => {
  const staffID = req.params.staffID;

  const sql = `
    SELECT pr.request_ID, pr.policy_ID, p.policy_name, pr.permission_ID, perm.permission_name, pr.status, pr.request_date
    FROM Permission_Request pr
    JOIN Policy p ON pr.policy_ID = p.policy_ID
    JOIN Permission perm ON pr.permission_ID = perm.permission_ID
    WHERE pr.staff_ID = ?
    ORDER BY pr.request_date DESC
  `;

  db.query(sql, [staffID], (err, results) => {
    if (err) {
      console.error('Error fetching permission requests:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

/**
 * PUT /permission-request/:requestID
 * Admin approves or denies a permission request
 * Body: { status: 'Approved' | 'Denied' }
 */
router.put('/permission-request/:requestID', (req, res) => {
  const requestID = req.params.requestID;
  const { status } = req.body;

  if (!['Approved', 'Denied'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // First, update the request status
  const updateRequestSql = `UPDATE Permission_Request SET status = ? WHERE request_ID = ?`;

  db.query(updateRequestSql, [status, requestID], (err, result) => {
    if (err) {
      console.error('Error updating request status:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (status === 'Approved') {
      // If approved, insert into Access_Right (grant permission)
      // Need to get policy_ID and permission_ID from the request first
      const getRequestSql = `SELECT policy_ID, permission_ID FROM Permission_Request WHERE request_ID = ?`;

      db.query(getRequestSql, [requestID], (err2, requests) => {
        if (err2) {
          console.error('Error fetching request details:', err2);
          return res.status(500).json({ error: 'Database error' });
        }

        if (requests.length === 0) {
          return res.status(404).json({ error: 'Request not found' });
        }

        const { policy_ID, permission_ID } = requests[0];

        // Insert into Access_Right with today's date as valid_from
        const insertAccessSql = `
          INSERT INTO Access_Right (policy_ID, permission_ID, valid_from) VALUES (?, ?, CURDATE())
          ON DUPLICATE KEY UPDATE valid_from = CURDATE()
        `;

        db.query(insertAccessSql, [policy_ID, permission_ID], (err3) => {
          if (err3) {
            console.error('Error granting permission:', err3);
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({ message: 'Request approved and permission granted' });
        });
      });
    } else {
      // If denied, just respond
      res.json({ message: 'Request denied' });
    }
  });
});

/**
 * GET /access-rights/:staffID
 * List current permissions for a user
 */
router.get('/access-rights/:staffID', (req, res) => {
  const staffID = req.params.staffID;

  const sql = `
    SELECT 
      p.policy_ID,
      p.policy_name,
      perm.permission_name,
      ar.valid_from,
      ar.valid_until
    FROM Access_Right ar
    JOIN Policy p ON ar.policy_ID = p.policy_ID
    JOIN Permission perm ON ar.permission_ID = perm.permission_ID
    WHERE ar.policy_ID IN (
      SELECT policy_ID FROM Policy
    )
    ORDER BY p.policy_name, perm.permission_name
  `;

  // Optional: You can add logic to filter policies accessible by staff_ID if needed.
  // For now, returns all Access_Right entries

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching access rights:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

module.exports = router;
