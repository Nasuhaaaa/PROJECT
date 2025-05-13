const express = require('express');
const bodyParser = require('body-parser');
const connectToDatabase = require('./Connection_MySQL');  // Import the MySQL connection function

// Initialize Express app
const app = express();

// Middleware to parse JSON request bodies
app.use(bodyParser.json());

// Main function
function main() {
  // Call the function to connect to the database
  const dbConnection = connectToDatabase();

  dbConnection.query('SELECT * FROM Role', (err, results) => {
    if (err) {
      console.error('Database query failed:', err.stack);
      return;
    }
    console.log('Results:', results);
  });
  
  
  

}

// Call the main function to start the app
main();
