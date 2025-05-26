const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');                       // Add this import

const fetchRoles = require('./fetchRoles');  // Import the roles fetching logic
const fetchDepartments = require('./fetchDepartments');  // Import the departments fetching logic
const addUser = require('./addUser');  // Import addUser logic from Add_User.js
const searchUser = require('./searchUser');  // Import the searchUser function
const uploadPolicyRoute = require('./uploadPolicy');  
const searchPolicy = require('./Search_Policy');
const loginRoutes = require('./login');   
const deletePolicyRoute = require('./deletePolicy');     // <-- Added delete policy route
const editUser = require('./editUser');  // Import the logic for editing users
const { submitRequest } = require('./request.js');




const app = express();
const PORT = 3000;

// Middleware to parse form data
app.use(cors());                                         // ✅ Allow frontend to talk to backend
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));          // Serve uploaded files
app.use('/policy', uploadPolicyRoute);                   // Policy upload endpoint
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/delete-policy', deletePolicyRoute);            // <-- Mounted delete policy endpoint


// Automatically serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Login route
app.use('/', loginRoutes);


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

// POST route for /submit-request
app.post('/submit-request', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    await submitRequest(req.body);
    res.status(200).send('Request submitted successfully');
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).send('Error saving request');
  }
});

// Route to handle user form submission (POST request)-------------------------------------------
app.post('/addUser', async (req, res) => {
  try {
    const userData = req.body;  // Extract form data from the POST request
    const result = await addUser(userData);  // Call the addUser function to insert data into the database
    res.send(`<h3>${result.message}</h3><a href="/addUser">Add another user</a>`);
  } catch (err) {
    res.status(400).send('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.');
  }
});

// Route to search users
app.get('/searchUser', async (req, res) => {
  const { searchTerm } = req.query;  // Get the search term from the query parameter

  try {
    const users = await searchUser(searchTerm);  // Call the searchUser function
    res.status(200).json(users);  // Return the users that matched the search term
  } catch (error) {
    res.status(500).json({ error: error.message });  // Return error message if any
  }
});

//edit user----------------------------------------------------------------------------------------------
// Route to fetch user details (used in editUser.html)
app.get('/getUserDetails', async (req, res) => {
  const { staffID } = req.query;

  if (!staffID) {
    return res.status(400).send('Staff ID is required');
  }

  try {
    const user = await editUser.getUserDetails(staffID);
    res.json(user);
  } catch (err) {
    res.status(500).send('Error fetching user details');
  }
});

// Route to update user details
app.post('/editUser', async (req, res) => {
  const { staff_ID, staff_name, staff_email, role_ID, department_ID } = req.body;

  if (!staff_ID || !staff_name || !staff_email || !role_ID || !department_ID) {
    return res.status(400).send('All fields are required');
  }

  try {
    await editUser.updateUserDetails(staff_ID, staff_name, staff_email, role_ID, department_ID);
    res.status(200).send({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).send('Error updating user');
  }
});

// Endpoint search---------------------------------------------------------------------------------------
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


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});