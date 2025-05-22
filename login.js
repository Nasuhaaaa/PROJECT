const express = require('express');
const router = express.Router();
const connectToDatabase = require('./Connection_MySQL');  // MySQL connection logic
const dbConnection = connectToDatabase();
const { generateToken } = require('./auth'); // Import generateToken from auth.js

router.post('/login', (req, res) => {
  const { staffId, password } = req.body;

  if (!staffId || !password) {
    return res.status(400).send('Missing staffId or password');
  }

  const query = 'SELECT * FROM user WHERE staff_ID = ?';
  dbConnection.query(query, [staffId], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).send('Server error');
    }

    if (results.length > 0) {
      const user = results[0];

      // Compare password (assuming plaintext comparison, if it's hashed, use bcrypt)
      if (user.password === password) {
        // Generate JWT token and include role_ID in the payload
        const token = generateToken({
          username: user.staff_ID, 
          role_ID: user.role_ID,  // Include role_ID in the JWT payload
        });
        return res.json({ token });  // Send the token to the frontend
      } else {
        return res.status(401).send('Invalid credentials');
      }
    } else {
      return res.status(401).send('Invalid credentials');
    }
  });
});

module.exports = router;
