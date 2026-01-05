const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
// 1. IMPORT THE LOGGER
const { logAudit } = require('../utils/auditLogger');

// --- HELPER: Safe Parsing ---
const parseId = (id) => {
    if (id === undefined || id === null || id === '' || id === 'undefined') return null;
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? null : parsed;
};

// 2. UPLOAD RECORD (Now with Audit Trail)
exports.createRecord = async (req, res) => {
    try {
        console.log("--- [UPLOAD START] ---");
        const { title, region_id, category_name, classification_rule } = req.body;
        const targetRegion = parseId(region_id);
        
        if (!req.file) return res.status(400).json({ message: "No file uploaded." });

        const sql = `
            INSERT INTO records 
            (title, region_id, category, classification_rule, file_path, file_size, file_type, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
            RETURNING record_id
        `;

        const values = [
            title, targetRegion, category_name, classification_rule, 
            req.file.filename, req.file.size, req.file.mimetype
        ];

        const { rows } = await pool.query(sql, values);
        
        // --- 📝 AUDIT LOGGING ---
        // We record WHO uploaded WHAT and WHERE.
        await logAudit(req, 'UPLOAD_RECORD', `Uploaded "${title}" to Region ID: ${targetRegion}`);

        console.log("✅ Upload Success. ID:", rows[0].record_id);
        res.status(201).json({ message: "Saved", record_id: rows[0].record_id });

    } catch (error) {
        console.error("❌ Upload Failed:", error.message);
        // Log the failure too for security forensics
        logAudit(req, 'UPLOAD_FAILED', `Failed to upload "${req.body.title || 'Unknown'}": ${error.message}`);
        res.status(500).json({ message: "Db Error", error: error.message });
    }
};

// 3. GET RECORDS (Read-Only, usually no audit needed unless highly sensitive)
exports.getRecords = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', category, status, region } = req.query;
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM records WHERE 1=1`;
        let params = [];
        let counter = 1;

        if (status && status !== 'All') { query += ` AND status = $${counter++}`; params.push(status); }
        
        // Strict Region Filtering
        const regionRequested = region !== undefined && region !== 'undefined' && region !== '';
        if (regionRequested) {
            const targetRegion = parseId(region);
            if (targetRegion) { query += ` AND region_id = $${counter++}`; params.push(targetRegion); } 
            else { query += ` AND 1=0`; }
        }

        if (category && category !== 'All' && category !== 'undefined') { query += ` AND category = $${counter++}`; params.push(category); }
        if (search) { query += ` AND title ILIKE $${counter++}`; params.push(`%${search}%`); }

        query += ` ORDER BY uploaded_at DESC LIMIT $${counter++} OFFSET $${counter++}`;
        params.push(limit, offset);

        const { rows } = await pool.query(query, params);
        res.json({ data: rows, pagination: { current: parseInt(page), pages: 1, total: rows.length } });

    } catch (err) {
        console.error("❌ Fetch Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};

// 4. UPDATE RECORD
exports.updateRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, region_id, category_name, classification_rule } = req.body;

        await pool.query(
            "UPDATE records SET title = $1, region_id = $2, category = $3, classification_rule = $4 WHERE record_id = $5",
            [title, parseId(region_id), category_name, classification_rule, id]
        );

        // --- 📝 AUDIT LOGGING ---
        await logAudit(req, 'UPDATE_RECORD', `Updated metadata for Record ID: ${id}`);

        res.json({ message: "Record Updated" });
    } catch (err) {
        logAudit(req, 'UPDATE_FAILED', `Failed update on Record ID: ${req.params.id}`);
        res.status(500).json({ message: "Update Failed" });
    }
};

// 5. DELETE RECORD
exports.deleteRecord = async (req, res) => {
    try {
        const { id } = req.params;
        
        // First get details so we know what we are deleting in the logs
        const fileData = await pool.query("SELECT title, file_path FROM records WHERE record_id = $1", [id]);
        
        if (fileData.rows.length > 0) {
            const { title, file_path } = fileData.rows[0];
            const filePath = path.join(__dirname, '../uploads', file_path);
            
            if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); }

            await pool.query("DELETE FROM records WHERE record_id = $1", [id]);

            // --- 📝 AUDIT LOGGING ---
            await logAudit(req, 'DELETE_RECORD', `Permanently deleted "${title}" (ID: ${id})`);
            
            res.json({ message: "Record Deleted" });
        } else {
            res.status(404).json({ message: "Record not found" });
        }
    } catch (err) {
        console.error("Delete Error:", err);
        logAudit(req, 'DELETE_FAILED', `Error deleting Record ID: ${req.params.id}`);
        res.status(500).json({ message: "Delete Failed" });
    }
};

// 6. ARCHIVE / RESTORE
exports.archiveRecord = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE records SET status = 'Archived' WHERE record_id = $1", [id]);
        await logAudit(req, 'ARCHIVE_RECORD', `Archived Record ID: ${id}`);
        res.json({ message: "Archived" });
    } catch (err) {
        res.status(500).json({ message: "Archive Failed" });
    }
};

exports.restoreRecord = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE records SET status = 'Active' WHERE record_id = $1", [id]);
        await logAudit(req, 'RESTORE_RECORD', `Restored Record ID: ${id}`);
        res.json({ message: "Restored" });
    } catch (err) {
        res.status(500).json({ message: "Restore Failed" });
    }
};