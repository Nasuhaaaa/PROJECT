const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');                           // ✅ Needed for frontend access
const connectToDatabase = require('./Connection_MySQL'); 
const uploadPolicyRoute = require('./uploadPolicy');
const searchPolicy = require('./Search_Policy');    

const app = express();
const port = 3000;

app.use(cors());                                         // ✅ Allow frontend to talk to backend
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));          // Serve uploaded files
app.use('/public', express.static('public'));
app.use('/policy', uploadPolicyRoute);                   // Policy upload endpoint

// Endpoint search
app.get('/policy/search', async (req, res) => {
  const query = req.query.q;
  try {
    //this will callback search function
    const results = await searchPolicy(query);
    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

//Optional: Test DB connection
const dbConnection = connectToDatabase();
dbConnection.query('SELECT * FROM Role', (err, results) => {
  if (err) {
    console.error('Database query failed:', err.stack);
    return;
  }
  console.log('Roles:', results);
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
