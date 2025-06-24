const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const connectToDatabase = require('./Connection_MySQL');
const { sendPolicyUpdateEmail } = require('./emailService');
const logAuditAction = require('./logAuditAction');
const { authenticateUser } = require('./auth');

const router = express.Router();
const db = connectToDatabase();

const editedDir = 'edited_uploads/';
if (!fs.existsSync(editedDir)) fs.mkdirSync(editedDir);

const allowedFormats = ['.pdf', '.docx'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowedFormats.includes(ext));
};

const editStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, editedDir),
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_');
    cb(null, 'edit-' + Date.now() + '-' + sanitized);
  }
});

const upload = multer({ storage: editStorage, fileFilter });

const normalizeFormat = (format) => {
  if (!format) return null;
  const f = format.trim().toLowerCase();
  return f.startsWith('.') ? f : '.' + f;
};

router.post('/policy/update', authenticateUser, upload.single('policyFile'), async (req, res) => {
  const { policy_ID, file_format } = req.body;
  const file = req.file;

  const modifier_ID = req.user.username;
  const userRole = req.user.role_ID;

  if (!policy_ID || !file_format || !file || !modifier_ID) {
    return res.status(400).json({ error: 'Missing required fields or file' });
  }

  try {
    const [[user]] = await db.promise().query(
      'SELECT staff_name, department_ID FROM user WHERE staff_ID = ?',
      [modifier_ID]
    );

    const [[policy]] = await db.promise().query(
      'SELECT policy_name, department_ID FROM policy WHERE policy_ID = ?',
      [policy_ID]
    );

    if (!user || !policy) {
      return res.status(404).json({ error: 'User or Policy not found' });
    }

    const actor_name = user.staff_name;
    const userDeptID = user.department_ID;
    const policyDeptID = policy.department_ID;
    const policy_name = policy.policy_name;

    const [perm] = await db.promise().query(
      'SELECT permission_ID FROM permission WHERE permission_name = "Edit Document"'
    );

    const permission_ID = perm[0]?.permission_ID;

    const [access] = await db.promise().query(`
      SELECT COUNT(*) AS count 
      FROM access_right 
      WHERE staff_ID = ? AND policy_ID = ? AND permission_ID = ?
    `, [modifier_ID, policy_ID, permission_ID]);

    const hasAccess = access[0]?.count > 0;
    const hasRoleAccess = (
      userRole === 1 ||
      (userRole === 2 && userDeptID === policyDeptID)
    );

    if (!hasAccess && !hasRoleAccess) {
      await logAuditAction({
        actor_ID: modifier_ID,
        actor_name,
        action_type: 'UNAUTHORIZED_ACCESS',
        policy_ID,
        policy_name,
        description: `Unauthorized attempt to edit policy "${policy_name}" by ${modifier_ID}`
      });
      return res.status(403).json({ error: 'Permission denied' });
    }

    req.body.modified_by = modifier_ID;
    return handleEditPolicyUpload(req, res, file_format, file, modifier_ID, userDeptID, actor_name, policy_name);

  } catch (err) {
    console.error('Access control error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleEditPolicyUpload(req, res, file_format, file, modifier_ID, department_ID, actor_name, policy_name) {
  const policy_ID = req.body.policy_ID;
  const declaredFormat = normalizeFormat(file_format);
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (!allowedFormats.includes(declaredFormat) || fileExt !== declaredFormat) {
    fs.unlink(file.path, () => {});
    return res.status(400).json({
      error: `File extension (${fileExt}) does not match declared format (${declaredFormat})`
    });
  }

  const cleanPath = file.path.replace(/\\/g, '/');

  try {
    await db.promise().query(
      'INSERT INTO edited_policy (policy_ID, modified_by, file_path, file_format, edited_at) VALUES (?, ?, ?, ?, NOW())',
      [policy_ID, modifier_ID, cleanPath, declaredFormat]
    );

    await logAuditAction({
      actor_ID: modifier_ID,
      actor_name,
      action_type: 'EDIT_DOCUMENT',
      policy_ID,
      policy_name,
      description: `Policy "${policy_name}" edited and uploaded by ${modifier_ID}`
    });

    return res.status(200).json({
      message: 'Edited policy uploaded successfully',
      fileName: file.filename,
      filePath: cleanPath,
      uploadedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Upload logic error:', err);
    return res.status(500).json({ error: 'Upload or database error' });
  }
}

module.exports = router;
