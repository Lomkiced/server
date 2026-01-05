const pool = require('../config/db');

exports.getLogs = async (req, res) => {
    try {
        // Fetch last 100 logs (In production, you'd use pagination)
        const query = `
            SELECT * FROM audit_logs 
            ORDER BY created_at DESC 
            LIMIT 100
        `;
        
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error("Fetch Audit Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};