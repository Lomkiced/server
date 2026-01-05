const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Secret Key (In production, use .env)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// 1. LOGIN USER
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if user exists
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        const user = result.rows[0];

        // Check Password
        // Note: We try both direct comparison (for seed data) and bcrypt (for new users)
        const validPassword = await bcrypt.compare(password, user.password);
        // Fallback for plain text 'password123' if seed script didn't hash it
        const plainTextMatch = password === 'password123' && user.password === 'password123';

        if (!validPassword && !plainTextMatch) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ message: "Account is suspended." });
        }

        // Generate Token
        const token = jwt.sign(
            { 
                user_id: user.user_id, 
                role: user.role, 
                region_id: user.region_id 
            }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({
            message: "Login Successful",
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
        console.error("Login Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};

// 2. GET CURRENT USER (For Persistence)
exports.getMe = async (req, res) => {
    try {
        // req.user comes from authMiddleware
        const result = await pool.query("SELECT user_id, username, role, region_id, office, status FROM users WHERE user_id = $1", [req.user.user_id]);
        
        if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};