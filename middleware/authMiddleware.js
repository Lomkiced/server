const jwt = require('jsonwebtoken');

// 🔐 SECURITY: Ensure this matches your authController secret
const JWT_SECRET = process.env.JWT_SECRET || "dost_secret_key_2025";

exports.authenticateToken = (req, res, next) => {
    // 1. Extract Token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Access Denied: No Token Provided" });
    }

    // 2. Verify Token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error("Token Error:", err.message);
            return res.status(403).json({ message: "Invalid or Expired Token" });
        }
        
        // 3. NORMALIZE USER DATA (The Critical Fix)
        // We create a standard 'req.user' object that works everywhere
        // This ensures req.user.id IS ALWAYS AVAILABLE
        req.user = {
            id: decoded.user_id || decoded.id, // Handle both naming conventions
            user_id: decoded.user_id || decoded.id,
            username: decoded.username,
            role: decoded.role,
            region_id: decoded.region_id
        };
        
        next();
    });
};