const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const { logAudit } = require('../utils/auditLogger');

// Helper: Calculate Date
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

// Helper: Parse ID safely
const parseId = (id) => {
    if (id === undefined || id === null || id === '' || id === 'undefined') return null;
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? null : parsed;
};

// 1. UPLOAD RECORD
exports.createRecord = async (req, res) => {
    try {
        console.log(`--- [UPLOAD START] by User: ${req.user.username} (ID: ${req.user.id}) ---`);
        
        const { title, region_id, category_name, classification_rule, retention_period } = req.body;
        
        // --- STEP 1: RESOLVE REGION ---
        let targetRegion = null;

        if (req.user.role === 'SUPER_ADMIN') {
            targetRegion = parseId(region_id);
        } else {
            // Fetch fresh region from DB for security
            const userCheck = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [req.user.id]);
            targetRegion = userCheck.rows[0]?.region_id;
        }

        if (!targetRegion && req.user.role !== 'SUPER_ADMIN') {
            return res.status(400).json({ message: "Error: Your account is not assigned to a region." });
        }

        if (!req.file) return res.status(400).json({ message: "No file selected." });

        // --- STEP 2: PREPARE DATA ---
        const disposalDate = calculateDisposalDate(retention_period);
        const uploaderId = req.user.id; // Now guaranteed to exist

        const sql = `
            INSERT INTO records 
            (title, region_id, category, classification_rule, retention_period, disposal_date, file_path, file_size, file_type, status, uploaded_by) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING record_id
        `;

        const values = [
            title, 
            targetRegion, 
            category_name, 
            classification_rule, 
            retention_period, 
            disposalDate, 
            req.file.filename, 
            req.file.size, 
            req.file.mimetype, 
            'Active',
            uploaderId // Save the ID of the person uploading
        ];

        const { rows } = await pool.query(sql, values);
        
        await logAudit(req, 'UPLOAD_RECORD', `Uploaded "${title}" to Region ${targetRegion}`);
        console.log("✅ Upload Success. Record ID:", rows[0].record_id);
        
        res.status(201).json({ message: "Saved successfully", record_id: rows[0].record_id });

    } catch (error) {
        console.error("❌ Upload Failed:", error.message);
        res.status(500).json({ message: "Database Error", error: error.message });
    }
};

// 2. GET RECORDS (DIAGNOSTIC VERSION)
exports.getRecords = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', category, status, region } = req.query;
        const offset = (page - 1) * limit;

        // --- STEP A: RESOLVE USER REGION ---
        let userRegionId = req.user.region_id;
        
        if (req.user.role !== 'SUPER_ADMIN') {
             // Fetch fresh from DB to be 100% sure
             const userCheck = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [req.user.id]);
             
             // SAFETY CHECK: Did we find the user?
             if (userCheck.rows.length === 0) {
                 return res.status(401).json({ message: "User record not found in database." });
             }
             
             userRegionId = userCheck.rows[0]?.region_id;
             
             // LOGGING FOR DEBUGGING
             console.log(`🔍 [VIEW DEBUG] User: ${req.user.username} | Role: ${req.user.role} | Enforced Region ID: ${userRegionId}`);
        }

        // --- STEP B: BUILD QUERY ---
        // We select r.* and explicitly cast IDs to avoid mismatches
        let query = `
            SELECT r.*, reg.name as region_name, u.username as uploader_name
            FROM records r
            LEFT JOIN regions reg ON r.region_id = reg.id
            LEFT JOIN users u ON r.uploaded_by = u.user_id
            WHERE 1=1
        `;
        let params = [];
        let counter = 1;

        // --- SECURITY FILTER ---
        if (req.user.role !== 'SUPER_ADMIN') {
            // Force filtering by the user's assigned region
            // We use parseId to ensure it's an INTEGER, not a string
            query += ` AND r.region_id = $${counter++}`;
            params.push(parseId(userRegionId));
        } 
        else if (region && region !== 'All') {
            // Super Admin specific filter
            query += ` AND r.region_id = $${counter++}`;
            params.push(parseId(region));
        }

        // --- STANDARD FILTERS ---
        if (status && status !== 'All') { 
            query += ` AND r.status = $${counter++}`; 
            params.push(status); 
        }
        
        // Fix for Category Matching (Handles partial matches if folder names differ slightly)
        if (category && category !== 'All') { 
            query += ` AND r.category = $${counter++}`; 
            params.push(category); 
        }
        
        if (search) { 
            query += ` AND r.title ILIKE $${counter++}`; 
            params.push(`%${search}%`); 
        }

        query += ` ORDER BY r.uploaded_at DESC LIMIT $${counter++} OFFSET $${counter++}`;
        params.push(limit, offset);

        const { rows } = await pool.query(query, params);
        res.json({ data: rows });

    } catch (err) {
        console.error("Fetch Error:", err.message);
        res.status(500).json({ message: "Server Error: " + err.message });
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