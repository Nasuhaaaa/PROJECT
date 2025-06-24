// logPolicyView.js or part of your audit routes
const express = require('express');
const router = express.Router();
const logAuditAction = require('./logAuditAction'); // path to your audit logger
const { authenticateUser } = require('./auth');

router.post('/audit/view', authenticateUser, async (req, res) => {
  const { policy_ID, policy_name } = req.body;
  const actor_ID = req.user?.username;

  if (!actor_ID || !policy_ID || !policy_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await logAuditAction({
      actor_ID,
      action_type: 'VIEW_DOCUMENT',
      policy_ID,
      policy_name,
      description: `Viewed policy "${policy_name}" (ID: ${policy_ID}).`
    });

    res.status(200).json({ message: 'Audit logged' });
  } catch (err) {
    console.error('Audit error:', err.message);
    res.status(500).json({ error: 'Failed to log audit' });
  }
});

module.exports = router;
