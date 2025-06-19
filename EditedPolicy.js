// EditedPolicy.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const connectToDatabase = require('./Connection_MySQL');

const router = express.Router();
const db = connectToDatabase();

const editedDir = 'edited_uploads/';
if (!fs.existsSync(editedDir)) fs.mkdirSync(editedDir);

// ✅ Allowed formats
const allowedFormats = ['.pdf', '.docx'];

// ✅ Multer config
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

// ✅ Normalize format helper
const normalizeFormat = (format) => {
  if (!format) return null;
  const f = format.trim().toLowerCase();
  return f.startsWith('.') ? f : '.' + f;
};

// ✅ POST route
router.post('/policy/update', upload.single('policyFile'), async (req, res) => {
  const { policy_ID, modified_by, file_format } = req.body;
  const file = req.file;

  console.log('📥 Incoming form data:');
  console.log('policy_ID:', policy_ID);
  console.log('modified_by:', modified_by);
  console.log('file_format:', file_format);
  console.log('uploaded file:', file ? file.originalname : '❌ No file');

  if (!policy_ID || !modified_by || !file_format || !file) {
    return res.status(400).json({ error: 'Missing required fields or file' });
  }

  const declaredFormat = normalizeFormat(file_format);
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (!allowedFormats.includes(declaredFormat)) {
    return res.status(400).json({ error: 'Invalid file format declared' });
  }

  if (fileExt !== declaredFormat) {
    return res.status(400).json({
      error: `File extension (${fileExt}) does not match declared format (${declaredFormat})`
    });
  }

  const cleanPath = file.path.replace(/\\/g, '/');

  try {
    // ✅ Check if policy_ID exists before inserting
    const [existingPolicy] = await db.promise().query(
      'SELECT * FROM Policy WHERE policy_ID = ?',
      [policy_ID]
    );

    if (existingPolicy.length === 0) {
      return res.status(400).json({ error: `Policy with ID ${policy_ID} does not exist` });
    }

    // ✅ Insert into edited_policy
    await db.promise().query(
      'INSERT INTO edited_policy (policy_ID, modified_by, file_path, file_format, edited_at) VALUES (?, ?, ?, ?, NOW())',
      [policy_ID, modified_by, cleanPath, declaredFormat]
    );

    return res.status(200).json({
      message: 'Edited policy uploaded successfully',
      fileName: file.filename,
      filePath: cleanPath,
      uploadedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ DB INSERT ERROR:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;
