const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAudit } = require('../utils/auditLogger');

const JWT_SECRET = process.env.JWT_SECRET || "dost_secret_key_2025_secure_fix";

// --- HELPERS ---
const calculateDisposalDate = (period) => {
    if (!period || typeof period !== 'string') return null;
    const cleanPeriod = period.toLowerCase().trim();
    if (cleanPeriod.includes('permanent')) return null;

    const match = cleanPeriod.match(/(\d+)\s*(week|month|year)/i);
    // Fallback if no unit found but number exists, assume years (legacy behavior)
    const numberMatch = cleanPeriod.match(/(\d+)/);

    if (!numberMatch) return null;

    const value = parseInt(numberMatch[0], 10);
    const date = new Date();

    if (cleanPeriod.includes('week')) {
        date.setDate(date.getDate() + (value * 7));
    } else if (cleanPeriod.includes('month')) {
        date.setMonth(date.getMonth() + value);
    } else if (cleanPeriod.includes('day')) {
        date.setDate(date.getDate() + value);
    } else {
        // Default to years if explicit 'year' or no unit
        date.setFullYear(date.getFullYear() + value);
    }

    const result = date.toISOString().split('T')[0];
    console.log(`[DISPOSAL CALC] Input: "${period}" -> Clean: "${cleanPeriod}" -> Match: ${numberMatch ? numberMatch[0] : 'null'} -> Result: ${result}`);
    return result;
};

const parseId = (id) => (id === undefined || id === null || id === '') ? null : parseInt(id, 10);

// --- 1. UPLOAD RECORD (Enhanced with office_id and master password) ---
exports.createRecord = async (req, res) => {
    try {
        const { title, region_id, office_id, category_name, classification_rule, shelf, retention_period, is_restricted, period_covered, volume, duplication, time_value, utility_value } = req.body;

        // 🔒 IDENTITY RECOVERY: Handle both 'id' and 'user_id' token formats
        const uploaderId = req.user.id || req.user.user_id;
        if (!uploaderId) return res.status(401).json({ message: "User identity lost. Please relogin." });

        let targetRegion = null;
        if (req.user.role === 'SUPER_ADMIN') {
            targetRegion = parseId(region_id);
        } else {
            const userCheck = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [uploaderId]);
            targetRegion = userCheck.rows[0]?.region_id;
        }

        if (!targetRegion && req.user.role !== 'SUPER_ADMIN') return res.status(400).json({ message: "No assigned region." });
        if (!req.file) return res.status(400).json({ message: "No file uploaded." });

        const restricted = is_restricted === 'true' || is_restricted === true;

        // For restricted files, we use MASTER PASSWORD from system_settings (not per-file)
        // The file_password column will be null; we compare against system_settings.restricted_master_password

        const disposalDate = calculateDisposalDate(retention_period);

        const sql = `
            INSERT INTO records 
            (title, region_id, office_id, category, classification_rule, shelf, retention_period, disposal_date, file_path, file_size, file_type, status, uploaded_by, is_restricted, file_password, period_covered, volume, duplication, time_value, utility_value) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING record_id
        `;

        const values = [
            title, targetRegion, parseId(office_id), category_name, classification_rule, shelf || null, retention_period,
            disposalDate, req.file.filename, req.file.size, req.file.mimetype,
            'Active', uploaderId, restricted, null, period_covered, volume, duplication, time_value, utility_value
        ];

        // --- SECURITY: Move to Restricted Folder if needed ---
        if (restricted) {
            const uploadDir = path.join(__dirname, '../uploads');
            const restrictedDir = path.join(__dirname, '../uploads/restricted');

            // Ensure restricted dir exists
            if (!fs.existsSync(restrictedDir)) fs.mkdirSync(restrictedDir, { recursive: true });

            const oldPath = path.join(uploadDir, req.file.filename);
            const newPath = path.join(restrictedDir, req.file.filename);

            // Move the file
            fs.renameSync(oldPath, newPath);
        }

        const { rows } = await pool.query(sql, values);

        await logAudit(req, 'UPLOAD_RECORD', `Uploaded "${title}" (Restricted: ${restricted})`);
        res.status(201).json({ message: "Saved", record_id: rows[0].record_id });

    } catch (error) {
        console.error("Upload Failed:", error);
        res.status(500).json({ message: "Db Error" });
    }
};



