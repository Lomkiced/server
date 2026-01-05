const pool = require('../config/db');

/**
 * INTELLIGENT AUDIT LOGGER
 * Automatically resolves User ID to Username if missing from token.
 */
const logAudit = async (req, action, details) => {
    try {
        let userId = null;
        let username = 'System / Guest';

        // 1. Identify the User
        if (req.user && req.user.id) {
            userId = req.user.id;
            
            // STRATEGY: Check Token first, otherwise fetch from DB
            if (req.user.username) {
                username = req.user.username;
            } else {
                // FALLBACK: Query DB to find who User ID X is
                const userRes = await pool.query("SELECT username FROM users WHERE user_id = $1", [userId]);
                if (userRes.rows.length > 0) {
                    username = userRes.rows[0].username;
                }
            }
        } else if (req.body && req.body.username) {
             // For login attempts (where token doesn't exist yet)
             username = req.body.username;
        }

        // 2. Capture Environment
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Unknown Device';

        // 3. Record to Database
        await pool.query(
            `INSERT INTO audit_logs (user_id, username, action, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, username, action, details, ip, userAgent]
        );
        
        console.log(`📝 [AUDIT RECORDED] ${username} -> ${action}`);

    } catch (err) {
        // Silently fail so we don't crash the user's experience, but warn the admin console
        console.error("⚠️ Audit Log Error:", err.message);
    }
};

module.exports = { logAudit };