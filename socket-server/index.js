// socket-server/index.js
// Real-Time Poll Rooms — WebSocket Server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure allowed origins (production + local dev)
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
].filter(Boolean);

// Configure Socket.io with CORS
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors({
    origin: allowedOrigins,
}));
app.use(express.json());

// ─── Health Check ──────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        connections: io.engine.clientsCount,
    });
});

// ─── Broadcast Endpoint (called by Next.js vote API) ───
app.post('/broadcast', (req, res) => {
    const { pollId, pollSlug, optionId, newCount } = req.body;

    if (!pollId || !optionId || newCount === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Emit to all clients in this poll room
    io.to(`poll:${pollId}`).emit('vote_update', {
        optionId,
        newCount,
    });

    console.log(
        `[broadcast] poll=${pollSlug || pollId} option=${optionId} count=${newCount}`
    );

    res.json({ success: true });
});

// ─── Socket.io Connection Handling ─────────────────────
io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Join a poll room
    socket.on('join_poll', (pollId) => {
        socket.join(`poll:${pollId}`);
        console.log(`[socket] ${socket.id} joined poll:${pollId}`);
        socket.emit('joined_poll', { pollId });
    });

    // Leave a poll room
    socket.on('leave_poll', (pollId) => {
        socket.leave(`poll:${pollId}`);
        console.log(`[socket] ${socket.id} left poll:${pollId}`);
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
        console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });

    // Error
    socket.on('error', (error) => {
        console.error(`[socket] error for ${socket.id}:`, error);
    });
});

// ─── Express Error Handler ─────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[express] error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ──────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Socket.io server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

// ─── Graceful Shutdown ─────────────────────────────────
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server...');
    server.close(() => process.exit(0));
});

module.exports = { io, app, server };
