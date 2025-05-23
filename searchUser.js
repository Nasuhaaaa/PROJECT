const connectToDatabase = require('./Connection_MySQL');
const db = connectToDatabase();

const searchUser = async (searchTerm) => {
  return new Promise((resolve, reject) => {
    // Validate the search term
    if (!searchTerm || typeof searchTerm !== 'string') {
      return reject(new Error('Search term is required and must be a string.'));
    }

    // Prepare the search pattern for 'LIKE' query
    const like = `%${searchTerm}%`;

    // SQL query to search for users by staff_id, staff_name, or staff_email
    const sql = `
      SELECT staff_ID, staff_name, staff_email, role_ID, department_ID
      FROM User
      WHERE staff_ID LIKE ? 
      OR staff_name LIKE ? 
      OR staff_email LIKE ?
    `;

    // Execute the query with the provided search term
    db.query(sql, [like, like, like], (err, results) => {
      if (err) {
        console.error('Database search error:', err);
        return reject(new Error('Database error: ' + err.message));
      }
      resolve(results);  // Return the search results
    });
  });
};

module.exports = searchUser;
