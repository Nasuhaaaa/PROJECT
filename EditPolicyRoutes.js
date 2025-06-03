// EditPolicyRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Example route to receive saved file callback from OnlyOffice
router.post('/save-edited', express.json(), async (req, res) => {
  try {
    const { fileUrl, fileName } = req.body;

    // Example: Save logic for updated file
    const filePath = path.join(__dirname, 'uploadedFiles', fileName);
    const axios = require('axios');
    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    writer.on('finish', () => res.status(200).json({ message: 'File saved.' }));
    writer.on('error', (err) => {
      console.error('File save error:', err);
      res.status(500).json({ error: 'File save failed.' });
    });
  } catch (err) {
    console.error('Save-edited error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
