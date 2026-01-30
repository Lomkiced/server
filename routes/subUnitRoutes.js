const express = require('express');
const router = express.Router();
const subUnitController = require('../controllers/subUnitController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, subUnitController.getSubUnits);
router.post('/', authenticateToken, subUnitController.createSubUnit);

module.exports = router;
