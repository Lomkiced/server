const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/authMiddleware');
// 1. IMPORT THE NEW AUDIT LOGGER
const { logAudit } = require('../utils/auditLogger'); 

const JWT_SECRET = process.env.JWT_SECRET || "dost_secret_key_2025";

// LOGIN ROUTE
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`[LOGIN ATTEMPT] User: ${username}`);

        // 1. Find User
        const userQuery = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        
        if (userQuery.rows.length === 0) {
            console.log("❌ User not found in database.");
            // LOG FAILURE: Unknown user
            // We pass a dummy req object with the username since we don't have a user ID yet
            logAudit({ ...req, body: { username } }, 'LOGIN_FAILED', `Unknown user tried: ${username}`);
            return res.status(401).json({ message: "Invalid Credentials (User not found)" });
        }
        
        const user = userQuery.rows[0];

        // 2. THE BACKDOOR (Allow Plain Text 'password123')
        // We check: Does the password match the hash? OR Does it match exactly as plain text?
        const isHashMatch = await bcrypt.compare(password, user.password || "");
        const isPlainMatch = (password === user.password);

        if (!isHashMatch && !isPlainMatch) {
            console.log("❌ Password Mismatch.");
            // LOG FAILURE: Wrong password
            logAudit({ ...req, user: { id: user.user_id, username: user.username } }, 'LOGIN_FAILED', `Wrong password for: ${username}`);
            return res.status(401).json({ message: "Invalid Credentials (Wrong Password)" });
        }

        // 3. LOG SUCCESS (Before sending response)
        // Manually attach user to req so the logger knows who it is
        req.user = user; 
        logAudit(req, 'LOGIN_SUCCESS', `User ${user.username} logged in securely.`);

        // 4. Issue Token
        const token = jwt.sign(
            { id: user.user_id, role: user.role, region_id: user.region_id }, 
            JWT_SECRET, 
            { expiresIn: "24h" }
        );

        console.log("🚀 Login Successful! Token issued.");

        res.json({ 
            token,
            user: {
                id: user.user_id,
                username: user.username,
                role: user.role,
                region: user.region_id,
                office: user.office
            }
        });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

// GET CURRENT USER
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;