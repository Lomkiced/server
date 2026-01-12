const pool = require('../config/db');

// --- PROFESSIONAL AUDIT CONTROLLER ---
exports.filteredLogs = async (req, res) => {
    try {
        const user = req.user || {};
        const role = (user.role || '').toUpperCase().trim();
        const region_id = user.region_id;
        
        // 1. EXTRACT FILTERS
        const { 
            page = 1, 
            limit = 20, 
            search = '', 
            region_filter, 
            action_filter, 
            start_date, 
            end_date 
        } = req.query;

        // DEBUG: Print what the server receives (Check your VS Code Terminal)
        console.log(`[AUDIT] User: ${user.username} (${role}) | Filters:`, req.query);

        const offset = (page - 1) * limit;

        if (role === 'STAFF') {
            return res.status(403).json({ message: "Access Denied." });
        }

        // 2. BUILD QUERY DYNAMICALLY
        let whereClause = `WHERE 1=1`;
        const queryParams = [];
        let counter = 1;

        // --- SECURITY LOCKS ---
        if (role === 'REGIONAL_ADMIN' || role === 'ADMIN') {
            // Lock to Region
            whereClause += ` AND a.region_id = $${counter++}`;
            queryParams.push(region_id);

            // Hide Super Admin Actions
            whereClause += ` AND (u.role != 'SUPER_ADMIN' OR u.role IS NULL)`;
        } 
        else if (role === 'SUPER_ADMIN') {
            // Filter by Region (if selected and valid)
            if (region_filter && region_filter !== 'ALL') {
                whereClause += ` AND a.region_id = $${counter++}`;
                queryParams.push(parseInt(region_filter)); // Ensure integer
            }
        }

        // --- SEARCH (Across Username, Action, Details) ---
        if (search && search.trim() !== '') {
            whereClause += ` AND (
                u.username ILIKE $${counter} OR 
                a.action ILIKE $${counter} OR 
                a.details ILIKE $${counter}
            )`;
            queryParams.push(`%${search.trim()}%`);
            counter++;
        }

        // --- FILTER: ACTION TYPE ---
        if (action_filter && action_filter !== 'ALL') {
            whereClause += ` AND a.action = $${counter++}`;
            queryParams.push(action_filter);
        }

        // --- FILTER: DATE RANGE ---
        if (start_date) {
            whereClause += ` AND a.created_at >= $${counter++}`;
            queryParams.push(start_date); 
        }

        if (end_date) {
            whereClause += ` AND a.created_at <= $${counter++}`;
            queryParams.push(`${end_date} 23:59:59`);
        }

        // 3. EXECUTE QUERY
        const dataQuery = `
            SELECT a.*, r.name as region_name, u.role as actor_role
            FROM audit_logs a
            LEFT JOIN regions r ON a.region_id = r.id
            LEFT JOIN users u ON a.user_id = u.user_id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT $${counter++} OFFSET $${counter++}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM audit_logs a
            LEFT JOIN regions r ON a.region_id = r.id
            LEFT JOIN users u ON a.user_id = u.user_id
            ${whereClause}
        `;

        // Add Limit/Offset to params
        const finalParams = [...queryParams, limit, offset];

        const [dataResult, countResult] = await Promise.all([
            pool.query(dataQuery, finalParams),
            pool.query(countQuery, queryParams)
        ]);

        const totalRecords = parseInt(countResult.rows[0]?.total || 0);
        const totalPages = Math.ceil(totalRecords / limit);

        res.status(200).json({
            data: dataResult.rows,
            meta: {
                total: totalRecords,
                page: parseInt(page),
                totalPages: totalPages,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("Audit Query Failed:", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getLogs = exports.filteredLogs;