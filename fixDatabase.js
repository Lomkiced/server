// server/fixDatabase.js
require('dotenv').config();
const pool = require('./config/db');

const fixSchema = async () => {
    try {
        console.log("🛠️ Checking Database Schema...");

        // 1. Check if 'password_hash' exists
        const checkHash = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='password_hash'
        `);

        // 2. Check if 'password' exists
        const checkPass = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='password'
        `);

        if (checkHash.rows.length > 0) {
            console.log("⚠️ Found legacy column 'password_hash'. Renaming to 'password'...");
            await pool.query('ALTER TABLE users RENAME COLUMN password_hash TO password');
            console.log("✅ FIXED: Column renamed successfully.");
        } else if (checkPass.rows.length > 0) {
            console.log("✅ Schema is already correct (column 'password' exists).");
        } else {
            console.log("⚠️ No password column found. Creating one...");
            await pool.query('ALTER TABLE users ADD COLUMN password VARCHAR(255)');
            console.log("✅ FIXED: Column 'password' created.");
        }

        process.exit();

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        process.exit(1);
    }
};

fixSchema();