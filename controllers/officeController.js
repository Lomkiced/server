const pool = require('../config/db');

// 1. GET OFFICES BY REGION OR PARENT
// 1. GET OFFICES BY REGION OR PARENT
exports.getOffices = async (req, res) => {
    try {
        const { region_id, parent_office_id, page = 1, limit = 10, search } = req.query;
        const offset = (page - 1) * limit;

        // Base Conditions
        let baseConditions = " WHERE o.status = 'Active'";
        const params = [];

        // Filter by search (name or code)
        if (search) {
            params.push(`%${search}%`);
            baseConditions += ` AND (o.name ILIKE $${params.length} OR o.code ILIKE $${params.length})`;
        }

        // Filter by region if provided
        if (region_id) {
            params.push(region_id);
            baseConditions += ` AND o.region_id = $${params.length}`;
        }

        // Filter by parent office (for sub-offices)
        // If parent_office_id is explicitly provided
        if (parent_office_id) {
            params.push(parent_office_id);
            baseConditions += ` AND o.parent_id = $${params.length}`;
        } else if (!parent_office_id && region_id) {
            // If querying by region but NOT specific parent, usually we want TOP LEVEL offices (parent_id is null)
            // However, to keep backward compatibility, we might want all.
            // Let's modify: If "toplevel=true" is passed, we filter parent_id IS NULL.
            if (req.query.toplevel === 'true') {
                baseConditions += ` AND o.parent_id IS NULL`;
            }
        }

        // Security: Non-Super Admins only see their region's offices
        if (req.user.role !== 'SUPER_ADMIN' && req.user.region_id) {
            // Ensure the region matches (already filtered by region_id if passed, but double check)
            if (!region_id) {
                params.push(req.user.region_id);
                baseConditions += ` AND o.region_id = $${params.length}`;
            }
        }

        // 1. Get Total Count
        const countQuery = `SELECT COUNT(*) FROM offices o ${baseConditions}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // 2. Get Paginated Data
        let query = `
            SELECT o.*, r.name as region_name, p.name as parent_office_name
            FROM offices o 
            LEFT JOIN regions r ON o.region_id = r.id 
            LEFT JOIN offices p ON o.parent_id = p.office_id
            ${baseConditions}
            ORDER BY o.name ASC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const dataParams = [...params, limit, offset];
        const { rows } = await pool.query(query, dataParams);

        res.json({
            data: rows,
            pagination: {
                total,
                current: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error("Get Offices Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

// 2. GET SINGLE OFFICE
exports.getOfficeById = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `SELECT o.*, r.name as region_name, p.name as parent_office_name
             FROM offices o 
             LEFT JOIN regions r ON o.region_id = r.id 
             LEFT JOIN offices p ON o.parent_id = p.office_id
             WHERE o.office_id = $1`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Office not found" });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error("Get Office Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

// 3. CREATE OFFICE (Super Admin / Regional Admin only)
exports.createOffice = async (req, res) => {
    try {
        const { name, code, description, region_id, parent_id } = req.body;

        if (!name || !code) {
            return res.status(400).json({ message: "Name and Code are required" });
        }

        // Determine target region
        let targetRegion = region_id;
        if (req.user.role !== 'SUPER_ADMIN') {
            targetRegion = req.user.region_id; // Force to own region
        }

        const { rows } = await pool.query(
            `INSERT INTO offices (name, code, description, region_id, parent_id, status) 
             VALUES ($1, $2, $3, $4, $5, 'Active') 
             RETURNING *`,
            [name, code, description || '', targetRegion, parent_id || null]
        );

        res.status(201).json({ message: "Office Created", office: rows[0] });
    } catch (err) {
        console.error("Create Office Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

// 4. UPDATE OFFICE
exports.updateOffice = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description, status, parent_id } = req.body;

        // Security: Verify ownership for non-super admins
        if (req.user.role !== 'SUPER_ADMIN') {
            const verify = await pool.query(
                "SELECT region_id FROM offices WHERE office_id = $1",
                [id]
            );
            if (verify.rows.length === 0 || verify.rows[0].region_id !== req.user.region_id) {
                return res.status(403).json({ message: "Unauthorized" });
            }
        }

        await pool.query(
            `UPDATE offices SET name = $1, code = $2, description = $3, status = $4, parent_id = $5
             WHERE office_id = $6`,
            [name, code, description, status, parent_id || null, id]
        );

        res.json({ message: "Office Updated" });
    } catch (err) {
        console.error("Update Office Error:", err);
        res.status(500).json({ message: "Update Failed" });
    }
};

// 5. DELETE OFFICE (Super Admin only)
exports.deleteOffice = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if office has records
        const recordCheck = await pool.query(
            "SELECT COUNT(*) FROM records WHERE office_id = $1",
            [id]
        );

        if (parseInt(recordCheck.rows[0].count) > 0) {
            return res.status(400).json({
                message: "Cannot delete office with existing records. Archive records first."
            });
        }

        // Check for sub-offices
        const subOfficeCheck = await pool.query(
            "SELECT COUNT(*) FROM offices WHERE parent_id = $1",
            [id]
        );

        if (parseInt(subOfficeCheck.rows[0].count) > 0) {
            return res.status(400).json({
                message: "Cannot delete office with existing sub-offices. Delete them first."
            });
        }

        await pool.query("DELETE FROM offices WHERE office_id = $1", [id]);
        res.json({ message: "Office Deleted" });
    } catch (err) {
        console.error("Delete Office Error:", err);
        res.status(500).json({ message: "Delete Failed" });
    }
};
