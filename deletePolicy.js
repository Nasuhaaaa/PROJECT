const express = require('express');
const fs = require('fs');
const connectToDatabase = require('./Connection_MySQL');
const auditPool = require('./ConnectionPool_MySQL');
const { sendPolicyUpdateEmail } = require('./emailService');
const { authenticateUser } = require('./auth');

const router = express.Router();
const db = connectToDatabase();

router.delete('/:id', authenticateUser, async (req, res) => {
  const policyID = req.params.id;
  const deleterStaffID = req.user?.username;
  const userRole = req.user?.role_ID;

  if (!deleterStaffID || userRole === undefined) {
    return res.status(401).json({ error: 'Unauthorized: Missing user data' });
  }

  db.beginTransaction(async (err) => {
    if (err) {
      console.error('Transaction start error:', err);
      return res.status(500).json({ error: 'Transaction failed' });
    }

    db.query(
      'SELECT policy_name, file_path, department_ID FROM Policy WHERE policy_ID = ?',
      [policyID],
      async (err, policyResults) => {
        if (err) {
          db.rollback(() => {});
          return res.status(500).json({ error: 'Database error (policy lookup)' });
        }

        if (policyResults.length === 0) {
          db.rollback(() => {});
          return res.status(404).json({ error: 'Policy not found' });
        }

        const { policy_name, file_path, department_ID: policyDeptID } = policyResults[0];

        db.query(
          'SELECT staff_name, department_ID FROM User WHERE staff_ID = ?',
          [deleterStaffID],
          async (err, userResults) => {
            if (err || userResults.length === 0) {
              db.rollback(() => {});
              return res.status(500).json({ error: 'Database error (user lookup)' });
            }

            const actor_name = userResults[0].staff_name;
            const userDeptID = userResults[0].department_ID;

            if (!hasDeletePermission(userRole, userDeptID, policyDeptID)) {
              await safeAuditLog({
                actor_ID: deleterStaffID,
                actor_name,
                action_type: 'UNAUTHORIZED_ACCESS',
                policy_ID: policyID,
                policy_name,
                description: `Permission denied. User ${deleterStaffID} attempted to delete policy "${policy_name}".`
              });
              db.rollback(() => {});
              return res.status(403).json({ error: 'Permission denied' });
            }

            try {
              if (fs.existsSync(file_path)) {
                fs.unlinkSync(file_path);
              }

              db.query('DELETE FROM Policy WHERE policy_ID = ?', [policyID], async (err) => {
                if (err) {
                  db.rollback(() => {});
                  return res.status(500).json({ error: 'Failed to delete policy' });
                }

                db.commit(async (err) => {
                  if (err) {
                    db.rollback(() => {});
                    return res.status(500).json({ error: 'Commit failed' });
                  }

                  await safeAuditLog({
                    actor_ID: deleterStaffID,
                    actor_name,
                    action_type: 'DELETE_DOCUMENT',
                    policy_ID: null,
                    policy_name,
                    description: `Policy "${policy_name}" (ID: ${policyID}) deleted by ${deleterStaffID}.`
                  });

                  try {
                    const [deleterRows] = await auditPool.query(
                      'SELECT staff_email, staff_name FROM User WHERE staff_ID = ?',
                      [deleterStaffID]
                    );

                    const [adminRows] = await auditPool.query(`
                      SELECT staff_email FROM User U
                      JOIN Role R ON U.role_ID = R.role_id
                      WHERE R.role_name = 'Admin'
                    `);

                    const [departmentUsers] = await auditPool.query(
                      'SELECT staff_email FROM User WHERE department_ID = ?',
                      [policyDeptID]
                    );

                    const subject = `Policy Document Deleted: ${policy_name}`;
                    const message = `
The policy document titled "${policy_name}" (ID: ${policyID}) has been deleted.

Deleted by: ${deleterRows[0]?.staff_name || 'Unknown User'} (ID: ${deleterStaffID})

If you have any questions, please contact the administrator.
                    `.trim();

                    const recipients = new Set();
                    if (deleterRows[0]?.staff_email) recipients.add(deleterRows[0].staff_email);
                    adminRows.forEach(({ staff_email }) => recipients.add(staff_email));
                    departmentUsers.forEach(({ staff_email }) => recipients.add(staff_email));

                    await Promise.allSettled(
                      [...recipients].map(email =>
                        sendPolicyUpdateEmail(email, subject, message).catch(err =>
                          console.error(`Failed to send email to ${email}: ${err.message}`)
                        )
                      )
                    );

                    res.status(200).json({ message: 'Policy deleted and notifications sent' });
                  } catch (emailErr) {
                    console.error('Notification error:', emailErr);
                    res.status(200).json({ message: 'Policy deleted, but failed to notify users' });
                  }
                });
              });
            } catch (err) {
              db.rollback(() => {});
              console.error('Error during deletion process:', err);
              res.status(500).json({ error: 'Internal server error' });
            }
          }
        );
      }
    );
  });
});

// --- Helpers ---

function hasDeletePermission(roleID, userDeptID, policyDeptID) {
  return (
    roleID === 1 || // Admin
    (roleID === 2 && userDeptID === policyDeptID) // Department Manager of same department
  );
}

async function safeAuditLog(entry, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await logAuditActionUsingPool(entry);
      return;
    } catch (err) {
      if (err.code === 'ER_LOCK_WAIT_TIMEOUT' && i < retries - 1) {
        console.warn('Retrying audit log due to lock timeout...');
        await new Promise(res => setTimeout(res, 500));
      } else {
        console.error('Audit log error:', err);
        break;
      }
    }
  }
}

async function logAuditActionUsingPool(entry) {
  const {
    actor_ID,
    actor_name,
    action_type,
    policy_ID = null,
    policy_name = null,
    description = ''
  } = entry;

  await auditPool.query(
    `INSERT INTO Audit 
     (actor_ID, actor_name, action_type, policy_ID, policy_name, description, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [actor_ID, actor_name, action_type, policy_ID, policy_name, description]
  );
}

module.exports = router;
