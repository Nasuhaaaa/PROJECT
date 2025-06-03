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
const { exists } = require('fs');

const app = express();
const PORT = 3000;

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

app.get('/getDepartments', (req, res) => {
  fetchDepartments()
    .then(departments => res.json(departments))
    .catch(err => res.status(500).send('Error fetching departments: ' + err.message));
});

app.get('/addUser', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Add_User.html'));
});

app.post('/addUser', async (req, res) => {
  try {
    const result = await addUser(req.body);
    res.status(200).send(result.message);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

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

app.get('/searchUser', async (req, res) => {
  const { searchTerm } = req.query;
  try {
    const users = await searchUser(searchTerm);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
