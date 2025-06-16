// displayAudit.js
const express = require('express');
const router = express.Router();
const connectToDatabase = require('./Connection_MySQL');

// API route to get audit data as JSON with optional date filter
router.get('/audit', (req, res) => {
  const connection = connectToDatabase();

  let query = 'SELECT * FROM audit';
  const params = [];

  // Check for date filtering
  const { start, end } = req.query;
  if (start && end) {
    query += ' WHERE timestamp BETWEEN ? AND ?';
    params.push(start + ' 00:00:00', end + ' 23:59:59');
  }

  query += ' ORDER BY timestamp DESC';

  connection.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching audit data:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    res.json(results);
  });

  connection.end();
});

module.exports = router;
