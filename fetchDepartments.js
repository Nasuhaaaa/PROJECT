const connectToDatabase = require('./Connection_MySQL');  // MySQL connection logic

// Function to fetch departments from the database
const fetchDepartments = () => {
  return new Promise((resolve, reject) => {
    const dbConnection = connectToDatabase();
    const sql = 'SELECT * FROM Department'; // Query to fetch departments

    dbConnection.query(sql, (err, results) => {
      if (err) {
        reject(new Error('Error fetching departments: ' + err.message));
      } else {
        resolve(results); // Resolving the departments data
      }
      dbConnection.end(); // Close the connection after query
    });
  });
};

module.exports = fetchDepartments;  // Export the fetchDepartments function
