const pool = require('../config/db');
const bcrypt = require('bcryptjs'); // Ensure you have bcryptjs installed

// --- ROBUST HELPER ---
const parseId = (id) => {
    // If id is 0, we accept it. If it's null/undefined/empty string, return null.
    if (id === undefined || id === null || id === '') return null;
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? null : parsed;
};

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

// 1. GET USERS
exports.getUsers = async (req, res) => {
    try {
        let query = `
            SELECT u.user_id, u.username, u.role, u.region_id, u.office, u.status, 
                   r.name as region_name 
            FROM users u
            LEFT JOIN regions r ON u.region_id = r.id 
            WHERE 1=1
        `;
        let params = [];
        
        // Security: If not Super Admin, limit scope
        if (req.user.role !== 'SUPER_ADMIN') {
            query += " AND u.region_id = $1";
            params.push(parseId(req.user.region_id));
        }

        query += " ORDER BY u.created_at DESC";
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Get Users Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

// 2. CREATE USER (DEBUGGED)
exports.createUser = async (req, res) => {
    try {
        console.log("--- [DEBUG] Create User Attempt ---");
        console.log("Payload:", req.body);

        const { username, password, role, region_id, office } = req.body;

        if (!username || !password) return res.status(400).json({ message: "Missing credentials" });

        // Check Duplicate
        const check = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (check.rows.length > 0) return res.status(400).json({ message: "Username already exists" });

        // --- EXPLICIT REGION LOGIC ---
        let targetRegion = null;

        // Ensure we parse the input strictly
        const inputRegion = parseId(region_id);

        if (req.user.role === 'SUPER_ADMIN') {
            // Super Admin assigns what they selected
            targetRegion = inputRegion;
            console.log(`> Super Admin Action: Assigning Region ID [${targetRegion}]`);
        } else {
            // Others get their own region forced
            targetRegion = parseId(req.user.region_id);
            console.log(`> Regional Action: Forcing Region ID [${targetRegion}]`);
        }

        const hashedPassword = await hashPassword(password);

        await pool.query(
            `INSERT INTO users (username, password, role, region_id, office, status) 
             VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
            [username, hashedPassword, role, targetRegion, office]
        );

        console.log("--- [SUCCESS] User Created ---");
        res.json({ message: "User Created Successfully" });
    } catch (err) {
        console.error("[CREATE USER ERROR]", err.message);
        res.status(500).json({ message: "Database Error: " + err.message });
    }
};

// 3. UPDATE USER (DEBUGGED)
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, role, office, region_id, password } = req.body;

        console.log(`--- [DEBUG] Update User ${id} ---`);
        
        let targetRegion = parseId(region_id);
        
        if (req.user.role !== 'SUPER_ADMIN') {
            targetRegion = parseId(req.user.region_id);
        }

        console.log(`> Assigning Region ID: [${targetRegion}]`);

        let query = "UPDATE users SET username = $1, role = $2, office = $3, region_id = $4";
        let params = [username, role, office, targetRegion];
        let counter = 5;

        if (password && password.trim() !== "") {
            query += `, password = $${counter}`;
            params.push(await hashPassword(password));
            counter++;
        }

        query += ` WHERE user_id = $${counter}`;
        params.push(id);

        await pool.query(query, params);
        res.json({ message: "User Updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// 4. STATUS & DELETE
exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await pool.query("UPDATE users SET status = $1 WHERE user_id = $2", [status, id]);
        res.json({ message: "Status Updated" });
    } catch (err) { res.status(500).json({ message: "Error updating status" }); }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM users WHERE user_id = $1", [id]);
        res.json({ message: "User Deleted" });
    } catch (err) { res.status(500).json({ message: "Error deleting user" }); }
};