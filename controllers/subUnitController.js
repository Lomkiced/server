const pool = require('../config/db');

// GET SUB-UNITS
exports.getSubUnits = async (req, res) => {
    try {
        const { office_id } = req.query;
        let query = "SELECT * FROM sub_units";
        const params = [];

        if (office_id) {
            query += " WHERE office_id = $1";
            params.push(office_id);
        }

        query += " ORDER BY name ASC";
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Get SubUnits Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
};

// CREATE SUB-UNIT
exports.createSubUnit = async (req, res) => {
    try {
        const { office_id, name, description } = req.body;

        if (!office_id || !name) {
            return res.status(400).json({ message: "Office and Name are required." });
        }

        const result = await pool.query(
            "INSERT INTO sub_units (office_id, name, description) VALUES ($1, $2, $3) RETURNING *",
            [office_id, name, description]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Create SubUnit Error:", err.message);
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ message: "Sub-unit with this name already exists in the office." });
        }
        res.status(500).json({ message: "Server Error" });
    }
};
