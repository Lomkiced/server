const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// 1. Upload Record (POST /api/records)
router.post('/', authenticateToken, upload.single('file'), recordController.createRecord);

// 2. Get Records (GET /api/records)
router.get('/', authenticateToken, recordController.getRecords);

// 3. Update Record (PUT /api/records/:id)
router.put('/:id', authenticateToken, recordController.updateRecord);

// 4. Delete Record (DELETE /api/records/:id)
router.delete('/:id', authenticateToken, recordController.deleteRecord);

// 5. Archive Record (PATCH /api/records/:id/archive)
router.patch('/:id/archive', authenticateToken, recordController.archiveRecord);

// 6. Restore Record (PATCH /api/records/:id/restore)
router.patch('/:id/restore', authenticateToken, recordController.restoreRecord);

module.exports = router;