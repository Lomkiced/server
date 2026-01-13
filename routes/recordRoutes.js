const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Debug Log to prove this file loaded
console.log("✅ Record Routes Loaded");

// ==========================================
// 1. SPECIFIC ACTION ROUTES (MUST BE FIRST)
// ==========================================

// Archive & Restore (Must be before /:id)
router.put('/:id/archive', authenticateToken, recordController.archiveRecord);
router.put('/:id/restore', authenticateToken, recordController.restoreRecord);

// File Access
router.get('/download/:filename', recordController.streamFile);
router.post('/verify-access/:id', authenticateToken, recordController.verifyRecordAccess);

// ==========================================
// 2. GENERAL ROUTES
// ==========================================

// Create & Read
router.post('/', authenticateToken, upload.single('file'), recordController.createRecord);
router.get('/', authenticateToken, recordController.getRecords);

// ==========================================
// 3. GENERIC ID ROUTES (MUST BE LAST)
// ==========================================

// Update Metadata (Generic PUT /:id)
router.put('/:id', authenticateToken, recordController.updateRecord);

// Delete (Generic DELETE /:id)
router.delete('/:id', authenticateToken, recordController.deleteRecord);

module.exports = router;