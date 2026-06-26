require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/database');
const { initializeFirebase } = require('./config/firebase');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { createGlobalRoom, createAdminChatRoom } = require('./services/roomSetup');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const { setupSocketHandlers } = require('./sockets');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_IO_CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST']
  }
});

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173']
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
}));

app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(requestLogger);

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken ? req.csrfToken() : 'disabled' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.set('io', io);

setupSocketHandlers(io);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    initializeFirebase();
    await createGlobalRoom();
    await createAdminChatRoom();

    server.listen(PORT, () => {
      console.log(`ChatNow backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };
