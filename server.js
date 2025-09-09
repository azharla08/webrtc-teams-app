// WebRTC Teams Integration - Node.js Signaling Server (Strict CSP)
// Dependencies: express, socket.io, cors, helmet, path, crypto
// Run example:
//   NODE_ENV=production \
//   PORT=3001 \
//   CLIENT_URL=https://webrtc-teams-app.onrender.com \
//   node server.js

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

// ===== Env =====
const PORT = process.env.PORT || 3001;
const CLIENT_URL =
  process.env.CLIENT_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://webrtc-teams-app.onrender.com"
    : "http://localhost:3000");

// Optional allow-lists (comma separated): e.g. HELMET_EXTRA_SCRIPT_SRC=https://example.com,https://cdn.example
const EXTRA_SCRIPT = (process.env.HELMET_EXTRA_SCRIPT_SRC || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const EXTRA_CONNECT = (process.env.HELMET_EXTRA_CONNECT_SRC || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// ===== Socket.IO =====
const io = socketIo(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ===== Per-request nonce =====
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

// ===== Security: Helmet + strict CSP =====
// - No 'unsafe-inline' for scripts. Use our nonce for any inline scripts you own.
// - Allow 'blob:' for module chunks/workers (common with bundlers/WebRTC).
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // avoid COEP issues w/ wasm/dev tools
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],

        // Scripts: self + nonce + blob. No 'unsafe-inline' in strict mode.
        // NOTE: external scripts from your own origin are fine with 'self'.
        "script-src": [
          "'self'",
          (req, res) => `'nonce-${res.locals.nonce}'`,
          "blob:",
          ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
          ...EXTRA_SCRIPT
        ],
        "script-src-elem": [
          "'self'",
          (req, res) => `'nonce-${res.locals.nonce}'`,
          "blob:",
          ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
          ...EXTRA_SCRIPT
        ],

        // Workers from blob (for worklets/Web Workers, sometimes used by WebRTC helpers)
        "worker-src": ["'self'", "blob:"],

        // Styles: you likely have inline styles in static HTML; keep this permissive for now.
        // You can move to nonces/hashes later if you want to remove 'unsafe-inline' here too.
        "style-src": ["'self'", "'unsafe-inline'"],

        // Network calls (REST + WebSocket)
        "connect-src": ["'self'", "https:", "wss:", "ws:", CLIENT_URL, ...EXTRA_CONNECT],

        // Media/images/fonts (WebRTC video elements use <video> with blob: URLs)
        "media-src": ["'self'", "blob:", "data:"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "font-src": ["'self'", "data:", "https:"],

        // Don’t allow embedding in other sites
        "frame-ancestors": ["'self'"]
      }
    }
  })
);

// ===== CORS for REST endpoints =====
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true
  })
);

app.use(express.json());

// ===== Static assets =====
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR, { index: false })); // we'll serve HTML below

// Helper: inject nonce on any inline <script> tags (only if present)
function injectNonce(html, nonce) {
  // Add nonce only to inline scripts that have no src=
  return html.replace(
    /<script(?![^>]*\bsrc=)([^>]*)>/gi,
    (m, attrs) => {
      if (/\bnonce=/.test(attrs)) return m; // already has nonce
      const spaced = attrs && attrs.trim().length ? " " + attrs.trim() : "";
      return `<script nonce="${nonce}"${spaced}>`;
    }
  );
}

// Serve index.html with nonce (if it has inline scripts)
app.get("/", (req, res) => {
  const p = path.join(PUBLIC_DIR, "index.html");
  fs.readFile(p, "utf8", (err, html) => {
    if (err) return res.status(500).send("index not found");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(injectNonce(html, res.locals.nonce));
  });
});

// Optional: a simple test page (served similarly)
app.get("/simple", (req, res) => {
  const p = path.join(PUBLIC_DIR, "simple.html");
  fs.readFile(p, "utf8", (err, html) => {
    if (err) return res.status(404).send("simple not found");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(injectNonce(html, res.locals.nonce));
  });
});

// ===== In-memory signaling state =====
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
      joinedAt: new Date()
    });
  }
  removeParticipant(socketId) {
    this.participants.delete(socketId);
    participants.delete(socketId);
  }
  getParticipantCount() { return this.participants.size; }
  isEmpty() { return this.participants.size === 0; }
}

