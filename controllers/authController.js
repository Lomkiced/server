const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAudit } = require('../utils/auditLogger');

// 🔒 CRITICAL: This key MUST match the one in authMiddleware.js
const JWT_SECRET = process.env.JWT_SECRET || "dost_secret_key_2025_secure_fix";

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`[LOGIN] Attempt: ${username}`);

        // 1. Fetch User
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length === 0) return res.status(401).json({ message: "User not found" });

        const user = result.rows[0];

        // 2. Check Password (Secure bcrypt comparison only)
        const isPasswordValid = await bcrypt.compare(password, user.password || "");

        if (!isPasswordValid) {
            console.log(`[LOGIN] Failed: Password mismatch for ${username}`);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // 3. Status Check
        if (user.status !== 'Active' && user.status !== 'ACTIVE') {
            return res.status(403).json({ message: "Account Suspended" });
        }

        // 4. Fetch assigned sub-office IDs (for Staff access control)
        let assigned_office_ids = [];
        if (user.role === 'STAFF') {
            const assignmentsResult = await pool.query(
                `SELECT office_id FROM user_office_assignments WHERE user_id = $1`,
                [user.user_id]
            );
            assigned_office_ids = assignmentsResult.rows.map(r => r.office_id);
        }

        // 5. Sign Token (Using the Fixed Secret)
        const token = jwt.sign(
            {
                user_id: user.user_id,
                role: user.role,
                region_id: user.region_id,
                username: user.username
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 6. Success Response
        req.user = { id: user.user_id, username: user.username, role: user.role, region_id: user.region_id };
        await logAudit(req, 'LOGIN_SUCCESS', `User ${username} logged in.`);

        res.json({
            message: "Success",
            token,
            user: {
                id: user.user_id,
                username: user.username,
                role: user.role,
                region_id: user.region_id,
                office: user.office,
                assigned_office_ids // Sub-offices the Staff can access
            }
        });

    } catch (err) {
        console.error("[LOGIN ERROR]", err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getMe = async (req, res) => {
    try {
        // req.user comes from the middleware
        const result = await pool.query("SELECT user_id, username, role, region_id, office FROM users WHERE user_id = $1", [req.user.user_id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

        const user = result.rows[0];

        // Fetch assigned sub-office IDs for Staff users
        let assigned_office_ids = [];
        if (user.role === 'STAFF') {
            const assignmentsResult = await pool.query(
                `SELECT office_id FROM user_office_assignments WHERE user_id = $1`,
                [user.user_id]
            );
            assigned_office_ids = assignmentsResult.rows.map(r => r.office_id);
        }

        res.json({
            ...user,
            assigned_office_ids
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};