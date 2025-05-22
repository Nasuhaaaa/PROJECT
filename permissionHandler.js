const connectToDatabase = require('./Connection_MySQL');
const db = connectToDatabase();

// Helper function to get permission ID by permission name
async function getPermissionId(permissionName) {
  const query = `SELECT permission_ID FROM Permission WHERE permission_name = ?`;
  const result = await db.query(query, [permissionName]);
  return result[0].permission_ID;
}

// Helper function to insert access rights into Access_Right table
async function insertAccessRight(documentId, permissionId, staffId) {
  const query = `
    INSERT INTO Access_Right (document_ID, permission_ID, staff_ID, valid_from)
    VALUES (?, ?, ?, CURDATE());
  `;
  await db.query(query, [documentId, permissionId, staffId]);
}

// Function to assign permissions to Admins (full access to all documents)
async function assignPermissionsToAdmins(documentId) {
  const query = `
    INSERT INTO Access_Right (Policy_ID, permission_ID, staff_ID, valid_from)
    SELECT ?, p.permission_ID, u.staff_ID, CURDATE()
    FROM User u
    JOIN Permission p ON p.permission_name IN ('View Document', 'Edit Document', 'Upload Document', 'Delete Document')
    WHERE u.role_ID = 1;  -- Admin role
  `;
  await db.query(query, [documentId]);
}

// Function to assign permissions to Editors (only documents in their department)
async function assignPermissionsToEditors(documentId) {
  const query = `
    INSERT INTO Access_Right (Policy_ID, permission_ID, staff_ID, valid_from)
    SELECT ?, p.permission_ID, u.staff_ID, CURDATE()
    FROM User u
    JOIN Permission p ON p.permission_name IN ('View Document', 'Edit Document', 'Upload Document', 'Delete Document')
    WHERE u.role_ID = 2  -- Editor role
      AND u.department_ID = (SELECT department_ID FROM Document WHERE document_ID = ?);  -- Editor's department
  `;
  await db.query(query, [documentId, documentId]);
}

// Function to assign permissions to Normal Users (view and search all documents)
async function assignPermissionsToUsers(documentId) {
  const query = `
    INSERT INTO Access_Right (policy_ID, permission_ID, staff_ID, valid_from)
    SELECT ?, p.permission_ID, u.staff_ID, CURDATE()
    FROM User u
    JOIN Permission p ON p.permission_name IN ('View Document', 'Search Document')
    WHERE u.role_ID = 3;  -- Normal User role
  `;
  await db.query(query, [documentId]);
}

module.exports = {
  assignPermissionsToAdmins,
  assignPermissionsToEditors,
  assignPermissionsToUsers,
};
