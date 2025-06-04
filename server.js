const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const cors = require('cors');
const app = express();
const PORT = 3000;
const mysql = require('mysql2/promise');

// Import route logic
const fetchRoles = require('./fetchRoles');
const fetchDepartments = require('./fetchDepartments');
const addUser = require('./addUser');
const searchUser = require('./searchUser');
const uploadPolicyRoute = require('./uploadPolicy');
const searchPolicy = require('./Search_Policy');
const loginRoutes = require('./login');
const deletePolicyRoute = require('./deletePolicy');
const editUser = require('./editUser');
const { deleteUser } = require('./deleteUser');
const { submitRequest } = require('./request.js');
const { authenticateUser } = require('./auth');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Use secure access for uploads only
app.use('/uploads', authenticateUser, (req, res, next) => {
  if (req.user.role_ID === 1 || req.user.role_ID === 3) {
    return express.static('uploads')(req, res, next);
  } else {
    res.status(403).send('Forbidden: You do not have permission to download files.');
  }
});

app.use('/policy', uploadPolicyRoute);
app.use('/delete-policy', deletePolicyRoute);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', loginRoutes);

app.get('/getRoles', (req, res) => {
  fetchRoles()
    .then(roles => res.json(roles))
    .catch(err => res.status(500).send('Error fetching roles: ' + err.message));
});

// Get departments
app.get('/getDepartments', async (req, res) => {
  try {
    const departments = await fetchDepartments();
    res.json(departments);
  } catch (err) {
    res.status(500).send('Error fetching departments: ' + err.message);
  }
});

// Add user (GET form and POST submission)
app.get('/addUser', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Add_User.html'));
});

app.post('/addUser', async (req, res) => {
  try {
    const result = await addUser(req.body);
    res.status(200).send(`<h3>${result.message}</h3><a href="/addUser">Add another user</a>`);
  } catch (err) {
    res.status(400).send('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.');
  }
});

app.post('/submit-request', async (req, res) => {
  try {
    const users = await searchUser(searchTerm);
    res.status(200).json(users);
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).send('Error saving request');
  }
});

app.post('/deleteUser', async (req, res) => {
  const { staff_ID } = req.body;

  if (!staff_ID) {
    return res.status(400).send('Missing staff_ID');
  }

  try {
    await deleteUser(staff_ID);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).send(error.message);
  }
});


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

// Get user details for editing
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

// Delete user
app.post('/deleteUser', async (req, res) => {
  const { staff_ID } = req.body;
  if (!staff_ID) {
    return res.status(400).send('Missing staff_ID');
  }

  try {
    await editUser.deleteUser(staff_ID);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// ========== Policy Search ==========

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
