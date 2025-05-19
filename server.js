const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');                       // Add this import
const fetchRoles = require('./fetchRoles');  // Import the roles fetching logic
const fetchDepartments = require('./fetchDepartments');  // Import the departments fetching logic
const addUser = require('./addUser');  // Import addUser logic from Add_User.js
const uploadPolicyRoute = require('./uploadPolicy');    

const app = express();
const PORT = 3000;

// Middleware to parse form data
app.use(cors());                                         // ✅ Allow frontend to talk to backend
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));          // Serve uploaded files
app.use('/policy', uploadPolicyRoute);                   // Policy upload endpoint
app.use(bodyParser.urlencoded({ extended: true }));

// Automatically serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

//____________ADD USER SECTION____________________________________________________________________________________
// Route to fetch roles from the database
app.get('/getRoles', (req, res) => {
  fetchRoles()
    .then(roles => {
      res.json(roles);  // Send roles as JSON to the frontend
    })
    .catch(err => {
      res.status(500).send('Error fetching roles: ' + err.message);
    });
});

// Route to fetch departments from the database
app.get('/getDepartments', (req, res) => {
  fetchDepartments()
    .then(departments => {
      res.json(departments);  // Send departments as JSON to the frontend
    })
    .catch(err => {
      res.status(500).send('Error fetching departments: ' + err.message);
    });
});

app.get('/addUser', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Add_User.html'));
});

app.post('/addUser', async (req, res) => {
  try {
    const result = await addUser(req.body);
    res.status(200).send(result.message);  // success message plain text
  } catch (err) {
    res.status(400).send(err.message);     // error message plain text
  }
});

// Route to handle user form submission (POST request)
app.post('/addUser', async (req, res) => {
  try {
    const userData = req.body;  // Extract form data from the POST request
    const result = await addUser(userData);  // Call the addUser function to insert data into the database
    res.send(`<h3>${result.message}</h3><a href="/addUser">Add another user</a>`);
  } catch (err) {
    res.status(400).send(`<h3>Error: ${err.message}</h3><a href="/addUser">Try again</a>`);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
