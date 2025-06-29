const express = require('express');
const multer = require('multer');
const path = require('path');
const connectToDatabase = require('./Connection_MySQL');
const { sendPolicyUpdateEmail } = require('./emailService');
const logAuditAction = require('./logAuditAction');
const { authenticateUser } = require('./auth');

const router = express.Router();
const db = connectToDatabase();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const sanitizeFilename = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_');
    const uniqueName = Date.now() + '-' + sanitizeFilename;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowedTypes.includes(ext) ? true : new Error('Only PDF and DOCX files are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Optional: 5 MB file size limit
});

router.post('/upload', authenticateUser, upload.single('policyFile'), (req, res) => {
  const {
    policy_name,
    file_format
  } = req.body;

  const file_path = req.file ? req.file.path : null;
  const date_now = new Date().toISOString().split('T')[0];

  const department_ID = req.user.department_ID;
  const published_by = req.user.staff_ID;
  const modified_by = req.user.staff_ID;

  if (!file_path || !policy_name || !file_format) {
    return res.status(400).json({ error: 'Missing required policy information or file' });
  }

  const uploadedExt = path.extname(req.file.originalname).toLowerCase();
  const declaredFormat = file_format.startsWith('.') ? file_format.toLowerCase() : '.' + file_format.toLowerCase();

  if (uploadedExt !== declaredFormat) {
    return res.status(400).json({
      error: `File format mismatch. You selected "${file_format}", but uploaded "${req.file.originalname}".`
    });
  }

  const query = `
    INSERT INTO Policy 
    (policy_name, department_ID, date_created, published_by, last_updated, modified_by, file_format, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [
      policy_name,
      department_ID,
      date_now,
      published_by,
      date_now,
      modified_by,
      file_format,
      file_path
    ],
    async (err, results) => {
      if (err) {
        console.error('Database insert error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const policy_ID = results.insertId;

      // Log audit
      try {
        await logAuditAction({
          actor_ID: published_by,
          action_type: 'UPLOAD_DOCUMENT',
          policy_ID,
          policy_name,
          description: `Policy "${policy_name}" uploaded`
        });
      } catch (auditErr) {
        console.error('Audit logging failed:', auditErr.message);
      }

      // Email notification
      try {
        // Fetch uploader info
        const [uploaderRows] = await db.promise().query(
          'SELECT staff_email, staff_name FROM user WHERE staff_ID = ?',
          [published_by]
        );
        const uploaderEmail = uploaderRows[0]?.staff_email;
        const uploaderName = uploaderRows[0]?.staff_name || 'Unknown User';

        // Fetch department members
        const [rows] = await db.promise().query(
          'SELECT staff_email FROM user WHERE department_ID = ?',
          [department_ID]
        );

        const message = `
A new policy titled "${policy_name}" was uploaded on ${date_now}.

Uploaded by: ${uploaderName} (ID: ${published_by})
Format: ${file_format.toUpperCase()}

Check the system for more details.
        `.trim();

        // Notify uploader
        if (uploaderEmail) {
          await sendPolicyUpdateEmail(
            uploaderEmail,
            'Your Policy Upload Was Successful',
            `Hi ${uploaderName},\n\nYour policy "${policy_name}" has been successfully uploaded to the system on ${date_now}.\n\nFile Format: ${file_format.toUpperCase()}\n\nYou can now view or manage it in the system.`
          );
        }

        // Notify other users in department
        for (const user of rows) {
          if (user.staff_email && user.staff_email !== uploaderEmail) {
            await sendPolicyUpdateEmail(user.staff_email, 'New Policy Uploaded', message);
          }
        }
      } catch (emailErr) {
        console.error('Email notification failed:', emailErr.message);
      }

      res.status(200).json({
        message: 'Upload successful, audit logged, emails sent.',
        policy_ID,
        file_url: `/uploads/${path.basename(file_path)}`
      });
    }
  );
});

module.exports = router;
