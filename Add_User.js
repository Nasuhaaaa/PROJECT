// Import required modules
const bcrypt = require('bcrypt');
const db = require('./db');  // Import the database connection

// Add User Function
const addUser = async (userData) => {
    const { staff_ID, staff_name, staff_email, password, role_ID, department_ID } = userData;

    // Validate input
    if (!staff_ID || !staff_name || !staff_email || !password || !role_ID || !department_ID) {
        throw new Error('All fields are required');
    }

    try {
        // Hash the password with bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // SQL query to insert a new user
        const sql = `INSERT INTO User (staff_ID, staff_name, staff_email, password, role_ID, department_ID) 
                     VALUES (?, ?, ?, ?, ?, ?)`;

        // Return a promise to handle asynchronous operation
        return new Promise((resolve, reject) => {
            db.query(sql, [staff_ID, staff_name, staff_email, hashedPassword, role_ID, department_ID], (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        reject(new Error('Email already exists'));
                    } else {
                        reject(new Error('Database error: ' + err.message));
                    }
                } else {
                    resolve({ message: 'User added successfully', userID: staff_ID });
                }
            });
        });
    } catch (error) {
        throw new Error('Error during registration: ' + error.message);
    }
};

module.exports = addUser;
