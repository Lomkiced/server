const pool = require('../config/db');

exports.getDashboardStats = async (req, res) => {
    try {
        const { role, region_id, id: user_id } = req.user; // Context from token
        
        let filterClause = "";
        let params = [];

        // 1. DYNAMIC FILTERING
        if (role === 'ADMIN' || role === 'REGIONAL_ADMIN') {
            filterClause = " WHERE region_id = $1";
            params = [region_id];
        } else if (role === 'STAFF') {
            filterClause = " WHERE uploaded_by = $1";
            params = [user_id];
        } 

        // 2. PARALLEL QUERIES
        const [recordStats, storageStats, disposalQueue, recentLogs] = await Promise.all([
            // A. Count
            pool.query(`SELECT COUNT(*) FROM records ${filterClause}`, params),
            
            // B. Storage
            pool.query(`SELECT SUM(file_size) as total_bytes FROM records ${filterClause}`, params),
            
            // C. DISPOSAL MONITOR (The missing piece)
            pool.query(`
                SELECT record_id, title, disposal_date, retention_period, status 
                FROM records 
                ${filterClause ? filterClause + " AND" : "WHERE"} status = 'Active' AND disposal_date IS NOT NULL
                ORDER BY disposal_date ASC 
                LIMIT 5
            `, params),

            // D. Activity Logs
            role === 'SUPER_ADMIN' 
                ? pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5")
                : pool.query(`
                    SELECT a.* FROM audit_logs a 
                    JOIN users u ON a.user_id = u.user_id 
                    WHERE u.region_id = $1 
                    ORDER BY a.created_at DESC LIMIT 5
                `, [region_id || 0])
        ]);

        // 3. REGION STATS
        let regionData = { total: 0, active: 0, inactive: 0 };
        if (role === 'SUPER_ADMIN') {
            const rStats = await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active FROM regions");
            regionData = {
                total: parseInt(rStats.rows[0].total),
                active: parseInt(rStats.rows[0].active),
                inactive: parseInt(rStats.rows[0].total) - parseInt(rStats.rows[0].active)
            };
        } else {
            regionData = { total: 1, active: 1, inactive: 0 };
        }

        // 4. USERS COUNT
        let userCountQuery = "SELECT COUNT(*) FROM users";
        let userParams = [];
        if (role !== 'SUPER_ADMIN') {
            userCountQuery += " WHERE region_id = $1";
            userParams = [region_id];
        }
        const userCount = await pool.query(userCountQuery, userParams);

        // 5. RESPONSE
        const stats = {
            users: parseInt(userCount.rows[0].count),
            records: parseInt(recordStats.rows[0].count),
            storage: parseInt(storageStats.rows[0].total_bytes) || 0,
            regions: regionData,
            recent_activity: recentLogs.rows || [],
            disposal_queue: disposalQueue.rows || [] // Ensure this is always an array
        };

        res.json(stats);

    } catch (err) {
        console.error("Dashboard Stats Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};