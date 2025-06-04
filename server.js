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
const { getPendingRequests, updateRequestStatus } = require('./Approval');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public')); // serve approve.html from public folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


/* Use secure access for uploads only
app.use('/uploads', authenticateUser, (req, res, next) => {
  if (req.user.role_ID === 1 || req.user.role_ID === 3) {
    return express.static('uploads')(req, res, next);
  } else {
    res.status(403).send('Forbidden: You do not have permission to download files.');
  }
});*/

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
    console.log('Received request:', req.body);
    await submitRequest(req.body);
    res.status(200).json('Request submitted successfully');
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json('Error saving request');
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

//pending request
app.get('/api/requests/pending', async (req, res) => {
  try {
    const rows = await getPendingRequests();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    res.status(500).json({ error:'Internal server errror'});
  }
});

// POST update request status
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
