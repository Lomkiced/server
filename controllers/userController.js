const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../utils/auditLogger');

// --- HELPER: ID PARSING ---
const parseId = (id) => {
    if (id === undefined || id === null || id === '') return null;
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? null : parsed;
};

// --- HELPER: SCOPE ENFORCER ---
const getTargetRegion = (req, requestedRegionId) => {
    // Super Admins can assign users to ANY region
    if (req.user.role === 'SUPER_ADMIN') {
        return parseId(requestedRegionId);
    }
    // Regional Admins are FORCED to their own region
    return parseId(req.user.region_id);
};

// --- HELPER: Ensure user_office_assignments table exists (no FK to sub_units) ---
let tableChecked = false;
const ensureAssignmentsTable = async () => {
    if (tableChecked) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.user_office_assignments (
                assignment_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES public.users(user_id) ON DELETE CASCADE,
                office_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, office_id)
            )
        `);
        tableChecked = true;
    } catch (e) {
        console.log('[ensureAssignmentsTable] Table already exists or error:', e.message);
        tableChecked = true;
    }
};

// 1. GET USERS (Scoped Security)
exports.getUsers = async (req, res) => {
    try {
        let query = `
            SELECT u.user_id, u.username, u.name, u.role, u.region_id, u.office, u.status, u.created_at,
                   r.name as region_name
            FROM users u
            LEFT JOIN regions r ON u.region_id = r.id 
            WHERE 1=1
        `;
        let params = [];
        let counter = 1;

        // SECURITY: Regional Admins see EVERYONE in their Region
        if (req.user.role === 'ADMIN' || req.user.role === 'REGIONAL_ADMIN') {
            query += ` AND u.region_id = $${counter++}`;
            params.push(req.user.region_id);
            query += ` AND u.role != 'SUPER_ADMIN'`;
        }
        // SECURITY: Staff see nobody
        else if (req.user.role === 'STAFF') {
            return res.status(403).json({ message: "Access Denied" });
        }

        query += " ORDER BY u.role ASC, u.name ASC";

        const result = await pool.query(query, params);

        // Return users with empty sub_units (skip problematic query for now)
        const users = result.rows.map(user => ({ ...user, sub_units: [] }));

        res.json(users);

    } catch (err) {
        console.error("Get Users Error:", err.message, err.stack);
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

// 2. CREATE USER (Auto-Link & Audit)
exports.createUser = async (req, res) => {
    try {
        const { username, password, name, role, office, region_id, sub_unit_ids } = req.body; // sub_unit_ids is array

        if (!username || !password || !name) {
            return res.status(400).json({ message: "Missing required fields." });
        }

        // 1. Determine Scope
        const targetRegion = getTargetRegion(req, region_id);

        // 2. Security Check: Regional Admin Restrictions
        if (req.user.role === 'ADMIN' || req.user.role === 'REGIONAL_ADMIN') {
            // Can only create ADMIN (Co-Admin) or STAFF
            if (role === 'SUPER_ADMIN') {
                return res.status(403).json({ message: "You cannot create Super Admins." });
            }
        }

        // 3. Check Duplicates
        const check = await pool.query("SELECT username FROM users WHERE username = $1", [username]);
        if (check.rows.length > 0) return res.status(400).json({ message: "Username already exists" });

        // 4. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 5. Insert
        const result = await pool.query(
            `INSERT INTO users (username, password, name, role, region_id, office, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'Active') 
             RETURNING user_id, username, name, role, region_id`,
            [username, hashedPassword, name, role, targetRegion, office]
        );

        const newUserId = result.rows[0].user_id;

        // 6. Handle Sub-Office Assignments (using new table without FK constraint)
        if (Array.isArray(sub_unit_ids) && sub_unit_ids.length > 0) {
            await ensureAssignmentsTable();
            const assignmentValues = sub_unit_ids.map(sid => `(${newUserId}, ${parseInt(sid)})`).join(',');
            await pool.query(`INSERT INTO user_office_assignments (user_id, office_id) VALUES ${assignmentValues} ON CONFLICT DO NOTHING`);
        }

        // 7. Log Event
        await logAudit(req, 'ADD_USER', `Onboarded ${role} "${username}" to Region ${targetRegion}`);

        res.json({ message: "User Created Successfully", user: result.rows[0] });

    } catch (err) {
        console.error("Create User Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};

// 3. UPDATE USER
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, office, status, password, role, sub_unit_ids } = req.body;

        // Security: Regional Admin can only touch their own region
        if (req.user.role === 'ADMIN' || req.user.role === 'REGIONAL_ADMIN') {
            const verify = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [id]);
            if (verify.rows.length === 0 || verify.rows[0].region_id !== req.user.region_id) {
                return res.status(403).json({ message: "Unauthorized access." });
            }
        }

        let query = "UPDATE users SET name = $1, office = $2, status = $3";
        let params = [name, office, status];
        let counter = 4;

        // Allow Role Change
        if (role) {
            query += `, role = $${counter++}`;
            params.push(role);
        }

        if (password && password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            query += `, password = $${counter++}`;
            params.push(hashedPassword);
        }

        query += ` WHERE user_id = $${counter}`;
        params.push(id);

        await pool.query(query, params);

        // Handle Sub-Office Assignments (Reset & Re-assign using new table)
        if (sub_unit_ids !== undefined) {
            await ensureAssignmentsTable();
            await pool.query("DELETE FROM user_office_assignments WHERE user_id = $1", [id]);
            if (Array.isArray(sub_unit_ids) && sub_unit_ids.length > 0) {
                const values = sub_unit_ids.map(sid => `(${id}, ${parseInt(sid)})`).join(',');
                await pool.query(`INSERT INTO user_office_assignments (user_id, office_id) VALUES ${values} ON CONFLICT DO NOTHING`);
            }
        }

        await logAudit(req, 'UPDATE_USER', `Updated User ID: ${id}`);

        res.json({ message: "User Updated" });

    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};

// 4. DELETE USER
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role === 'ADMIN' || req.user.role === 'REGIONAL_ADMIN') {
            const verify = await pool.query("SELECT region_id FROM users WHERE user_id = $1", [id]);
            if (verify.rows.length === 0 || verify.rows[0].region_id !== req.user.region_id) {
                return res.status(403).json({ message: "Unauthorized." });
            }
            const currentUserId = req.user.id || req.user.user_id;
            if (parseInt(id) === currentUserId) {
                return res.status(400).json({ message: "You cannot delete your own account." });
            }
        }

        await pool.query("DELETE FROM users WHERE user_id = $1", [id]);
        await logAudit(req, 'DELETE_USER', `Deleted User ID: ${id}`);
        res.json({ message: "User Deleted" });

    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};