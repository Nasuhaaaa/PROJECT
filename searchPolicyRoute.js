const express = require('express');
const router = express.Router();
const searchPolicy = require('./Search_Policy'); // Your search function
const { authenticateUser } = require('./auth');   // Your JWT middleware

router.get('/search', authenticateUser, async (req, res) => {
  const searchTerm = req.query.q;

  try {
    const results = await searchPolicy(searchTerm);
    res.json(results);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Failed to search policies' });
  }
});

module.exports = router;
