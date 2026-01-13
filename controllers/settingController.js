const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

// --- 1. AUTO-FIX DATABASE ---
// This function runs before every action to ensure the DB is ready
const ensureSettingsReady = async () => {
    try {
        // Create Table if missing
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id INT PRIMARY KEY DEFAULT 1,
                system_name VARCHAR(100) DEFAULT 'DOST-RMS',
                org_name VARCHAR(150) DEFAULT 'Department of Science and Technology',
                welcome_msg TEXT DEFAULT 'Sign in to access the system.',
                primary_color VARCHAR(50) DEFAULT '#4f46e5',
                secondary_color VARCHAR(50) DEFAULT '#0f172a',
                logo_url TEXT,
                login_bg_url TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT single_row CHECK (id = 1)
            );
        `);

        // Create Default Row if missing
        await pool.query(`
            INSERT INTO system_settings (id, system_name) 
            VALUES (1, 'DOST-RMS') 
            ON CONFLICT (id) DO NOTHING
        `);
    } catch (err) {
        console.error("DB Init Error:", err.message);
    }
};

// --- 2. GET SETTINGS ---
exports.getSettings = async (req, res) => {
    try {
        await ensureSettingsReady(); // Fixes "Table Not Found" error
        
        const result = await pool.query("SELECT * FROM system_settings WHERE id = 1");
        
        // Fix: Force browser to NOT cache this response
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Get Settings Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

// --- 3. UPDATE SETTINGS ---
exports.updateSettings = async (req, res) => {
    try {
        await ensureSettingsReady(); // Fixes "Table Not Found" error

        const { system_name, org_name, welcome_msg, primary_color, secondary_color } = req.body;
        
        // Fix: Safe file handling (Prevents "Cannot read property of undefined" crash)
        const files = req.files || {}; 
        const logo_url = files['logo'] ? `/uploads/${files['logo'][0].filename}` : undefined;
        const login_bg_url = files['bg'] ? `/uploads/${files['bg'][0].filename}` : undefined;

        // Dynamic Update Query
        let query = `UPDATE system_settings SET 
            system_name = COALESCE($1, system_name),
            org_name = COALESCE($2, org_name),
            welcome_msg = COALESCE($3, welcome_msg),
            primary_color = COALESCE($4, primary_color),
            secondary_color = COALESCE($5, secondary_color),
            updated_at = NOW()`;

        const params = [system_name, org_name, welcome_msg, primary_color, secondary_color];
        let counter = 6;

        if (logo_url) { query += `, logo_url = $${counter++}`; params.push(logo_url); }
        if (login_bg_url) { query += `, login_bg_url = $${counter++}`; params.push(login_bg_url); }

        query += ` WHERE id = 1 RETURNING *`;

        const result = await pool.query(query, params);
        
        // Audit Log
        if (req.user) {
            await logAudit(req, 'UPDATE_BRANDING', `Updated system appearance.`);
        }
        
        res.json({ message: "Settings Saved", settings: result.rows[0] });

    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ message: "Update Failed: " + err.message });
    }
};