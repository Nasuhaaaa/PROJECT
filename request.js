const mysql = require('mysql2/promise');

// Adjust the credentials to your phpMyAdmin MySQL setup
const dbConfig = {
    host: '127.0.0.1',  // MySQL server address (XAMPP default is localhost)
    user: 'root',       // Default MySQL username in XAMPP is 'root'
    password: '',       // Default password is empty in XAMPP
    database: 'policy management system',  // Replace with your database name
    port: 3306
};

async function submitRequest(data) {
    const connection = await mysql.createConnection(dbConfig);
    const { staff_ID, action, policy_ID, department_ID } = data;

    const query = `
        INSERT INTO request (staff_ID, action, policy_ID, department_ID, status, request_at)
        VALUES (?, ?, ?, ?, 'Pending', CURRENT_TIMESTAMP)
    `;

    await connection.execute(query, [staff_ID, action, policy_ID, department_ID]);
    await connection.end();
}

module.exports = { submitRequest };
