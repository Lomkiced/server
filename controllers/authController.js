const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAudit } = require('../utils/auditLogger'); // Ensure you have this utility

const JWT_SECRET = process.env.JWT_SECRET || "dost_secret_key_2025";

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length === 0) return res.status(401).json({ message: "Invalid credentials" });

        const user = result.rows[0];

        // Check Password (Supports both encrypted and dev 'password123')
        const isMatch = await bcrypt.compare(password, user.password || "");
        const isPlainMatch = (password === 'password123' && user.password === 'password123');

        if (!isMatch && !isPlainMatch) return res.status(401).json({ message: "Invalid credentials" });

        if (user.status !== 'Active' && user.status !== 'ACTIVE') {
            return res.status(403).json({ message: "Account is suspended." });
        }

        // PACK THE TOKEN (Crucial for Uploads to work)
        const tokenPayload = { 
            user_id: user.user_id, 
            role: user.role, 
            region_id: user.region_id, 
            username: user.username
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        // Audit Log
        req.user = user; // Hack for logger
        await logAudit(req, 'LOGIN_SUCCESS', `User ${user.username} logged in.`);

        res.json({
            message: "Login Successful",
            token,
            user: {
                id: user.user_id,
                username: user.username,
                role: user.role,
                region_id: user.region_id,
                office: user.office
            }
        });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getMe = async (req, res) => {
    try {
        const result = await pool.query("SELECT user_id, username, role, region_id, office, status FROM users WHERE user_id = $1", [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};