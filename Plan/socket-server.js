// socket-server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'https://*.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Support both transports
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
  });
});

// Broadcast endpoint (called by Next.js API)
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

  console.log(`Broadcasted vote update for poll ${pollSlug}: option ${optionId} -> ${newCount}`);

  res.json({ success: true });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join a poll room
  socket.on('join_poll', (pollId) => {
    socket.join(`poll:${pollId}`);
    console.log(`${socket.id} joined poll room: poll:${pollId}`);
    
    // Notify client of successful join
    socket.emit('joined_poll', { pollId });
  });

  // Leave a poll room
  socket.on('leave_poll', (pollId) => {
    socket.leave(`poll:${pollId}`);
    console.log(`${socket.id} left poll room: poll:${pollId}`);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id} (${reason})`);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { io, app, server };
