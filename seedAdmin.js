require('dotenv').config();
const db = require('./config/db'); // Your database connection
const bcrypt = require('bcrypt'); // The security library

const createSuperAdmin = async () => {
    try {
        console.log("--- 🛡️  STARTING ADMIN RESCUE ---");

        // 1. Define the Admin Details
        const username = 'admin';
        const rawPassword = 'password123';
        const email = 'admin@dost.gov.ph';
        
        // 2. Encrypt the Password (The part we missed!)
        console.log("1. Encrypting password...");
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(rawPassword, salt);

        // 3. Delete Old/Broken Admin (Cleanup)
        console.log("2. Cleaning up old admin data...");
        await db.query(`DELETE FROM users WHERE username = $1`, [username]);

        // 4. Insert the New Secure Admin
        console.log("3. Inserting SECURE Super Admin...");
        const sql = `
            INSERT INTO users (username, password, full_name, email, role, region_id, office, status)
            VALUES ($1, $2, 'System Override', $3, 'SUPER_ADMIN', 1, 'Central Command', 'ACTIVE')
            RETURNING user_id;
        `;
        
        const { rows } = await db.query(sql, [username, hashedPassword, email]);
        
        console.log(`✅ SUCCESS! Created Admin ID: ${rows[0].user_id}`);
        console.log(`🔑 Username: ${username}`);
        console.log(`🔑 Password: ${rawPassword}`);
        console.log("-------------------------------------");
        process.exit(0);

    } catch (error) {
        console.error("❌ FAILED:", error.message);
        console.log("💡 Tip: If error is 'bcrypt not found', try running: npm install bcrypt");
        process.exit(1);
    }
};

createSuperAdmin();