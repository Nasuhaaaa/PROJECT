const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
// const session = require('express-session'); // Optional if using sessions
const app = express();
const PORT = 3000;

// JWT Auth middleware
const { authenticateUser } = require('./auth');

// Database connections
const db = require('./Connection_MySQL');
const accessPool = require('./ConnectionPool_MySQL');

// Route imports
const fetchRoles = require('./fetchRoles');
const fetchDepartments = require('./fetchDepartments');
const addUser = require('./addUser');
const searchUser = require('./searchUser');
const uploadPolicyRoute = require('./uploadPolicy');
const searchPolicy = require('./Search_Policy');
const loginRoutes = require('./login');
const logoutRoute = require('./logout');
const deletePolicyRoute = require('./deletePolicy');
const editUser = require('./editUser');
const { deleteUser } = require('./deleteUser');
const { submitRequest } = require('./request.js');
const { getPendingRequests, updateRequestStatus } = require('./Approval');
const displayAudit = require('./displayAudit');
const policyRoutes = require('./EditedPolicy');
const { getPendingEditedPolicies, approveEditedPolicy, rejectEditedPolicy } = require('./Approval'); // ⬅️ Add this to top with other imports


// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/edited_uploads', express.static(path.join(__dirname, 'edited_uploads')));

// Routes for policy upload/delete
app.use('/policy', uploadPolicyRoute);
app.use('/delete-policy', deletePolicyRoute);
app.use('/', policyRoutes);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication routes
app.use('/', loginRoutes);
app.use('/logout', logoutRoute);

// Roles
app.get('/getRoles', (req, res) => {
  fetchRoles()
    .then(roles => res.json(roles))
    .catch(err => res.status(500).send('Error fetching roles: ' + err.message));
});

// Departments
app.get('/getDepartments', async (req, res) => {
  try {
    const departments = await fetchDepartments();
    res.json(departments);
  } catch (err) {
    res.status(500).send('Error fetching departments: ' + err.message);
  }
});

// Policy IDs by department
app.get('/getPolicyIDs', async (req, res) => {
  const department_ID = req.query.department_ID;
  if (!department_ID) {
    return res.status(400).json({ error: 'Missing department_ID' });
  }

  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'policy management system',
      port: 3306
    });

    const [policies] = await connection.execute(
      'SELECT policy_ID, policy_name FROM policy WHERE department_ID = ?',
      [department_ID]
    );

    await connection.end();
    res.json(policies);
  } catch (err) {
    console.error('Error fetching policies:', err);
    res.status(500).send('Error fetching policies');
  }
});

// Add user page
app.get('/addUser', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Add_User.html'));
});

// Add user logic
app.post('/addUser', async (req, res) => {
  try {
    const result = await addUser(req.body);
    res.status(200).send(`<h3>${result.message}</h3><a href="/addUser">Add another user</a>`);
  } catch (err) {
    res.status(400).send('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.');
  }
});

// Submit request
app.post('/submit-request', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    await submitRequest(req.body);
    res.status(200).json('Request submitted successfully');
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json('Error saving request');
  }
});

// Delete user
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

// Edit user
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

// Forgot password
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgotpassword.html'));
});

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

    await connection.execute('UPDATE user SET password = ? WHERE staff_email = ?', [newPassword, email]);
    await connection.end();

    res.send('Password successfully updated.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error.');
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

// Get pending requests
app.get('/api/requests/pending', async (req, res) => {
  try {
    const rows = await getPendingRequests();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Approve/Deny request — protected with JWT
app.put('/api/requests/:id', authenticateUser, async (req, res) => {
  const request_ID = req.params.id;
  const { status } = req.body;
  const actor_ID = req.user?.staff_ID;

  console.log('Updating request', request_ID, 'to status', status, 'by actor', actor_ID);

  if (!['APPROVED', 'DENIED'].includes(status?.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid status. Use Approved or Denied.' });
  }

  if (!actor_ID) {
    return res.status(401).json({ error: 'Unauthorized: Missing actor ID' });
  }

  try {
    const result = await updateRequestStatus(request_ID, status, actor_ID);
    res.json(result);
  } catch (err) {
    console.error('Error updating request status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Audit route
app.use('/api', displayAudit);

// Audit page
app.get('/audit-table', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auditTable.html'));
});

// Check if current user has upload access
app.get('/api/has-upload-access', authenticateUser, async (req, res) => {
  const staffID = req.user.username;

  try {
    const [rows] = await accessPool.query(
      `SELECT 1 FROM access_right WHERE staff_ID = ? AND permission_ID = 4`,
      [staffID]
    );

    res.json({ hasUploadAccess: rows.length > 0 });
  } catch (err) {
    console.error('Error checking upload access:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Get pending edited policies
app.get('/api/edited-policies/pending', async (req, res) => {
  try {
    const rows = await getPendingEditedPolicies();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching edited policies:', err);
    res.status(500).json({ error: 'Failed to load pending edits' });
  }
});

// Approve edited policy
app.post('/api/policy/approve-edit', async (req, res) => {
  const { edit_id, approver_ID } = req.body;
  if (!edit_id || !approver_ID) {
    return res.status(400).json({ error: 'Missing edit_id or approver_ID' });
  }

  try {
    const result = await approveEditedPolicy(edit_id, approver_ID);
    res.status(200).json({ message: 'Policy updated successfully', result });
  } catch (err) {
    console.error('Error approving edited policy:', err);
    res.status(500).json({ error: 'Error during policy approval' });
  }
});

// Reject edited policy
app.post('/api/policy/reject-edit', async (req, res) => {
  const { edit_id, approver_ID } = req.body;
  if (!edit_id || !approver_ID) {
    return res.status(400).json({ error: 'Missing edit_id or approver_ID' });
  }

  try {
    const result = await rejectEditedPolicy(edit_id, approver_ID);
    res.status(200).json({ message: 'Policy edit rejected successfully', result });
  } catch (err) {
    console.error('Error rejecting edited policy:', err);
    res.status(500).json({ error: 'Error during policy rejection' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
