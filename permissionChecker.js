const checkPermission = (db, staff_ID, policy_ID, permission_type) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM PermissionRequests
      WHERE staff_ID = ? AND policy_ID = ? AND permission_type = ? AND status = 'approved'
    `;

    db.query(sql, [staff_ID, policy_ID, permission_type], (err, results) => {
      if (err) return reject(err);
      resolve(results.length > 0);
    });
  });
};

module.exports = checkPermission;
