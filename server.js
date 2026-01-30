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
const officeRoutes = require('./routes/officeRoutes');
const subUnitRoutes = require('./routes/subUnitRoutes');

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

// Dynamic CORS for development and production
const allowedOrigins = [
    'http://localhost:5173',     // Vite dev server
    'http://localhost',          // Docker production (port 80)
    'http://localhost:80',       // Docker production explicit
    'http://localhost:3000',     // Docker production (alternate port)
    process.env.FRONTEND_URL     // Custom frontend URL if provided
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins in production (Nginx handles this)
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. STATIC FILES (THE FIX for Broken Images)
const uploadDir = path.join(__dirname, 'uploads');
const restrictedUploadDir = path.join(__dirname, 'uploads', 'restricted');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(restrictedUploadDir)) fs.mkdirSync(restrictedUploadDir, { recursive: true });

// SECURITY: Block access to restricted folder via static route
app.use('/uploads/restricted', (req, res) => res.status(403).send('Access Denied'));
app.use('/uploads', express.static(uploadDir));

// 3. Routes
app.use((req, res, next) => { console.log(`[REQUEST] ${req.method} ${req.url}`); next(); });
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: "Too many login attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/codex', codexRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/offices', officeRoutes);
app.use('/api/sub-units', subUnitRoutes);

app.use((err, req, res, next) => {
    console.error("🔥 ERROR:", err.stack);
    res.status(500).json({ message: "System Error", error: err.message });
});

// Initialize Retention Archiver Service
const { initRetentionScheduler } = require('./services/retentionService');

app.listen(port, () => {
    console.log(`🚀 SERVER ONLINE on http://localhost:${port}`);

    // Start the retention archiver
    initRetentionScheduler();
});