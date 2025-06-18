const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const connectToDatabase = require('./Connection_MySQL');

const router = express.Router();
const db = connectToDatabase();

const editedDir = 'edited_uploads/';
if (!fs.existsSync(editedDir)) fs.mkdirSync(editedDir);

// ✅ Multer config
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowedTypes.includes(ext));
};

const editStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, editedDir),
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_');
    cb(null, 'edit-' + Date.now() + '-' + sanitized);
  }
});

const upload = multer({ storage: editStorage, fileFilter }); // ✅ Make sure this is defined BEFORE using

// ✅ Helper
const normalizeFormat = (format) => {
  if (!format) return null;
  const f = format.trim().toLowerCase();
  return f.startsWith('.') ? f : '.' + f;
};

// ✅ POST route
router.post('/policy/update', upload.single('policyFile'), async (req, res) => {
  const { policy_ID, modified_by, file_format } = req.body;
  console.log('Form Data:', req.body);
  const file = req.file;

  if (!policy_ID || !modified_by || !file_format || !file) {
    return res.status(400).json({ error: 'Missing required fields or file' });
  }

  const declaredFormat = normalizeFormat(file_format);
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (fileExt !== declaredFormat) {
    return res.status(400).json({
      error: `File extension (${fileExt}) does not match declared format (${declaredFormat})`
    });
  }

  try {
    await db.promise().query(
      'INSERT INTO edited_policy (policy_ID, modified_by, file_path, file_format, edited_at) VALUES (?, ?, ?, ?, NOW())',
      [policy_ID, modified_by, file.path.replace(/\\/g, '/'), file_format]
    );
    res.status(200).json({ message: 'Edited policy uploaded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
