const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); // Ensure this file exists (standard multer)

router.post('/', authenticateToken, upload.single('file'), recordController.createRecord);
router.get('/', authenticateToken, recordController.getRecords);

// Add these if you have the controller functions for them
// router.put('/:id', authenticateToken, recordController.updateRecord);
// router.delete('/:id', authenticateToken, recordController.deleteRecord);

module.exports = router;