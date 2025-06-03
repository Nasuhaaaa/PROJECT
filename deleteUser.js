const connectToDatabase = require('./Connection_MySQL');
const db = connectToDatabase();

// Function to fetch user details by staff_ID
const getUserDetails = (staffID) => {
  const sql = `
    SELECT 
      u.staff_ID,
      u.staff_name,
      u.staff_email,
      u.role_ID,
      r.role_name,  -- Join with the Role table to get the role name
      u.department_ID,
      d.department_name  -- Join with the Department table to get the department name
    FROM User u
    LEFT JOIN Role r ON u.role_ID = r.role_id
    LEFT JOIN Department d ON u.department_ID = d.department_ID
    WHERE u.staff_ID = ?
  `;

  return new Promise((resolve, reject) => {
    db.query(sql, [staffID], (err, results) => {
      if (err) {
        reject(new Error('Database error: ' + err.message));
      }
      resolve(results[0]);  // Return the first result (user details)
    });
  });
};

// Function to delete a user
const deleteUser = async (staff_ID) => {
  return new Promise((resolve, reject) => {
    const query = `
      DELETE FROM User
      WHERE staff_ID = ?
    `;
    db.query(query, [staff_ID], (err, results) => {
      if (err) {
        return reject(new Error('Database error: ' + err.message));
      }
      if (results.affectedRows === 0) {
        return reject(new Error('User not found'));
      }
      resolve(); // Deletion successful
    });
  });
};

module.exports = { getUserDetails, deleteUser };
