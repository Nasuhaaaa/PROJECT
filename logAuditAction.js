const connectToDatabase = require('./Connection_MySQL');

const logAuditAction = async ({ actor_ID, action_type, policy_ID = null, description }) => {
  try {
    const db = await connectToDatabase();
    const query = `
      INSERT INTO audit (actor_ID, action_type, policy_ID, description)
      VALUES (?, ?, ?, ?)
    `;
    await db.execute(query, [actor_ID, action_type, policy_ID, description]);
    await db.end(); // Close the DB connection
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

module.exports = logAuditAction;
