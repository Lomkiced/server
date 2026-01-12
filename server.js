require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// --- ROUTE IMPORTS ---
const authRoutes = require('./routes/authRoutes');
const recordRoutes = require('./routes/recordRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const codexRoutes = require('./routes/codexRoutes'); 
const regionRoutes = require('./routes/regionRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
const port = process.env.PORT || 5000;

// --- 1. SECURITY MIDDLEWARE (Professional Grade) ---
app.use(helmet()); // Protects headers
app.use(cors({ origin: 'http://localhost:5173', credentials: true })); // Allows Frontend
app.use(express.json({ limit: '50mb' })); // Allows large files
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate Limiter: Prevents Brute Force Attacks on Login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per window
    message: "Too many login attempts, please try again later."
});
app.use('/api/auth/login', loginLimiter);

// --- 2. TRAFFIC MONITOR ---
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// --- 3. STATIC FILES (File Cabinet) ---
const uploadDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

// --- 4. API ROUTES (The Pathways) ---
app.use('/api/auth', authRoutes);         // Login & Identity
app.use('/api/records', recordRoutes);    // File Uploads
app.use('/api/dashboard', dashboardRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/codex', codexRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/audit', auditRoutes);

// --- 5. GLOBAL ERROR HANDLER (Crash Prevention) ---
app.use((err, req, res, next) => {
    console.error("🔥 UNHANDLED ERROR:", err.stack);
    res.status(500).json({ message: "Internal System Failure", error: err.message });
});

// --- 6. START SERVER ---
app.listen(port, () => {
    console.log(`🚀 SERVER ONLINE on http://localhost:${port}`);
});