const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
<<<<<<< HEAD
const cors = require('cors');
const mysql = require('mysql2/promise');
const fetchRoles = require('./fetchRoles');
const fetchDepartments = require('./fetchDepartments');
const addUser = require('./addUser');
const searchUser = require('./searchUser');
const uploadPolicyRoute = require('./uploadPolicy');
const searchPolicy = require('./Search_Policy');
const loginRoutes = require('./login');
const deletePolicyRoute = require('./deletePolicy');
const editUser = require('./editUser');
const { submitRequest } = require('./request.js');
const { exists } = require('fs');
=======
const cors = require('cors');                       // Add this import

const fetchRoles = require('./fetchRoles');  // Import the roles fetching logic
const fetchDepartments = require('./fetchDepartments');  // Import the departments fetching logic
const addUser = require('./addUser');  // Import addUser logic from Add_User.js
const uploadPolicyRoute = require('./uploadPolicy');  
const searchPolicy = require('./Search_Policy'); 
const loginRoutes = require('./login');   
<<<<<<< HEAD
const editPolicyRoute = require('./EditPolicyRoutes');
>>>>>>> 7d031ce (Simpan perubahan sebelum git pull)
=======
const deletePolicyRoute = require('./deletePolicy');     // <-- Added delete policy route

const getEditConfig = require('./EditAuth'); 


>>>>>>> fb61be0 (Your message describing the changes)

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use('/policy', uploadPolicyRoute);
app.use('/delete-policy', deletePolicyRoute);
app.use(express.static(path.join(__dirname, 'public')));
<<<<<<< HEAD
<<<<<<< HEAD
app.use('/', loginRoutes);

// Routes
=======
// Serve static uploaded files 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route
app.use('/', loginRoutes); // Login
app.use('/', editPolicyRoute); // Edit
>>>>>>> 7d031ce (Simpan perubahan sebelum git pull)
=======

// Login route
app.use('/', loginRoutes);
app.use('/', getEditConfig);
>>>>>>> fb61be0 (Your message describing the changes)

// Fetch roles
app.get('/getRoles', async (req, res) => {
  try {
    const roles = await fetchRoles();
    res.json(roles);
  } catch (err) {
    res.status(500).send('Error fetching roles: ' + err.message);
  }
});

// Fetch departments
app.get('/getDepartments', async (req, res) => {
  try {
    const departments = await fetchDepartments();
    res.json(departments);
  } catch (err) {
    res.status(500).send('Error fetching departments: ' + err.message);
  }
});

// Fetch policies by department (NEW)
app.get('/getPolicyIDs', async (req, res) => {
  const { department_ID } = req.query;

  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'policy management system',
      port: 3306
    });

    let query = 'SELECT policy_ID, policy_name FROM policy';
    const params = [];

    if (department_ID) {
      query += ' WHERE department_ID = ?';
      params.push(department_ID);
    }

    query += ' ORDER BY policy_name ASC';

    const [rows] = await connection.execute(query, params);
    await connection.end();

    res.json(rows);
  } catch (err) {
    console.error('Error fetching policy IDs:', err);
    res.status(500).json({ error: 'Failed to load policy IDs' });
  }
});

// Serve addUser form
app.get('/addUser', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Add_User.html'));
});

// Add user (single POST route to avoid duplicates)
app.post('/addUser', async (req, res) => {
  try {
    const result = await addUser(req.body);
    res.status(200).send(result.message);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

<<<<<<< HEAD
// Search user
app.get('/searchUser', async (req, res) => {
  const { searchTerm } = req.query;
  try {
    const users = await searchUser(searchTerm);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//--------------------------FORGOT PASSWORD-------------------------------------------------//

// Serve forgot password form
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgotpassword.html'));
});


// Handle reset password POST (without bcrypt)
app.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'policy management system',
      port: 3306
    });

    const [users] = await connection.execute('SELECT * FROM user WHERE staff_email = ?', [email]);

    if (users.length === 0) {
      await connection.end();
      return res.send('No user found with this email.');
    }

    // Directly update password (PLAIN TEXT)
    await connection.execute('UPDATE user SET password = ? WHERE staff_email = ?', [newPassword, email]);
    await connection.end();

    res.send('Password successfully updated.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error.');
  }
});


// Edit user - get details
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

// Edit user - update details
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

// Search policy
=======
// Route to handle user form submission (POST request)
app.post('/addUser', async (req, res) => {
  try {
    const userData = req.body;  // Extract form data from the POST request
    const result = await addUser(userData);  // Call the addUser function to insert data into the database
    res.send(`<h3>${result.message}</h3><a href="/addUser">Add another user</a>`);
  } catch (err) {
    res.status(400).send('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.');
  }
});

// Endpoint search
>>>>>>> fb61be0 (Your message describing the changes)
app.get('/policy/search', async (req, res) => {
  const query = req.query.q;
  try {
    const results = await searchPolicy(query);
    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

<<<<<<< HEAD
// Submit request
app.post('/submit-request', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    await submitRequest(req.body);
    res.status(200).json({ message: 'Request submitted successfully' });
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json({ error: error.message || 'Error saving request' });
  }
=======
//Implement backend callback endpoint (EditPolicy)
app.post('/saveCallback', express.json(), (req, res) => {
  const status = req.body.status;
  const policyId = req.query.id;

  if (status === 2 || status === 6) {  // Edited and ready to be saved
    console.log(`Document for policy ${policyId} was edited.`);
    // Optional: save backup, log, or update database
    // Then redirect or mark for approval
  }

  res.status(200).json({ error: 0 });
>>>>>>> fb61be0 (Your message describing the changes)
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
