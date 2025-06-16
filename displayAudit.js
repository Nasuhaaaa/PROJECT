// displayAudit.js
const express = require('express');
const router = express.Router();
const connectToDatabase = require('./Connection_MySQL');

router.get('/audit', (req, res) => {
  const connection = connectToDatabase();

  let query = 'SELECT * FROM audit';
  const conditions = [];
  const params = [];

  const { start, end, action, search } = req.query;

  if (start && end) {
    conditions.push('timestamp BETWEEN ? AND ?');
    params.push(start + ' 00:00:00', end + ' 23:59:59');
  }

  if (action && action !== 'ALL') {
    conditions.push('action_type = ?');
    params.push(action);
  }

  if (search) {
    conditions.push('(actor_ID LIKE ? OR actor_name LIKE ?)');
    const wildcard = `%${search}%`;
    params.push(wildcard, wildcard);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
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


// API route to get distinct action types
router.get('/audit/actions', (req, res) => {
  const connection = connectToDatabase();

  const query = 'SELECT DISTINCT action_type FROM audit ORDER BY action_type';

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching action types:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    const actions = results.map(row => row.action_type);
    res.json(actions);
  });

  connection.end();
});

module.exports = router;
