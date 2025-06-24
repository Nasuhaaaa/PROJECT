// Import required modules
const bcrypt = require('bcrypt');
const db = require('./db'); // Import the database connection
const logAuditAction = require('./logAuditAction'); // <-- Import the audit logger

// Add User Function
const addUser = async (userData) => {
    const { staff_ID, staff_name, staff_email, password, role_ID, department_ID, actor_ID } = userData;

    // Validate input
    if (!staff_ID || !staff_name || !staff_email || !password || !role_ID || !department_ID || !actor_ID) {
        throw new Error('All fields are required including actor_ID');
    }

    try {
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // SQL query
        const sql = `
            INSERT INTO User (staff_ID, staff_name, staff_email, password, role_ID, department_ID) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        // Return a promise
        return new Promise((resolve, reject) => {
            db.query(sql, [staff_ID, staff_name, staff_email, hashedPassword, role_ID, department_ID], async (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        reject(new Error('Email already exists'));
                    } else {
                        reject(new Error('Database error: ' + err.message));
                    }
                } else {
                    // ✅ Log the audit action after successful user creation
                    try {
                        await logAuditAction({
                            actor_ID: actor_ID,
                            action_type: 'ADD_USER',
                            description: `New user ${staff_ID} (${staff_name}) was registered by ${actor_ID}`,
                        });
                    } catch (auditErr) {
                        console.error('Audit log failed:', auditErr.message);
                    }

                    resolve({ message: 'User added successfully', userID: staff_ID });
                }
            });
        });
    } catch (error) {
        throw new Error('Error during registration: ' + error.message);
    }
};

module.exports = addUser;
