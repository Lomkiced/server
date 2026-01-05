const pool = require('../config/db');

exports.getDashboardStats = async (req, res) => {
    try {
        // 1. Run all queries in parallel for speed
        const [userCount, recordCount, regionStats, recentLogs, storageStats] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM users"),
            pool.query("SELECT COUNT(*) FROM records"),
            pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active FROM regions"),
            pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5"),
            pool.query("SELECT SUM(file_size) as total_bytes FROM records")
        ]);

        // 2. Format Data
        const stats = {
            users: parseInt(userCount.rows[0].count),
            records: parseInt(recordCount.rows[0].count),
            regions: {
                total: parseInt(regionStats.rows[0].total),
                active: parseInt(regionStats.rows[0].active),
                inactive: parseInt(regionStats.rows[0].total) - parseInt(regionStats.rows[0].active)
            },
            storage: parseInt(storageStats.rows[0].total_bytes) || 0,
            recent_activity: recentLogs.rows
        };

        res.json(stats);

    } catch (err) {
        console.error("Dashboard Stats Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};