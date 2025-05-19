const express = require('express');
const multer = require('multer');
const path = require('path');
const connectToDatabase = require('./Connection_MySQL');

const router = express.Router();
const db = connectToDatabase();

// Configure storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // files saved here
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

// Only allow PDF and DOCX
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and DOCX files are allowed'));
  }
};

const upload = multer({ storage, fileFilter });

// Upload route
router.post('/upload', upload.single('policyFile'), (req, res) => {
  const { policy_name, department_ID, published_by, modified_by, file_format } = req.body;
  const file_path = req.file ? req.file.path : null;
  const date_now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (!file_path) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const query = `
    INSERT INTO Policy 
    (policy_name, department_ID, date_created, published_by, last_updated, modified_by, file_format, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [policy_name, department_ID, date_now, published_by, date_now, modified_by, file_format, file_path],
    (err, results) => {
      if (err) {
        console.error('Error inserting policy:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(200).json({ message: 'Policy uploaded successfully', policy_ID: results.insertId });
    }
  );
});

module.exports = router;
