const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const connectToDatabase = require('./Connection_MySQL');
const { sendPolicyUpdateEmail } = require('./emailService');

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

router.post('/policy/update', upload.single('policyFile'), async (req, res) => {
  const { policy_ID, modified_by, file_format } = req.body;
  const file = req.file;

  console.log('Incoming form data:');
  console.log('policy_ID:', policy_ID);
  console.log('modified_by:', modified_by);
  console.log('file_format:', file_format);
  console.log('uploaded file:', file ? file.originalname : 'No file');

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
    const [existingPolicy] = await db.promise().query(
      'SELECT * FROM Policy WHERE policy_ID = ?',
      [policy_ID]
    );

    if (existingPolicy.length === 0) {
      return res.status(400).json({ error: `Policy with ID ${policy_ID} does not exist` });
    }

    await db.promise().query(
      'INSERT INTO edited_policy (policy_ID, modified_by, file_path, file_format, edited_at) VALUES (?, ?, ?, ?, NOW())',
      [policy_ID, modified_by, cleanPath, declaredFormat]
    );

    // Email Notification Section
    try {
      const [editorRows] = await db.promise().query(
        'SELECT staff_name, staff_email, department_ID FROM user WHERE staff_ID = ?',
        [modified_by]
      );

      const editor = editorRows[0];
      const toActor = editor?.staff_email;
      const department_ID = editor?.department_ID;

      const [adminRows] = await db.promise().query(
        'SELECT staff_email FROM user WHERE role_ID = "Admin"'
      );
      const adminEmails = adminRows.map(row => row.staff_email).filter(Boolean);

      const [deptRows] = await db.promise().query(
        'SELECT staff_email FROM user WHERE department_ID = ? AND staff_ID != ?',
        [department_ID, modified_by]
      );
      const deptEmails = deptRows.map(row => row.staff_email).filter(Boolean);

      const uploadedAt = new Date().toLocaleString();

      // 1. Email to actor
      if (toActor) {
        const subject = `Your Policy Update: ID ${policy_ID}`;
        const message = `
Hi ${editor.staff_name},

You have successfully updated Policy ID ${policy_ID}.

File: ${file.filename}
Format: ${declaredFormat}
Uploaded At: ${uploadedAt}

This update has been shared with your department and administrators.

Regards,  
Policy Management System
        `.trim();

        await sendPolicyUpdateEmail(toActor, subject, message);
        console.log('Email sent to actor:', toActor);
      }

      // 2. Email to admins
      for (const email of adminEmails) {
        const subject = `Policy Updated by ${editor.staff_name}`;
        const message = `
Dear Admin,

Staff ${editor.staff_name} (ID: ${modified_by}) has updated Policy ID ${policy_ID}.

File: ${file.filename}
Format: ${declaredFormat}
Timestamp: ${uploadedAt}

Regards,  
Policy Management System
        `.trim();

        await sendPolicyUpdateEmail(email, subject, message);
        console.log('Email sent to admin:', email);
      }

      // 3. Email to department (excluding actor)
      for (const email of deptEmails) {
        const subject = `Policy Updated in Your Department`;
        const message = `
Hi,

Your colleague ${editor.staff_name} has updated Policy ID ${policy_ID}.

File: ${file.filename}
Format: ${declaredFormat}
Time: ${uploadedAt}

Stay informed with the latest changes.

Regards,  
Policy Management System
        `.trim();

        await sendPolicyUpdateEmail(email, subject, message);
        console.log('Email sent to department member:', email);
      }

    } catch (emailErr) {
      console.error('Email notification failed:', emailErr.message);
    }

    return res.status(200).json({
      message: 'Edited policy uploaded successfully',
      fileName: file.filename,
      filePath: cleanPath,
      uploadedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('DB INSERT ERROR:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;
