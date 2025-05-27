const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
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
app.use('/', loginRoutes);

// Routes

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
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
