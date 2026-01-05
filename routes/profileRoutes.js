const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');
const { authenticateToken, scopeDataByRegion } = require('../middleware/security');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer (File Uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, 'DOC-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Apply Security Globally to these routes
router.use(authenticateToken);

// Endpoints
router.get('/', scopeDataByRegion, recordController.getRecords);
router.post('/', upload.single('file'), recordController.createRecord);
router.put('/:id/archive', scopeDataByRegion, recordController.archiveRecord);

module.exports = router;