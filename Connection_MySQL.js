const mysql = require('mysql2');

// Function to connect to the MySQL server
function connectToDatabase() {
  const connection = mysql.createConnection({
    host: '127.0.0.1',  // MySQL server address (XAMPP default is localhost)
    user: 'root',       // Default MySQL username in XAMPP is 'root'
    password: '',       // Default password is empty in XAMPP
    database: 'policy management system',  // Replace with your database name
    port: 3306
  });

  // Establish connection
  connection.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err.stack);
      return;
    }
    console.log('Connected to MySQL database with ID:', connection.threadId);
  });

  return connection;
}

module.exports = connectToDatabase;  // Export the connection function
