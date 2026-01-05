const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Live Role Check
    const userQuery = await pool.query("SELECT user_id, username, role, region_id, office, status FROM users WHERE user_id = $1", [decoded.id]);
    
    if (userQuery.rows.length === 0) return res.sendStatus(403);
    req.user = userQuery.rows[0];
    next();
  } catch (err) { return res.sendStatus(403); }
};

const scopeDataByRegion = (req, res, next) => {
  if (req.user.role === 'SUPER_ADMIN') {
    req.sqlFilter = ""; 
    req.sqlParams = [];
  } else {
    req.sqlFilter = " AND region_id = $1"; 
    req.sqlParams = [req.user.region_id];
  }
  next();
};

module.exports = { authenticateToken, scopeDataByRegion };