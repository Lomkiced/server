const express = require('express');
const router = express.Router();
const codexController = require('../controllers/codexController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Public Read (Anyone can see rules), Admin Write
router.get('/categories', authenticateToken, codexController.getCategories);
router.post('/categories', authenticateToken, codexController.addCategory);
router.delete('/categories/:id', authenticateToken, codexController.deleteCategory);

router.get('/types', authenticateToken, codexController.getTypes);
router.post('/types', authenticateToken, codexController.addType);
router.delete('/types/:id', authenticateToken, codexController.deleteType);

module.exports = router;