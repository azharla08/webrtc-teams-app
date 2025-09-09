// WebRTC Teams Integration - Node.js Signaling Server
// Dependencies: express, socket.io, cors, helmet, path
// Run: NODE_ENV=production PORT=3001 CLIENT_URL=https://webrtc-teams-app.onrender.com node server.js

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const app = express();
const server = http.createServer(app);

// ===== Env =====
const PORT = process.env.PORT || 3001;
// Use your Render app URL in prod; http://localhost:3000 for local dev
const CLIENT_URL =
  process.env.CLIENT_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://webrtc-teams-app.onrender.com"
    : "http://localhost:3000");

// ===== Socket.IO (CORS must match client origin) =====
const io = socketIo(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ===== Security: Helmet + CSP =====
// Unblocks blob: scripts and workers; keeps inline styles (can be removed later)
// Adds 'unsafe-eval' ONLY in dev if your tooling needs it.
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // avoid COEP/COOP issues while using wasm/devtools
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        // Scripts loaded by tags & dynamic modules (explicitly allow blob:)
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "blob:",
          ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
        ],
        "script-src-elem": [
          "'self'",
          "'unsafe-inline'",
          "blob:",
          ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
        ],
        // Web Workers and similar
        "worker-src": ["'self'", "blob:"],
        // Styles (keep inline for now; replace with nonces/hashes later)
        "style-src": ["'self'", "'unsafe-inline'"],
        // WebSocket / API calls
        "connect-src": ["'self'", "https:", "wss:", "ws:", CLIENT_URL],
        // Media for <audio>/<video> (remote WebRTC renders via media elements)
        "media-src": ["'self'", "blob:", "data:"],
        // Images & fonts
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "font-src": ["'self'", "data:", "https:"],
        // Disallow clickjacking unless you intend to embed elsewhere
        "frame-ancestors": ["'self'"],
      },
    },
  })
);

// ===== CORS for REST endpoints =====
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

// ===== App Middleware =====
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serves your client bundle

// ===== In-Memory Store =====
const rooms = new Map();
const participants = new Map();

class Room {
  constructor(id, name = "Untitled Room") {
    this.id = id;
    this.name = name;
    this.participants = new Set();
    this.createdAt = new Date();
    this.maxParticipants = 8;
  }

  addParticipant(socketId, userData) {
    if (this.participants.size >= this.maxParticipants) {
      throw new Error("Room is full");
    }
    this.participants.add(socketId);
    participants.set(socketId, {
      ...userData,
      roomId: this.id,
      joinedAt: new Date(),
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

// ===== Socket.IO handlers =====
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join-room", (data) => {
    const { roomId, userData } = data;

    try {
      let room = rooms.get(roomId);
      if (!room) {
        room = new Room(roomId, userData?.roomName || "Video Call");
        rooms.set(roomId, room);
      }

      room.addParticipant(socket.id, userData);
      socket.join(roomId);

      // Notify others
      socket.to(roomId).emit("user-joined", {
        socketId: socket.id,
        userData: userData,
        participantCount: room.getParticipantCount(),
      });

      // Send current room state to the new user
      const existingParticipants = Array.from(room.participants)
        .filter((id) => id !== socket.id)
        .map((id) => ({
          socketId: id,
          userData: participants.get(id),
        }));

      socket.emit("room-joined", {
        roomId,
        participants: existingParticipants,
        roomInfo: {
          name: room.name,
          participantCount: room.getParticipantCount(),
          createdAt: room.createdAt,
        },
      });

      console.log(`User ${userData?.name || socket.id} joined room ${roomId}`);
    } catch (error) {
      socket.emit("room-error", { message: error.message });
    }
  });

  socket.on("offer", ({ targetSocketId, offer }) => {
    const participant = participants.get(socket.id);
    if (participant) {
      io.to(targetSocketId).emit("offer", {
        fromSocketId: socket.id,
        fromUserData: participant,
        offer,
      });
      console.log(`Offer sent from ${socket.id} to ${targetSocketId}`);
    }
  });

  socket.on("answer", ({ targetSocketId, answer }) => {
    const participant = participants.get(socket.id);
    if (participant) {
      io.to(targetSocketId).emit("answer", {
        fromSocketId: socket.id,
        fromUserData: participant,
        answer,
      });
      console.log(`Answer sent from ${socket.id} to ${targetSocketId}`);
    }
  });

  socket.on("ice-candidate", ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit("ice-candidate", {
      fromSocketId: socket.id,
      candidate,
    });
    console.log(`ICE candidate sent from ${socket.id} to ${targetSocketId}`);
  });

