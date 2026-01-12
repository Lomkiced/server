const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

// Helper: Calculate Disposal Date
const calculateDisposalDate = (period) => {
    if (!period || typeof period !== 'string') return null;
    const cleanPeriod = period.toLowerCase().trim();
    if (cleanPeriod.includes('permanent')) return null;
    
    const match = cleanPeriod.match(/(\d+)/);
    if (!match) return null;
    
    const years = parseInt(match[0], 10);
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString().split('T')[0];
};

// Helper: Parse ID
const parseId = (id) => (id === undefined || id === null || id === '') ? null : parseInt(id, 10);

exports.createRecord = async (req, res) => {
    try {
        console.log(`[UPLOAD] User: ${req.user.username} (ID: ${req.user.id})`);
        
        const { title, region_id, category_name, classification_rule, retention_period } = req.body;
        
        // 1. Resolve Region (Securely)
        let targetRegion = null;
        if (req.user.role === 'SUPER_ADMIN') {
            targetRegion = parseId(region_id);
        } else {
            // Double check DB
            const userCheck = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [req.user.id]);
            targetRegion = userCheck.rows[0]?.region_id;
        }

        if (!targetRegion && req.user.role !== 'SUPER_ADMIN') {
            return res.status(400).json({ message: "Account has no assigned region." });
        }

        if (!req.file) return res.status(400).json({ message: "No file uploaded." });

        // 2. Prepare Data
        const disposalDate = calculateDisposalDate(retention_period);

        const sql = `
            INSERT INTO records 
            (title, region_id, category, classification_rule, retention_period, disposal_date, file_path, file_size, file_type, status, uploaded_by) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING record_id
        `;

        const values = [
            title, targetRegion, category_name, classification_rule, retention_period, 
            disposalDate, req.file.filename, req.file.size, req.file.mimetype, 
            'Active', req.user.id
        ];

        const { rows } = await pool.query(sql, values);
        
        await logAudit(req, 'UPLOAD_RECORD', `Uploaded "${title}" to Region ${targetRegion}`);
        res.status(201).json({ message: "Saved", record_id: rows[0].record_id });

    } catch (error) {
        console.error("Upload Failed:", error.message);
        res.status(500).json({ message: "Db Error", error: error.message });
    }
};

exports.getRecords = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', category, status, region } = req.query;
        const offset = (page - 1) * limit;

        // Fetch user region
        let userRegionId = req.user.region_id;
        if (req.user.role !== 'SUPER_ADMIN') {
             const userCheck = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [req.user.id]);
             userRegionId = userCheck.rows[0]?.region_id;
        }

        let query = `
            SELECT r.*, reg.name as region_name, u.username as uploader_name
            FROM records r
            LEFT JOIN regions reg ON r.region_id = reg.id
            LEFT JOIN users u ON r.uploaded_by = u.user_id
            WHERE 1=1
        `;
        let params = [];
        let counter = 1;

        // Security Filter
        if (req.user.role !== 'SUPER_ADMIN') {
            query += ` AND r.region_id = $${counter++}`;
            params.push(userRegionId);
        } else if (region && region !== 'All') {
            query += ` AND r.region_id = $${counter++}`;
            params.push(parseId(region));
        }

        // Standard Filters
        if (status && status !== 'All') { query += ` AND r.status = $${counter++}`; params.push(status); }
        if (category && category !== 'All') { query += ` AND r.category = $${counter++}`; params.push(category); }
        if (search) { query += ` AND r.title ILIKE $${counter++}`; params.push(`%${search}%`); }

        query += ` ORDER BY r.uploaded_at DESC LIMIT $${counter++} OFFSET $${counter++}`;
        params.push(limit, offset);

        const { rows } = await pool.query(query, params);
        res.json({ data: rows });

    } catch (err) {
        console.error("Fetch Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};


exports.updateRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, region_id, category_name, classification_rule } = req.body;
        await pool.query("UPDATE records SET title = $1, region_id = $2, category = $3, classification_rule = $4 WHERE record_id = $5", [title, parseId(region_id), category_name, classification_rule, id]);
        await logAudit(req, 'UPDATE_RECORD', `Updated Record ID: ${id}`);
        res.json({ message: "Record Updated" });
    } catch (err) { res.status(500).json({ message: "Update Failed" }); }
};

exports.deleteRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const fileData = await pool.query("SELECT file_path FROM records WHERE record_id = $1", [id]);
        if (fileData.rows.length > 0) {
            const filePath = path.join(__dirname, '../uploads', fileData.rows[0].file_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            await pool.query("DELETE FROM records WHERE record_id = $1", [id]);
            await logAudit(req, 'DELETE_RECORD', `Deleted Record ID: ${id}`);
            res.json({ message: "Deleted" });
        } else { res.status(404).json({ message: "Not Found" }); }
    } catch (err) { res.status(500).json({ message: "Delete Failed" }); }
};

exports.archiveRecord = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE records SET status = 'Archived' WHERE record_id = $1", [id]);
        res.json({ message: "Archived" });
    } catch (err) { res.status(500).json({ message: "Archive Failed" }); }
};

exports.restoreRecord = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE records SET status = 'Active' WHERE record_id = $1", [id]);
        res.json({ message: "Restored" });
    } catch (err) { res.status(500).json({ message: "Restore Failed" }); }
};