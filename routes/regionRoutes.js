const express = require('express');
const router = express.Router();
const regionController = require('../controllers/regionController');
const { authenticateToken } = require('../middleware/authMiddleware');

// --- 🔓 PUBLIC ROUTE (Security Removed for Visibility) ---
// We removed 'authenticateToken' here so the data ALWAYS loads
router.get('/', regionController.getRegions);

// --- 🔒 PROTECTED ROUTES (Write Actions) ---
// We keep security for adding/deleting so random people can't destroy data
router.post('/', authenticateToken, regionController.createRegion);
router.put('/:id', authenticateToken, regionController.updateRegion);
router.delete('/:id', authenticateToken, regionController.deleteRegion);

module.exports = router;