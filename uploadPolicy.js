const express = require('express');
const multer = require('multer');
const path = require('path');
const connectToDatabase = require('./Connection_MySQL');
const { sendPolicyUpdateEmail } = require('./emailService'); //Import email service

const router = express.Router();
const db = connectToDatabase();

//Configure multer storage
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

const upload = multer({ storage, fileFilter });

router.post('/upload', upload.single('policyFile'), (req, res) => {
  const {
    policy_name,
    department_ID,
    published_by,
    modified_by,
    file_format
  } = req.body;

  const file_path = req.file ? req.file.path : null;
  const date_now = new Date().toISOString().split('T')[0];

  //Validation for missing fields
  if (!file_path) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!policy_name || !department_ID || !published_by || !file_format) {
    return res.status(400).json({ error: 'Missing required policy information' });
  }

  const uploadedFileExt = path.extname(req.file.originalname).toLowerCase();
  const declaredFormat = file_format.startsWith('.') ? file_format.toLowerCase() : '.' + file_format.toLowerCase();

  if (uploadedFileExt !== declaredFormat) {
    return res.status(400).json({
      error: `Uploaded file format (${uploadedFileExt}) does not match the selected format (${declaredFormat}).`
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
      modified_by && modified_by.trim() !== '' ? modified_by : null,
      file_format,
      file_path
    ],
    async (err, results) => {
      if (err) {
        console.error('Error inserting policy:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      //Send email notifications to users in the same department with enhanced message
      try {
        const [rows] = await db.promise().query(
          'SELECT staff_email FROM user WHERE department_ID = ?',
          [department_ID]
        );

        const message = `
A new policy titled "${policy_name}" has been uploaded on ${date_now}.
Please check the document management system for more details.
Uploaded by: ${published_by}.
        `.trim();

        for (const user of rows) {
          if (user.staff_email) {
            await sendPolicyUpdateEmail(user.staff_email, 'New Policy Uploaded', message);
          }
        }
      } catch (emailErr) {
        console.error('Failed to send email notifications:', emailErr.message);
        //Continue even if email fails
      }

      //Return file URL or path
      res.status(200).json({
        message: 'Policy uploaded successfully and notifications sent.',
        policy_ID: results.insertId,
        file_url: `/uploads/${path.basename(file_path)}`
      });
    }
  );
});

module.exports = router;
