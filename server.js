// WebRTC Teams Integration - Node.js Signaling Server
// Dependencies: express, socket.io, cors, helmet

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "https://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  }
}));

app.use(cors({
  origin: process.env.CLIENT_URL || "https://localhost:3000",
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms and participants
const rooms = new Map();
const participants = new Map();

// Room management functions
class Room {
  constructor(id, name = 'Untitled Room') {
    this.id = id;
    this.name = name;
    this.participants = new Set();
    this.createdAt = new Date();
    this.maxParticipants = 8;
  }

  addParticipant(socketId, userData) {
    if (this.participants.size >= this.maxParticipants) {
      throw new Error('Room is full');
    }

    this.participants.add(socketId);
    participants.set(socketId, {
      ...userData,
      roomId: this.id,
      joinedAt: new Date()
    });
  }

  removeParticipant(socketId) {
    this.participants.delete(socketId);
    participants.delete(socketId);
  }

  getParticipantCount() {
    return this.participants.size;
  }

  isEmpty() {
    return this.participants.size === 0;
  }
}

// WebRTC signaling event handlers
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Handle room joining
  socket.on('join-room', (data) => {
    const { roomId, userData } = data;

    try {
      let room = rooms.get(roomId);

      // Create room if it doesn't exist
      if (!room) {
        room = new Room(roomId, userData.roomName || 'Video Call');
        rooms.set(roomId, room);
      }

      // Add participant to room
      room.addParticipant(socket.id, userData);
      socket.join(roomId);

      // Notify existing participants about new user
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userData: userData,
        participantCount: room.getParticipantCount()
      });

      // Send room info and existing participants to new user
      const existingParticipants = Array.from(room.participants)
        .filter(id => id !== socket.id)
        .map(id => ({
          socketId: id,
          userData: participants.get(id)
        }));

      socket.emit('room-joined', {
        roomId: roomId,
        participants: existingParticipants,
        roomInfo: {
          name: room.name,
          participantCount: room.getParticipantCount(),
          createdAt: room.createdAt
        }
      });

      console.log(`User ${userData.name} joined room ${roomId}`);

    } catch (error) {
      socket.emit('room-error', { message: error.message });
    }
  });

  // Handle WebRTC offer
  socket.on('offer', (data) => {
    const { targetSocketId, offer } = data;
    const participant = participants.get(socket.id);

    if (participant) {
      io.to(targetSocketId).emit('offer', {
        fromSocketId: socket.id,
        fromUserData: participant,
        offer: offer
      });

      console.log(`Offer sent from ${socket.id} to ${targetSocketId}`);
    }
  });

  // Handle WebRTC answer
  socket.on('answer', (data) => {
    const { targetSocketId, answer } = data;
    const participant = participants.get(socket.id);

    if (participant) {
      io.to(targetSocketId).emit('answer', {
        fromSocketId: socket.id,
        fromUserData: participant,
        answer: answer
      });

      console.log(`Answer sent from ${socket.id} to ${targetSocketId}`);
    }
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    const { targetSocketId, candidate } = data;

    io.to(targetSocketId).emit('ice-candidate', {
      fromSocketId: socket.id,
      candidate: candidate
    });

    console.log(`ICE candidate sent from ${socket.id} to ${targetSocketId}`);
  });

  // Handle media state changes
  socket.on('media-state-change', (data) => {
    const participant = participants.get(socket.id);

    if (participant) {
      // Update participant state
      Object.assign(participants.get(socket.id), data);

      // Broadcast to room
      socket.to(participant.roomId).emit('participant-media-change', {
        socketId: socket.id,
        mediaState: data
      });

      console.log(`Media state change from ${socket.id}:`, data);
    }
  });

  // Handle screen sharing
  socket.on('screen-share-start', () => {
    const participant = participants.get(socket.id);

    if (participant) {
      participants.get(socket.id).isScreenSharing = true;

      socket.to(participant.roomId).emit('participant-screen-share', {
        socketId: socket.id,
        isScreenSharing: true
      });

      console.log(`Screen sharing started by ${socket.id}`);
    }
  });

  socket.on('screen-share-stop', () => {
    const participant = participants.get(socket.id);

    if (participant) {
      participants.get(socket.id).isScreenSharing = false;

      socket.to(participant.roomId).emit('participant-screen-share', {
        socketId: socket.id,
        isScreenSharing: false
      });

      console.log(`Screen sharing stopped by ${socket.id}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const participant = participants.get(socket.id);

    if (participant) {
      const roomId = participant.roomId;
      const room = rooms.get(roomId);

      if (room) {
        room.removeParticipant(socket.id);

        // Notify other participants
        socket.to(roomId).emit('user-left', {
          socketId: socket.id,
          participantCount: room.getParticipantCount()
        });

        // Clean up empty room
        if (room.isEmpty()) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    }

    console.log(`Client disconnected: ${socket.id}`);
  });

  // Handle room leave
  socket.on('leave-room', () => {
    const participant = participants.get(socket.id);

    if (participant) {
      const roomId = participant.roomId;
      const room = rooms.get(roomId);

      if (room) {
        room.removeParticipant(socket.id);
        socket.leave(roomId);

        socket.to(roomId).emit('user-left', {
          socketId: socket.id,
          participantCount: room.getParticipantCount()
        });

        if (room.isEmpty()) {
          rooms.delete(roomId);
        }
      }
    }

    socket.emit('room-left');
  });
});

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    totalParticipants: participants.size
  });
});

app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({
    id: room.id,
    name: room.name,
    participantCount: room.getParticipantCount(),
    maxParticipants: room.maxParticipants,
    createdAt: room.createdAt
  });
});

app.post('/api/room', (req, res) => {
  const { roomName } = req.body;
  const roomId = 'room-' + Math.random().toString(36).substr(2, 9);

  const room = new Room(roomId, roomName);
  rooms.set(roomId, room);

  res.json({
    roomId: roomId,
    roomName: room.name,
    joinUrl: `${req.protocol}://${req.get('host')}/?room=${roomId}`
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
