const express = require('express');
const router = express.Router();
const connectToDatabase = require('./Connection_MySQL');  // MySQL connection logic
const dbConnection = connectToDatabase();


router.post('/login', (req, res) => {
  const { staffId, password } = req.body;

  if (!staffId || !password) {
    return res.status(400).send('Missing staffId or password');
  }

  const query = 'SELECT * FROM user WHERE staff_ID = ? AND password = ?';
  dbConnection.query(query, [staffId, password], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).send('Server error');
    }

    if (results.length > 0) {
      res.send('Login successful');
    } else {
      res.status(401).send('Invalid credentials');
    }
  });
});

module.exports = router;