// ... (Keep existing getRecords, archiveRecord, restoreRecord, deleteRecord, updateRecord, verifyRecordAccess, streamFile) ...
// Ensure they all use the helpers defined at the top.

exports.getRecords = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', category, status, region, office_id, restricted_only } = req.query;
        const offset = (page - 1) * limit;

        // DEBUG: Log the restricted_only value
        console.log('[getRecords] restricted_only:', restricted_only, 'Type:', typeof restricted_only);

        const currentUserId = req.user.id || req.user.user_id;
        let userRegionId = req.user.region_id;

        if (req.user.role !== 'SUPER_ADMIN') {
            const userCheck = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [currentUserId]);
            userRegionId = userCheck.rows[0]?.region_id;
        }

        // Build base query and count query
        let baseConditions = " WHERE 1=1";
        let params = [];
        let counter = 1;

        // REGION FILTER
        // Super Admin, Admin, and Regional Admin can see ALL regions (use query param if provided)
        const hasFullAccess = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_ADMIN'].includes(req.user.role);

        if (hasFullAccess) {
            // Use the region from query params if provided, otherwise no filter
            if (region && region !== 'All' && region !== '') {
                baseConditions += ` AND r.region_id = $${counter++}`;
                params.push(parseId(region));
            }
        } else if (req.user.role === 'STAFF') {
            // STAFF: Restrict to their assigned region
            baseConditions += ` AND r.region_id = $${counter++}`;
            params.push(userRegionId);

            // STAFF: Restrict to their assigned sub-offices (from user_office_assignments)
            const assignmentResult = await pool.query(
                `SELECT office_id AS assigned_office_id 
                 FROM user_office_assignments 
                 WHERE user_id = $1`,
                [currentUserId]
            );

            if (assignmentResult.rows.length > 0) {
                const assignedOfficeIds = assignmentResult.rows.map(row => row.assigned_office_id);
                // Staff can see records from their assigned sub-offices
                baseConditions += ` AND r.office_id = ANY($${counter++}::int[])`;
                params.push(assignedOfficeIds);
                console.log(`[getRecords] STAFF ${currentUserId} can access offices:`, assignedOfficeIds);
            } else {
                // No sub-office assignments = no access to any records
                console.log(`[getRecords] STAFF ${currentUserId} has no office assignments, restricting all`);
                baseConditions += ` AND 1=0`; // Always false, returns nothing
            }
        } else {
            // Other roles: restrict to their assigned region
            baseConditions += ` AND r.region_id = $${counter++}`;
            params.push(userRegionId);
        }

        // GLOBAL ID SEARCH LOGIC
        // If search is a valid integer ID, we treat this as a "Direct Lookup"
        // This bypasses folders, status (Archived vs Active), and Restricted view filters
        // Only Region/ACL security is enforced (already added to baseConditions)
        const isIdSearch = search && !isNaN(search) && Number.isInteger(parseFloat(search));

        // STATUS FILTER (Global: Applies to both ID search and Text search)
        if (status && status !== 'All') {
            baseConditions += ` AND r.status = $${counter++}`;
            params.push(status);
        }

        if (isIdSearch) {
            baseConditions += ` AND r.record_id = $${counter++}::integer`;
            params.push(search);
        } else {
            // STANDARD BROWSING FILTERS (Apply only when NOT searching by ID)

            // OFFICE FILTER (Recursive: Include Sub-Offices)
            if (office_id && office_id !== 'All') {
                const oid = parseId(office_id);
                baseConditions += ` AND (r.office_id = $${counter++} OR r.office_id IN (SELECT office_id FROM offices WHERE parent_id = $${counter++}))`;
                params.push(oid, oid);
            }

            // SHELF FILTER
            const { shelf } = req.query;
            if (shelf && shelf !== 'All') {
                if (shelf === 'Unsorted') {
                    baseConditions += ` AND (r.shelf IS NULL OR r.shelf = '')`;
                } else {
                    baseConditions += ` AND r.shelf = $${counter++}`;
                    params.push(shelf);
                }
            }

            // RESTRICTED FILTER
            // Logic: Archive view shows everything. Vault shows Restricted. Normal shows Public.
            if (status !== 'Archived') {
                if (restricted_only === 'true') {
                    baseConditions += ` AND r.is_restricted = true`;
                } else {
                    baseConditions += ` AND (r.is_restricted = false OR r.is_restricted IS NULL)`;
                }
            }

            // CATEGORY
            if (category && category !== 'All') { baseConditions += ` AND r.category = $${counter++}`; params.push(category); }

            // TEXT SEARCH (Title only)
            if (search) {
                baseConditions += ` AND r.title ILIKE $${counter++}`;
                params.push(`%${search}%`);
            }
        }

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) FROM records r ${baseConditions}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data with office info
        let query = `
            SELECT r.record_id, r.title, r.region_id, r.office_id, r.category, r.classification_rule, r.shelf, 
                   r.retention_period, r.disposal_date, r.file_path, r.file_size, r.file_type, 
                   r.status, r.uploaded_at, r.is_restricted,
                   r.period_covered, r.volume, r.duplication, r.time_value, r.utility_value, 
                   reg.name as region_name, u.username as uploader_name,
                   o.name as office_name, o.code as office_code
            FROM records r
            LEFT JOIN regions reg ON r.region_id = reg.id
            LEFT JOIN offices o ON r.office_id = o.office_id
            LEFT JOIN users u ON r.uploaded_by = u.user_id
            ${baseConditions}
            ORDER BY r.uploaded_at DESC 
            LIMIT $${counter++} OFFSET $${counter++}
        `;
        params.push(limit, offset);

        const { rows } = await pool.query(query, params);

        res.json({
            data: rows,
            pagination: {
                total,
                current: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error("Get Records Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getShelves = async (req, res) => {
    try {
        const { region_id, office_id, category, restricted_only } = req.query;

        // DEBUG: Log the restricted_only value
        console.log('--- [getShelves] REQUEST ---');
        console.log('Region:', region_id);
        console.log('Office:', office_id);
        console.log('Category:', category);
        console.log('RestrictedOnly:', restricted_only);
        // DEBUG: Log the restricted_only value
        console.log('[getShelves] restricted_only:', restricted_only, 'Type:', typeof restricted_only);

        if (!region_id || !category) {
            const missing = [];
            if (!region_id) missing.push("region_id");
            if (!category) missing.push("category");
            return res.status(400).json({ message: `Missing filters: ${missing.join(', ')}` });
        }

        // Sanitize
        const cleanCategory = decodeURIComponent(category).trim();
        const cleanRegion = parseId(region_id);
        const cleanOffice = parseId(office_id);

        // DEBUG: JSON.stringify to see hidden chars
        console.log('--- [getShelves] SANITIZED ---');
        console.log('Region:', cleanRegion);
        console.log('Office:', cleanOffice);
        console.log('Category:', JSON.stringify(cleanCategory));

        const params = [cleanRegion];
        let query = `
            SELECT DISTINCT shelf 
            FROM records 
            WHERE region_id = $1 
            AND status = 'Active'
        `;

        // CATEGORY FILTER ($2)
        query += ` AND category = $2`;
        params.push(cleanCategory.trim());

        // OFFICE FILTER LOGIC ($3 if exists)
        if (cleanOffice) {
            query += ` AND (office_id = $3 OR office_id IN (SELECT office_id FROM offices WHERE parent_id = $3))`;
            params.push(cleanOffice);
        } else {
            query += ` AND office_id IS NULL`;
        }

        // Counter for next params (Staff Access checks, Restricted, etc)
        // calculated based on current params length
        let counter = params.length + 1;

        // STAFF SUB-OFFICE ACCESS CONTROL
        if (req.user && req.user.role === 'STAFF') {
            const currentUserId = req.user.id || req.user.user_id;
            const assignmentResult = await pool.query(
                `SELECT office_id AS assigned_office_id 
                 FROM user_office_assignments 
                 WHERE user_id = $1`,
                [currentUserId]
            );

            if (assignmentResult.rows.length > 0) {
                const assignedOfficeIds = assignmentResult.rows.map(row => row.assigned_office_id);
                // Allow access to Assigned Offices OR Province Level (NULL or 0)
                query += ` AND (office_id = ANY($${counter++}::int[]) OR office_id IS NULL OR office_id = 0)`;
                params.push(assignedOfficeIds);
            } else {
                // If no office assigned, they can ONLY see Province Level
                query += ` AND (office_id IS NULL OR office_id = 0)`;
            }
        }

        // RESTRICTED FILTER (Complete Separation)
        if (restricted_only === 'true') {
            query += ` AND is_restricted = true`;
        } else {
            // Normal mode: Only show shelves that have NON-restricted files
            query += ` AND (is_restricted = false OR is_restricted IS NULL)`;
        }

        query += ` ORDER BY shelf ASC`;

        const { rows } = await pool.query(query, params);

        let shelves = rows.map(r => r.shelf || 'Unsorted').filter((v, i, a) => a.indexOf(v) === i);

        // --- DEEP DEBUG IF EMPTY ---
        if (shelves.length === 0) {
            console.log('--- QUERY RETURNED 0. RUNNING DIAGNOSTICS ---');
            const debugLog = [];

            // 1. Check without Category
            const resNoCat = await pool.query(`SELECT count(*) FROM records WHERE region_id = $1 AND (office_id = $2 OR office_id IN (SELECT office_id FROM offices WHERE parent_id = $2)) AND status = 'Active' AND is_restricted = $3`, [cleanRegion, cleanOffice, restricted_only === 'true']);
            debugLog.push(`IgnoreCategory: Found ${resNoCat.rows[0].count}`);

            // 2. Check without Office (Global in Region + Category)
            const resNoOffice = await pool.query("SELECT count(*) FROM records WHERE region_id = $1 AND category = $2 AND status = 'Active' AND is_restricted = $3", [cleanRegion, cleanCategory, restricted_only === 'true']);
            debugLog.push(`IgnoreOffice: Found ${resNoOffice.rows[0].count}`);

            // 3. Check EXACT Category match (binary)
            const resCatCheck = await pool.query("SELECT category FROM records WHERE region_id = $1 AND is_restricted = $2 LIMIT 1", [cleanRegion, restricted_only === 'true']);
            if (resCatCheck.rows.length > 0) {
                const dbCat = resCatCheck.rows[0].category;
                debugLog.push(`DBCat Sample: "${dbCat}" vs Input: "${cleanCategory}" (Equal? ${dbCat === cleanCategory})`);
            }

            console.log(debugLog);
            // Attach to array (Hack but works for axios)
            // shelves.debug_info = debugLog.join(' | '); 
            // Better: Send a header? No, just log it here and rely on server logs for ME. 
            // Wait, for the USER to see it, I need to send it.
            // I will wrap response if empty? No breaks validation.
            // I will append a dummy shelf with the error if dev mode?

            // Let's attach as header
            res.set('X-Debug-Trace', JSON.stringify(debugLog));
        }

        res.json(shelves);
    } catch (err) {
        console.error("Get Shelves Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.deleteShelf = async (req, res) => {
    try {
        const { region_id, office_id, category, shelf } = req.body;
        if (!region_id || !office_id || !category || !shelf) return res.status(400).json({ message: "Missing required fields" });

        // Unassign all records from this shelf (set to NULL)
        const query = `
            UPDATE records 
            SET shelf = NULL 
            WHERE region_id = $1 AND office_id = $2 AND category = $3 AND shelf = $4
        `;
        await pool.query(query, [parseId(region_id), parseId(office_id), category, shelf]);

        res.json({ message: "Shelf deleted successfully (records moved to Unsorted)" });
    } catch (err) {
        console.error("Delete Shelf Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.archiveRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("UPDATE records SET status = 'Archived' WHERE record_id = $1 RETURNING title", [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: "Record not found" });
        await logAudit(req, 'ARCHIVE_RECORD', `Archived "${result.rows[0].title}"`);
        res.json({ message: "Archived" });
    } catch (err) { res.status(500).json({ message: "Archive Failed" }); }
};

exports.restoreRecord = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE records SET status = 'Active' WHERE record_id = $1", [id]);
        await logAudit(req, 'RESTORE_RECORD', `Restored ID: ${id}`);
        res.json({ message: "Restored" });
    } catch (err) { res.status(500).json({ message: "Restore Failed" }); }
};

exports.deleteRecord = async (req, res) => {
    try {
        const { id } = req.params;

        // Get file info including is_restricted flag
        const fileData = await pool.query(
            "SELECT file_path, is_restricted, title FROM records WHERE record_id = $1",
            [id]
        );

        if (fileData.rows.length === 0) {
            return res.status(404).json({ message: "Record not found" });
        }

        const record = fileData.rows[0];
        const fileName = record.file_path;
        const isRestricted = record.is_restricted;

        // Determine the correct file path based on restricted status
        let filePath;
        if (isRestricted) {
            filePath = path.join(__dirname, '../uploads/restricted', fileName);
        } else {
            filePath = path.join(__dirname, '../uploads', fileName);
        }

        // Delete the physical file if it exists
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[DELETE] Physical file deleted: ${filePath}`);
        } else {
            console.log(`[DELETE] File not found on disk: ${filePath}`);
        }

        // Delete the database record
        await pool.query("DELETE FROM records WHERE record_id = $1", [id]);

        // Log the audit
        await logAudit(req, 'PERMANENT_DELETE', `Permanently deleted "${record.title}" (ID: ${id})`);

        res.json({ message: "Record permanently deleted", deleted: record.title });
    } catch (err) {
        console.error("Delete Record Error:", err);
        res.status(500).json({ message: "Delete Failed" });
    }
};

exports.updateRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, region_id, category_name, classification_rule, shelf, retention_period, period_covered, volume, duplication, time_value, utility_value } = req.body;
        const disposalDate = calculateDisposalDate(retention_period);
        await pool.query(
            "UPDATE records SET title = $1, region_id = $2, category = $3, classification_rule = $4, shelf = $5, retention_period = $6, disposal_date = $7, period_covered = $8, volume = $9, duplication = $10, time_value = $11, utility_value = $12 WHERE record_id = $13",
            [title, parseId(region_id), category_name, classification_rule, shelf || null, retention_period, disposalDate, period_covered, volume, duplication, time_value, utility_value, id]
        );
        await logAudit(req, 'UPDATE_RECORD', `Updated "${title}"`);
        res.json({ message: "Updated" });
    } catch (err) {
        console.error("Update Record Error:", err);
        res.status(500).json({ message: "Update Failed" });
    }
};

exports.verifyRecordAccess = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        const result = await pool.query("SELECT file_path, is_restricted FROM records WHERE record_id = $1", [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "File not found" });

        const record = result.rows[0];

        if (record.is_restricted) {
            // Get global master password from system_settings
            const settingsResult = await pool.query("SELECT restricted_master_password FROM system_settings WHERE id = 1");
            const masterPassword = settingsResult.rows[0]?.restricted_master_password;

            if (!masterPassword) {
                return res.status(500).json({ success: false, message: "Master password not configured. Contact administrator." });
            }

            const isMatch = await bcrypt.compare(password, masterPassword);
            if (!isMatch) {
                await logAudit(req, 'ACCESS_DENIED', `Failed password attempt for Record ID: ${id}`);
                return res.status(401).json({ success: false, message: "Incorrect Password" });
            }

            await logAudit(req, 'ACCESS_GRANTED', `Unlocked Record ID: ${id}`);
        }

        const access_token = jwt.sign({ file_path: record.file_path }, JWT_SECRET, { expiresIn: '5m' });
        res.json({ success: true, access_token });
    } catch (err) {
        console.error("Verify Access Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.streamFile = async (req, res) => {
    const { filename } = req.params;
    const { token } = req.query;
    try {
        const result = await pool.query("SELECT is_restricted, file_type FROM records WHERE file_path = $1", [filename]);
        if (result.rows.length === 0) return res.status(404).send("File record not found.");
        const { is_restricted, file_type } = result.rows[0];

        let filePath;

        if (is_restricted) {
            if (!token) return res.status(403).send("Access Denied.");
            try { jwt.verify(token, JWT_SECRET); } catch (e) { return res.status(403).send("Invalid Token."); }

            // Look in Restricted Folder
            filePath = path.join(__dirname, '../uploads/restricted', filename);
        } else {
            // Look in Public Folder
            filePath = path.join(__dirname, '../uploads', filename);
        }

        if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', file_type || 'application/pdf');
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        } else {
            // Fallback: Check public folder just in case (for files validly uploaded before this fix)
            const fallbackPath = path.join(__dirname, '../uploads', filename);
            if (fs.existsSync(fallbackPath)) {
                res.setHeader('Content-Type', file_type || 'application/pdf');
                const fileStream = fs.createReadStream(fallbackPath);
                fileStream.pipe(res);
            } else {
                res.status(404).send("File missing from storage.");
            }
        }
    } catch (err) {
        console.error("Stream Error:", err);
        res.status(500).send("Error");
    }
};