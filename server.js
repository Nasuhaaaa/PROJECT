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
const { deleteUser } = require('./deleteUser');
const { submitRequest } = require('./request.js');
const { getPendingRequests, updateRequestStatus } = require('./Approval');

// const { exists } = require('fs'); // This is unused — can remove if not needed

const app = express();
const PORT = 3000;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));

// Route setup
app.use('/', loginRoutes);
app.use('/policy', uploadPolicyRoute);
app.use('/delete-policy', deletePolicyRoute);

// Dummy middleware placeholder for secure access (replace with actual authenticateUser middleware)
function authenticateUser(req, res, next) {
  req.user = { role_ID: 1 }; // mock admin role
  next();
}

// Secure access to uploaded files
app.use('/uploads', authenticateUser, (req, res, next) => {
  if (req.user.role_ID === 1 || req.user.role_ID === 3) {
    return express.static('uploads')(req, res, next);
  } else {
    res.status(403).send('Forbidden: You do not have permission to download files.');
  }
});

// GET: Roles and Departments
app.get('/getRoles', async (req, res) => {
  try {
    const roles = await fetchRoles();
    res.json(roles);
  } catch (err) {
    res.status(500).send('Error fetching roles: ' + err.message);
  }
});

app.get('/getDepartments', async (req, res) => {
  try {
    const departments = await fetchDepartments();
    res.json(departments);
  } catch (err) {
    res.status(500).send('Error fetching departments: ' + err.message);
  }
});

// GET: Add User Form
app.get('/addUser', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Add_User.html'));
});

// POST: Add User
app.post('/addUser', async (req, res) => {
  try {
    const userData = req.body;
    const result = await addUser(userData);
    res.send(`<h3>${result.message}</h3><a href="/addUser">Add another user</a>`);
  } catch (err) {
    res.status(400).send('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.');
  }
});

// GET: Search User
app.get('/searchUser', async (req, res) => {
  const { searchTerm } = req.query;
  try {
    const users = await searchUser(searchTerm);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Delete User
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

// POST: Edit User
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

// GET: Get user details for editing
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

// POST: Submit request
app.post('/submit-request', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    await submitRequest(req.body);
    res.status(200).json({ message: 'Request submitted successfully' }); // ✅ FIXED
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json({ error: 'Error saving request' }); // ✅ send JSON error too
  }
});


// GET: Fetch pending requests
app.get('/pending-requests', async (req, res) => {
  try {
    const rows = await getPendingRequests();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    res.status(500).send({ error: 'Internal server error' });
  }
});

// PUT: Update request status
app.put('/api/requests/:id', async (req, res) => {
  const request_ID = req.params.id;
  const { status } = req.body;
  console.log('Updating request', request_ID, 'to status', status);

  if (!['APPROVED', 'DENIED'].includes(status?.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid status. Use Approved or Denied.' });
  }

  try {
    const result = await updateRequestStatus(request_ID, status);
    res.json(result);
  } catch (err) {
    console.error('Error updating request status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET: Search policy
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

// GET: Serve approval UI
app.get('/approve', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'approve.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