  socket.on("media-state-change", (data) => {
    const participant = participants.get(socket.id);
    if (participant) {
      Object.assign(participants.get(socket.id), data);
      socket.to(participant.roomId).emit("participant-media-change", {
        socketId: socket.id,
        mediaState: data,
      });
      console.log(`Media state change from ${socket.id}:`, data);
    }
  });

  socket.on("screen-share-start", () => {
    const participant = participants.get(socket.id);
    if (participant) {
      participants.get(socket.id).isScreenSharing = true;
      socket.to(participant.roomId).emit("participant-screen-share", {
        socketId: socket.id,
        isScreenSharing: true,
      });
      console.log(`Screen sharing started by ${socket.id}`);
    }
  });

  socket.on("screen-share-stop", () => {
    const participant = participants.get(socket.id);
    if (participant) {
      participants.get(socket.id).isScreenSharing = false;
      socket.to(participant.roomId).emit("participant-screen-share", {
        socketId: socket.id,
        isScreenSharing: false,
      });
      console.log(`Screen sharing stopped by ${socket.id}`);
    }
  });

  socket.on("leave-room", () => {
    const participant = participants.get(socket.id);
    if (participant) {
      const roomId = participant.roomId;
      const room = rooms.get(roomId);
      if (room) {
        room.removeParticipant(socket.id);
        socket.leave(roomId);
        socket.to(roomId).emit("user-left", {
          socketId: socket.id,
          participantCount: room.getParticipantCount(),
        });
        if (room.isEmpty()) rooms.delete(roomId);
      }
    }
    socket.emit("room-left");
  });

  socket.on("disconnect", () => {
    const participant = participants.get(socket.id);
    if (participant) {
      const roomId = participant.roomId;
      const room = rooms.get(roomId);
      if (room) {
        room.removeParticipant(socket.id);
        socket.to(roomId).emit("user-left", {
          socketId: socket.id,
          participantCount: room.getParticipantCount(),
        });
        if (room.isEmpty()) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    }
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ===== REST API =====
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    totalParticipants: participants.size,
  });
});

app.get("/api/room/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({
    id: room.id,
    name: room.name,
    participantCount: room.getParticipantCount(),
    maxParticipants: room.maxParticipants,
    createdAt: room.createdAt,
  });
});

app.post("/api/room", (req, res) => {
  const { roomName } = req.body || {};
  const roomId = "room-" + Math.random().toString(36).substr(2, 9);
  const room = new Room(roomId, roomName || "Video Call");
  rooms.set(roomId, room);
  res.json({
    roomId,
    roomName: room.name,
    joinUrl: `${req.protocol}://${req.get("host")}/?room=${roomId}`,
  });
});

// ===== Error handler =====
app.use((error, _req, res, _next) => {
  console.error("Server error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// ===== ICE config endpoint (TURN/STUN) =====
app.get("/api/ice", (_req, res) => {
  const stun = (process.env.STUN_URLS || "stun:stun.l.google.com:19302")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const turn = (process.env.TURN_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const iceServers = [
    ...stun.map((url) => ({ urls: url })),
    ...(turn.length
      ? [
          {
            urls: turn,
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_CREDENTIAL,
          },
        ]
      : []),
  ];

  res.json({ iceServers });
});

// ===== Start Server =====
server.listen(PORT, () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// ===== Graceful shutdown =====
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

module.exports = { app, server, io };
