const connectToDatabase = require('./Connection_MySQL');  // MySQL connection logic

const addUser = async (userData) => {
  const { staff_ID, staff_name, staff_email, password, role_ID, department_ID } = userData;

  if (!staff_ID || !staff_name || !staff_email || !password || !role_ID || !department_ID) {
    throw new Error('All fields are required');
  }

  const dbConnection = connectToDatabase();  // Get database connection

  const sql = `
    INSERT INTO User (staff_ID, staff_name, staff_email, password, role_ID, department_ID) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  return new Promise((resolve, reject) => {
    dbConnection.query(sql, [staff_ID, staff_name, staff_email, password, role_ID, department_ID], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          reject(new Error('Duplicate input in the database'));
        } else {
          reject(new Error('Database error: ' + err.message));
        }
      } else {
        resolve({ message: 'User added successfully', userID: staff_ID });
      }
    });
  });
};

module.exports = addUser;
