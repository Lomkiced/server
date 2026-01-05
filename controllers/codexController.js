const pool = require('../config/db');

// --- HELPER: GET USER'S REGION NAME ---
// We need to convert the user's region_id (e.g., 5) into a name (e.g., "Region 1")
// because the Codex table stores region names string "Global" or "Region 1".
const getUserRegionName = async (regionId) => {
    if (!regionId) return null;
    const { rows } = await pool.query('SELECT name FROM regions WHERE id = $1', [regionId]);
    return rows.length > 0 ? rows[0].name : null;
};

exports.getCategories = async (req, res) => {
    try {
        let query = "SELECT * FROM codex_categories";
        let params = [];

        // --- SECURITY SCOPING ---
        if (req.user.role !== 'SUPER_ADMIN') {
            // Logic: Show 'Global' items OR items matching the user's region name
            const regionName = await getUserRegionName(req.user.region_id);
            
            query += " WHERE region = 'Global'";
            
            if (regionName) {
                query += " OR region = $1";
                params.push(regionName);
            }
        }

        query += " ORDER BY name ASC";

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getTypes = async (req, res) => {
    try {
        // Types also have a 'region' column (inherited from folder), so we filter them too.
        let query = "SELECT * FROM codex_types";
        let params = [];

        if (req.user.role !== 'SUPER_ADMIN') {
            const regionName = await getUserRegionName(req.user.region_id);
            
            query += " WHERE region = 'Global'";
            
            if (regionName) {
                query += " OR region = $1";
                params.push(regionName);
            }
        }

        query += " ORDER BY type_name ASC";

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.addCategory = async (req, res) => {
    try {
        const { name, region } = req.body;
        
        // Security: Regional Admins can only create for their own region
        if (req.user.role === 'REGIONAL_ADMIN') {
             const userRegionName = await getUserRegionName(req.user.region_id);
             if (region !== userRegionName) {
                 return res.status(403).json({ message: "You can only create folders for your assigned region." });
             }
        }

        const { rows } = await pool.query(
            "INSERT INTO codex_categories (name, region) VALUES ($1, $2) RETURNING *",
            [name, region]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.addType = async (req, res) => {
    try {
        const { category_id, type_name, retention_period, region } = req.body;
        
        // Security Check
        if (req.user.role === 'REGIONAL_ADMIN') {
             const userRegionName = await getUserRegionName(req.user.region_id);
             if (region !== 'Global' && region !== userRegionName) {
                 return res.status(403).json({ message: "Unauthorized region assignment." });
             }
        }

        const { rows } = await pool.query(
            "INSERT INTO codex_types (category_id, type_name, retention_period, region) VALUES ($1, $2, $3, $4) RETURNING *",
            [category_id, type_name, retention_period, region]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Optional: Add logic to prevent Regional Admin from deleting Global folders
        if (req.user.role !== 'SUPER_ADMIN') {
            const { rows } = await pool.query("SELECT region FROM codex_categories WHERE category_id = $1", [id]);
            if (rows.length > 0 && rows[0].region === 'Global') {
                return res.status(403).json({ message: "Only Super Admins can delete Global folders." });
            }
        }

        await pool.query("DELETE FROM codex_categories WHERE category_id = $1", [id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

exports.deleteType = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (req.user.role !== 'SUPER_ADMIN') {
            const { rows } = await pool.query("SELECT region FROM codex_types WHERE type_id = $1", [id]);
            if (rows.length > 0 && rows[0].region === 'Global') {
                return res.status(403).json({ message: "Only Super Admins can delete Global rules." });
            }
        }

        await pool.query("DELETE FROM codex_types WHERE type_id = $1", [id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};