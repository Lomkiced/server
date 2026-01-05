const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');

// 1. Get All Users
router.get('/', authenticateToken, userController.getUsers);

// 2. Create User
router.post('/', authenticateToken, userController.createUser);

// 3. Update User
router.put('/:id', authenticateToken, userController.updateUser);

// 4. Update User Status (Suspend/Active)
router.patch('/:id/status', authenticateToken, userController.updateUserStatus);

// 5. Delete User
router.delete('/:id', authenticateToken, userController.deleteUser);

module.exports = router;