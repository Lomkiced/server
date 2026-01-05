const pool = require('../config/db');

// 1. GET REGIONS
exports.getRegions = async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM regions ORDER BY id ASC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};

// 2. CREATE REGION (Updated to accept Address & Status)
exports.createRegion = async (req, res) => {
    try {
        console.log("--- Creating Region ---");
        const { name, code, address, status } = req.body;
        console.log("Data Received:", req.body);
        
        if (!name || !code) return res.status(400).json({ message: "Name and Code are required" });

        // Insert all 4 fields
        const result = await pool.query(
            "INSERT INTO regions (name, code, address, status) VALUES ($1, $2, $3, $4) RETURNING *",
            [name, code, address || '', status || 'Active']
        );

        console.log("✅ Region Saved:", result.rows[0]);
        res.json({ message: "Region Registered", region: result.rows[0] });

    } catch (err) {
        console.error("❌ Add Region Error:", err.message);
        res.status(500).json({ message: "Server Error: " + err.message });
    }
};

// 3. UPDATE REGION (Updated to edit Address & Status)
exports.updateRegion = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, address, status } = req.body;

        await pool.query(
            "UPDATE regions SET name = $1, code = $2, address = $3, status = $4 WHERE id = $5",
            [name, code, address, status, id]
        );
        res.json({ message: "Region Updated" });
    } catch (err) {
        console.error("Update Region Error:", err.message);
        res.status(500).json({ message: "Update Failed" });
    }
};

// 4. DELETE REGION
exports.deleteRegion = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM regions WHERE id = $1", [id]);
        res.json({ message: "Region Deleted" });
    } catch (err) {
        res.status(500).json({ message: "Delete Failed" });
    }
};