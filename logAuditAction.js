const connectToDatabase = require('./Connection_MySQL');

const logAuditAction = async ({ actor_ID = null, action_type, policy_ID = null, policy_name = null, description }) => {
  const db = connectToDatabase();

  let actor_name = null;

  if (actor_ID) {
    const getNameQuery = 'SELECT staff_name FROM user WHERE staff_ID = ?';
    const [rows] = await db.promise().query(getNameQuery, [actor_ID]);
    if (rows.length > 0) {
      actor_name = rows[0].staff_name;
    }
  }

  const insertQuery = `
    INSERT INTO audit (actor_ID, actor_name, action_type, policy_ID, policy_name, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  try {
    await db.promise().query(insertQuery, [actor_ID, actor_name, action_type, policy_ID, policy_name, description]);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

module.exports = logAuditAction;
