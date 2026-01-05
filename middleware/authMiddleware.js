const jwt = require('jsonwebtoken');

// 🔐 MUST MATCH THE SECRET IN authRoutes.js
const JWT_SECRET = process.env.JWT_SECRET || "dost_secret_key_2025";

exports.authenticateToken = (req, res, next) => {
    // 1. Get the token from the Header
    const authHeader = req.headers['authorization'];
    
    // Format is usually "Bearer <TOKEN>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Access Denied: No Token Provided" });
    }

    // 2. Verify the Token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("Token Verification Failed:", err.message);
            return res.status(403).json({ message: "Invalid Token" });
        }
        
        // 3. Attach user info to the request so controllers can use it
        req.user = user;
        next();
    });
};