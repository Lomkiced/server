const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Only Super Admins should see this, but for now we rely on the Token
router.get('/', authenticateToken, auditController.getLogs);

module.exports = router;