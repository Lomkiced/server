const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAudit } = require('../utils/auditLogger');

const JWT_SECRET = process.env.JWT_SECRET || "dost_secret_key_2025";

// ... (Keep existing helpers like calculateDisposalDate and parseId) ...
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

const parseId = (id) => (id === undefined || id === null || id === '') ? null : parseInt(id, 10);

exports.archiveRecord = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[ARCHIVE] Request received for ID: ${id}`); // Debug Log

        // Update status to 'Archived'
        const result = await pool.query(
            "UPDATE records SET status = 'Archived' WHERE record_id = $1 RETURNING title", 
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Record not found" });
        }

        const title = result.rows[0].title;
        await logAudit(req, 'ARCHIVE_RECORD', `Archived record: "${title}"`);
        
        res.json({ message: "Record archived successfully" });
    } catch (err) { 
        console.error("Archive Error:", err);
        res.status(500).json({ message: "Archive Failed" }); 
    }
};

// ... (Keep createRecord, getRecords, streamFile, updateRecord, restoreRecord, deleteRecord) ...
// Make sure restoreRecord is also correct:
exports.restoreRecord = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE records SET status = 'Active' WHERE record_id = $1", [id]);
        await logAudit(req, 'RESTORE_RECORD', `Restored record ID: ${id}`);
        res.json({ message: "Restored" });
    } catch (err) { res.status(500).json({ message: "Restore Failed" }); }
};

// Ensure other functions are maintained...
exports.createRecord = async (req, res) => {
    // ... (Your existing create logic) ...
    try {
        const { title, region_id, category_name, classification_rule, retention_period, is_restricted, file_password } = req.body;
        
        let targetRegion = null;
        if (req.user.role === 'SUPER_ADMIN') {
            targetRegion = parseId(region_id);
        } else {
            const userCheck = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [req.user.id]);
            targetRegion = userCheck.rows[0]?.region_id;
        }

        if (!targetRegion && req.user.role !== 'SUPER_ADMIN') return res.status(400).json({ message: "No assigned region." });
        if (!req.file) return res.status(400).json({ message: "No file uploaded." });

        const restricted = is_restricted === 'true'; 
        let hashedPassword = null;
        if (restricted) {
            if (!file_password) return res.status(400).json({ message: "Password required for restricted files." });
            hashedPassword = await bcrypt.hash(file_password, 10);
        }

        const disposalDate = calculateDisposalDate(retention_period);

        const sql = `
            INSERT INTO records 
            (title, region_id, category, classification_rule, retention_period, disposal_date, file_path, file_size, file_type, status, uploaded_by, is_restricted, file_password) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING record_id
        `;

        const values = [
            title, targetRegion, category_name, classification_rule, retention_period, 
            disposalDate, req.file.filename, req.file.size, req.file.mimetype, 
            'Active', req.user.id, restricted, hashedPassword
        ];

        const { rows } = await pool.query(sql, values);
        await logAudit(req, 'UPLOAD_RECORD', `Uploaded "${title}" (Restricted: ${restricted})`);
        res.status(201).json({ message: "Saved", record_id: rows[0].record_id });

    } catch (error) {
        console.error("Upload Failed:", error.message);
        res.status(500).json({ message: "Db Error", error: error.message });
    }
};

exports.getRecords = async (req, res) => {
    // ... (Your existing get logic) ...
    try {
        const { page = 1, limit = 10, search = '', category, status, region } = req.query;
        const offset = (page - 1) * limit;

        let userRegionId = req.user.region_id;
        if (req.user.role !== 'SUPER_ADMIN') {
             const userCheck = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [req.user.id]);
             userRegionId = userCheck.rows[0]?.region_id;
        }

        let query = `
            SELECT r.record_id, r.title, r.region_id, r.category, r.classification_rule, 
                   r.retention_period, r.disposal_date, r.file_path, r.file_size, r.file_type, 
                   r.status, r.uploaded_at, r.is_restricted, 
                   reg.name as region_name, u.username as uploader_name
            FROM records r
            LEFT JOIN regions reg ON r.region_id = reg.id
            LEFT JOIN users u ON r.uploaded_by = u.user_id
            WHERE 1=1
        `;
        let params = [];
        let counter = 1;

        if (req.user.role !== 'SUPER_ADMIN') {
            query += ` AND r.region_id = $${counter++}`;
            params.push(userRegionId);
        } else if (region && region !== 'All') {
            query += ` AND r.region_id = $${counter++}`;
            params.push(parseId(region));
        }

        if (status && status !== 'All') { query += ` AND r.status = $${counter++}`; params.push(status); }
        if (category && category !== 'All') { query += ` AND r.category = $${counter++}`; params.push(category); }
        if (search) { query += ` AND r.title ILIKE $${counter++}`; params.push(`%${search}%`); }

        query += ` ORDER BY r.uploaded_at DESC LIMIT $${counter++} OFFSET $${counter++}`;
        params.push(limit, offset);

        const { rows } = await pool.query(query, params);
        res.json({ data: rows });

    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};

exports.verifyRecordAccess = async (req, res) => {
    // ... (Your existing verify logic) ...
    try {
        const { id } = req.params;
        const { password } = req.body;

        const result = await pool.query("SELECT file_path, file_password, is_restricted FROM records WHERE record_id = $1", [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "File not found" });
        
        const record = result.rows[0];

        if (record.is_restricted) {
            const isMatch = await bcrypt.compare(password, record.file_password);
            if (!isMatch) {
                await logAudit(req, 'ACCESS_DENIED', `Failed password attempt for Record ID: ${id}`);
                return res.status(401).json({ success: false, message: "Incorrect Password" });
            }
        }

        const access_token = jwt.sign({ file_path: record.file_path }, JWT_SECRET, { expiresIn: '5m' });
        await logAudit(req, 'ACCESS_GRANTED', `Unlocked Record ID: ${id}`);
        res.json({ success: true, access_token });

    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};

exports.streamFile = async (req, res) => {
    // ... (Your existing stream logic) ...
    const { filename } = req.params;
    const { token } = req.query;

    try {
        const result = await pool.query("SELECT is_restricted, file_type FROM records WHERE file_path = $1", [filename]);
        
        if (result.rows.length === 0) return res.status(404).send("File record not found.");
        
        const { is_restricted, file_type } = result.rows[0];

        if (is_restricted) {
            if (!token) return res.status(403).send("Access Denied: Restricted Content.");
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded.file_path !== filename) throw new Error("Token mismatch");
            } catch (e) {
                return res.status(403).send("Session Expired or Invalid Token.");
            }
        }

        const filePath = path.join(__dirname, '../uploads', filename);
        if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', file_type || 'application/pdf'); 
            res.setHeader('Content-Disposition', 'inline'); 
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        } else {
            res.status(404).send("File missing from storage.");
        }

    } catch (err) {
        console.error("Stream Error:", err);
        res.status(500).send("Stream Error");
    }
};

exports.deleteRecord = async (req, res) => {
    // ... (Your existing delete logic) ...
    try {
        const { id } = req.params;
        const fileData = await pool.query("SELECT title, file_path FROM records WHERE record_id = $1", [id]);
        if (fileData.rows.length > 0) {
            const { title, file_path } = fileData.rows[0];
            const filePath = path.join(__dirname, '../uploads', file_path);
            if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); }
            await pool.query("DELETE FROM records WHERE record_id = $1", [id]);
            await logAudit(req, 'DELETE_RECORD', `Deleted "${title}"`);
            res.json({ message: "Deleted" });
        } else { res.status(404).json({ message: "Not found" }); }
    } catch (err) { res.status(500).json({ message: "Delete Failed" }); }
};

exports.updateRecord = async (req, res) => {
    // ... (Your existing update logic) ...
    try {
        const { id } = req.params;
        const { title, region_id, category_name, classification_rule, retention_period } = req.body;
        
        // Recalculate disposal date on update
        const disposalDate = calculateDisposalDate(retention_period);

        await pool.query(
            "UPDATE records SET title = $1, region_id = $2, category = $3, classification_rule = $4, retention_period = $5, disposal_date = $6 WHERE record_id = $7",
            [title, parseId(region_id), category_name, classification_rule, retention_period, disposalDate, id]
        );
        
        await logAudit(req, 'UPDATE_RECORD', `Updated metadata for "${title}"`);
        res.json({ message: "Updated" });
    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ message: "Update Failed" }); 
    }
};