const express = require('express');
const router = express.Router();
const connectToDatabase = require('./Connection_MySQL');
const dbConnection = connectToDatabase();
const { generateToken } = require('./auth');
const logAuditAction = require('./logAuditAction'); // <-- Add this line

router.post('/login', (req, res) => {
  const { staffId, password } = req.body;

  if (!staffId || !password) {
    return res.status(400).send('Missing staffId or password');
  }

  const query = 'SELECT * FROM user WHERE staff_ID = ?';
  dbConnection.query(query, [staffId], async (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).send('Server error');
    }

    if (results.length > 0) {
      const user = results[0];

      if (user.password === password) {
        const token = generateToken({
          username: user.staff_ID,
          role_ID: user.role_ID,
        });

        // ✅ Successful login audit log
        await logAuditAction({
          actor_ID: user.staff_ID,
          action_type: 'LOGIN',
          description: 'User successfully logged in',
        });

        return res.json({ token });
      } else {
        // ❌ Failed login with valid user ID
        await logAuditAction({
          actor_ID: user.staff_ID,
          action_type: 'FAILED_LOGIN',
          description: 'User entered incorrect password',
        });

        return res.status(401).send('Invalid credentials');
      }
    } else {
      // ❌ Failed login for non-existent user
      await logAuditAction({
        actor_ID: null,
        action_type: 'FAILED_LOGIN',
        description: `Login attempt with invalid staff ID: ${staffId}`,
      });

      return res.status(401).send('Invalid credentials');
    }
  });
});

module.exports = router;
