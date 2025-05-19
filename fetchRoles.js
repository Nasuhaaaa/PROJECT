const connectToDatabase = require('./Connection_MySQL');  // MySQL connection logic

// Function to fetch roles from the database
const fetchRoles = () => {
  return new Promise((resolve, reject) => {
    const dbConnection = connectToDatabase();
    const sql = 'SELECT * FROM Role'; // Query to fetch roles

    dbConnection.query(sql, (err, results) => {
      if (err) {
        reject(new Error('Error fetching roles: ' + err.message));
      } else {
        resolve(results); // Resolving the roles data
      }
      dbConnection.end(); // Close the connection after query
    });
  });
};

module.exports = fetchRoles;  // Export the fetchRoles function
