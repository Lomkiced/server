const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Base: /api/records

// --- 1. SPECIFIC ACTION ROUTES (PRIORITY HIGH) ---
router.put('/:id/archive', authenticateToken, recordController.archiveRecord);
router.put('/:id/restore', authenticateToken, recordController.restoreRecord);
router.get('/download/:filename', recordController.streamFile);
router.post('/verify-access/:id', authenticateToken, recordController.verifyRecordAccess);

// --- 2. GENERAL ROUTES ---
router.post('/', authenticateToken, upload.single('file'), recordController.createRecord);
router.get('/', authenticateToken, recordController.getRecords);

// --- 3. GENERIC ID ROUTES (PRIORITY LOW) ---
router.put('/:id', authenticateToken, recordController.updateRecord);
router.delete('/:id', authenticateToken, recordController.deleteRecord);

module.exports = router;