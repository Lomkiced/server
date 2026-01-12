const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "dost_secret_key_2025";

exports.authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Access Denied: No Token Provided" });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error("Token Error:", err.message);
            return res.status(403).json({ message: "Invalid or Expired Token" });
        }
        
        // NORMALIZE USER DATA
        // Ensures 'req.user.id' and 'req.user.region_id' always exist
        req.user = {
            id: decoded.user_id || decoded.id,
            user_id: decoded.user_id || decoded.id,
            username: decoded.username,
            role: decoded.role,
            region_id: decoded.region_id
        };
        
        next();
    });
};