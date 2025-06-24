const express = require('express');
const router = express.Router();
const { authenticateUser } = require('./auth');
const logAuditAction = require('./logAuditAction');

// Route: POST /logout
router.post('/', authenticateUser, async (req, res) => {
  try {
    const staff_ID = req.user.staff_ID;

    await logAuditAction({
      actor_ID: staff_ID,
      action_type: 'LOGOUT',
      description: `User successfully logged out`
    });

    return res.status(200).json({ message: 'Logout successful and audited.' });
  } catch (err) {
    console.error('Logout audit failed:', err.message);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
