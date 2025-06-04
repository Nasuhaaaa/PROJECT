const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');                           // ✅ Needed for frontend access
const connectToDatabase = require('./Connection_MySQL'); 
const uploadPolicyRoute = require('./uploadPolicy');    
const editPolicyRoutes = require('./editPolicy');
const updatePolicyRoute = require('./Save_Policy');
const searchPolicyRoute = require('./Search_Policy');    
const deletePolicyRoute = require('./deletePolicy');     // <-- Added delete policy route
const permissionRequestRoute = require('./permissionRequest');

const app = express();
const port = 3000;

app.use(cors());                                         // ✅ Allow frontend to talk to backend
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));          // Serve uploaded files
app.use('/public', express.static('public'));
app.use('/policy', uploadPolicyRoute);                   // Policy upload endpoint
app.use('/policy', updatePolicyRoute);
app.use('/policy', editPolicyRoutes);
app.use('/api', permissionRequestRoute);
app.use('/delete-policy', deletePolicyRoute);            // <-- Mounted delete policy endpoint


// Optional: Test DB connection
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
