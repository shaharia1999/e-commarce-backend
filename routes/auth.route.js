const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const RoleCheck = require('../middleware/RoleCheck');
const verifyToken = require('../middleware/auth.middleware');
// const authMiddleware = require('../middleware/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
router.patch('/:id/role', verifyToken, RoleCheck(['moderator', 'admin']), authController.updateUserRole);


// Protected route example
// router.get('/profile', authMiddleware, (req, res) => {
//   res.send({ message: 'This is a protected route', user: req.user });
// });     

module.exports = router;