// ===== Socket.IO handlers =====
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join-room", (data) => {
    const { roomId, userData } = data || {};
    try {
      let room = rooms.get(roomId);
      if (!room) {
        room = new Room(roomId, userData?.roomName || "Video Call");
        rooms.set(roomId, room);
      }
      room.addParticipant(socket.id, userData);
      socket.join(roomId);

      socket.to(roomId).emit("user-joined", {
        socketId: socket.id,
        userData,
        participantCount: room.getParticipantCount()
      });

      const existingParticipants = Array.from(room.participants)
        .filter((id) => id !== socket.id)
        .map((id) => ({ socketId: id, userData: participants.get(id) }));

      socket.emit("room-joined", {
        roomId,
        participants: existingParticipants,
        roomInfo: {
          name: room.name,
          participantCount: room.getParticipantCount(),
          createdAt: room.createdAt
        }
      });
      console.log(`Join: ${userData?.name || socket.id} -> ${roomId}`);
    } catch (e) {
      socket.emit("room-error", { message: e.message });
    }
  });

  socket.on("offer", ({ targetSocketId, offer }) => {
    const me = participants.get(socket.id);
    if (me) {
      io.to(targetSocketId).emit("offer", { fromSocketId: socket.id, fromUserData: me, offer });
    }
  });

  socket.on("answer", ({ targetSocketId, answer }) => {
    const me = participants.get(socket.id);
    if (me) {
      io.to(targetSocketId).emit("answer", { fromSocketId: socket.id, fromUserData: me, answer });
    }
  });

  socket.on("ice-candidate", ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit("ice-candidate", { fromSocketId: socket.id, candidate });
  });

  socket.on("media-state-change", (data) => {
    const me = participants.get(socket.id);
    if (me) {
      Object.assign(participants.get(socket.id), data);
      socket.to(me.roomId).emit("participant-media-change", { socketId: socket.id, mediaState: data });
    }
  });

  socket.on("screen-share-start", () => {
    const me = participants.get(socket.id);
    if (me) {
      participants.get(socket.id).isScreenSharing = true;
      socket.to(me.roomId).emit("participant-screen-share", { socketId: socket.id, isScreenSharing: true });
    }
  });

  socket.on("screen-share-stop", () => {
    const me = participants.get(socket.id);
    if (me) {
      participants.get(socket.id).isScreenSharing = false;
      socket.to(me.roomId).emit("participant-screen-share", { socketId: socket.id, isScreenSharing: false });
    }
  });

  socket.on("leave-room", () => {
    const me = participants.get(socket.id);
    if (me) {
      const room = rooms.get(me.roomId);
      if (room) {
        room.removeParticipant(socket.id);
        socket.leave(me.roomId);
        socket.to(me.roomId).emit("user-left", { socketId: socket.id, participantCount: room.getParticipantCount() });
        if (room.isEmpty()) rooms.delete(me.roomId);
      }
      socket.emit("room-left");
    }
  });

  socket.on("disconnect", () => {
    const me = participants.get(socket.id);
    if (me) {
      const room = rooms.get(me.roomId);
      if (room) {
        room.removeParticipant(socket.id);
        socket.to(me.roomId).emit("user-left", { socketId: socket.id, participantCount: room.getParticipantCount() });
        if (room.isEmpty()) {
          rooms.delete(me.roomId);
          console.log(`Room ${me.roomId} deleted (empty)`);
        }
      }
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

// ===== REST API =====
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    totalParticipants: participants.size
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
    createdAt: room.createdAt
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
    joinUrl: `${req.protocol}://${req.get("host")}/?room=${roomId}`
  });
});

// TURN/STUN config
app.get("/api/ice", (_req, res) => {
  const stun = (process.env.STUN_URLS || "stun:stun.l.google.com:19302")
    .split(",").map(s => s.trim()).filter(Boolean);
  const turn = (process.env.TURN_URLS || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const iceServers = [
    ...stun.map(url => ({ urls: url })),
    ...(turn.length ? [{ urls: turn, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }] : [])
  ];
  res.json({ iceServers });
});

// Errors
app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start
server.listen(PORT, () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM – shutting down");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

module.exports = { app, server, io };