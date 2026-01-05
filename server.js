require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// --- ROUTE IMPORTS ---
const authRoutes = require('./routes/authRoutes');
const recordRoutes = require('./routes/recordRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes'); // The new Brain
const userRoutes = require('./routes/userRoutes');
const codexRoutes = require('./routes/codexRoutes'); 
const regionRoutes = require('./routes/regionRoutes');
const auditRoutes = require('./routes/auditRoutes'); // The Security Camera

const app = express();
const port = process.env.PORT || 5000;

// --- 1. GLOBAL MIDDLEWARE ---
// Allow Frontend Access
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

// Increase Payload Limit (Prevents upload crashes)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Traffic Logger (See what's happening in terminal)
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// --- 2. STATIC FILES (FILE CABINET) ---
// This allows the browser to open PDF files
const uploadDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));
console.log(`[SYSTEM] Serving static files from: ${uploadDir}`);

// --- 3. API ROUTES (THE PATHWAYS) ---
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes); // <--- Connected!
app.use('/api/records', recordRoutes);
app.use('/api/users', userRoutes);
app.use('/api/codex', codexRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/audit', auditRoutes);

// --- 4. START SERVER ---
app.listen(port, () => {
    console.log(`🚀 SERVER ONLINE on http://localhost:${port}`);
    console.log(`📡 Dashboard API: http://localhost:${port}/api/dashboard/stats`);
});