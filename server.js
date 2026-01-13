require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); 
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const recordRoutes = require('./routes/recordRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const codexRoutes = require('./routes/codexRoutes'); 
const regionRoutes = require('./routes/regionRoutes');
const auditRoutes = require('./routes/auditRoutes');
const settingRoutes = require('./routes/settingRoutes'); 

const app = express();
const port = process.env.PORT || 5000;

// 1. Security
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, 
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "frame-ancestors": ["'self'", "http://localhost:5173"],
            "img-src": ["'self'", "data:", "blob:", "http://localhost:5000"], 
        },
    },
}));

app.use(cors({ origin: 'http://localhost:5173', credentials: true })); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. STATIC FILES (THE FIX for Broken Images)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// 3. Routes
app.use((req, res, next) => { console.log(`[REQUEST] ${req.method} ${req.url}`); next(); });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/dashboard', dashboardRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/codex', codexRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingRoutes);

app.use((err, req, res, next) => {
    console.error("🔥 ERROR:", err.stack);
    res.status(500).json({ message: "System Error", error: err.message });
});

app.listen(port, () => {
    console.log(`🚀 SERVER ONLINE on http://localhost:${port}`);
});