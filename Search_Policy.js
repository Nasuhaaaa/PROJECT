const connectToDatabase = require('./Connection_MySQL');
const db = connectToDatabase();
console.log('searchPolicy called');

const searchPolicy = async (searchTerm) => {
  return new Promise((resolve, reject) => {
    if (!searchTerm || typeof searchTerm !== 'string') {
      return reject(new Error('Search term is required and must be a string.'));
    }

    const like = `%${searchTerm}%`;
    const sql = `
      SELECT policy_ID, policy_name, department_ID, date_created, published_by, modified_by, file_format, file_path
      FROM Policy
      WHERE policy_name LIKE ? 
      OR published_by LIKE ? 
      OR modified_by LIKE ? 
      OR file_format LIKE ?
    `;

    db.query(sql, [like, like, like, like], (err, results) => {
      if (err) {
        console.error('Database search error:', err);
        return reject(new Error('Database error: ' + err.message));
      }
      resolve(results);
    });
  });
};

module.exports = searchPolicy;
