// Simple WebRTC + Socket.IO client for your signaling server

const qs = new URLSearchParams(location.search);
const roomIdInput = document.getElementById('roomId');
const btnJoin = document.getElementById('btnJoin');
const btnLeave = document.getElementById('btnLeave');
const localVideo = document.getElementById('localVideo');
const remotes = document.getElementById('remotes');

// keep some state
let socket;
let localStream;
let joinedRoomId = null;
// map of remoteSocketId -> RTCPeerConnection
const peers = new Map();

function log(...args) { console.log('[simple]', ...args); }

async function getIceServers() {
  try {
    const r = await fetch('/api/ice');
    const j = await r.json();
    return j.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }];
  } catch (e) {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}

function addRemoteVideoEl(id) {
  let el = document.getElementById('v-' + id);
  if (!el) {
    el = document.createElement('video');
    el.id = 'v-' + id;
    el.autoplay = true;
    el.playsInline = true;
    remotes.appendChild(el);
  }
  return el;
}

function removeRemoteVideoEl(id) {
  const el = document.getElementById('v-' + id);
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// create and wire an RTCPeerConnection for a given remote peer
async function createPeer(remoteSocketId) {
  const iceServers = await getIceServers();
  const pc = new RTCPeerConnection({ iceServers });

  // when we get a remote track, attach it
  pc.ontrack = (ev) => {
    const [stream] = ev.streams;
    const el = addRemoteVideoEl(remoteSocketId);
    el.srcObject = stream;
  };

  // gather ICE and send to target peer via signaling
  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      socket.emit('ice-candidate', {
        targetSocketId: remoteSocketId,
        candidate: ev.candidate
      });
    }
  };

  // add our local tracks
  if (localStream) {
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  }

  peers.set(remoteSocketId, pc);
  return pc;
}

async function doOffer(remoteSocketId) {
  const pc = peers.get(remoteSocketId) || await createPeer(remoteSocketId);
  // Only create an offer from 'stable' state.
  if (pc.signalingState !== 'stable') {
    console.warn('[simple] skip offer, state =', pc.signalingState);
    return;
  }
  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
  await pc.setLocalDescription(offer);
  socket.emit('offer', { targetSocketId: remoteSocketId, offer });
}

async function handleAnswer(fromSocketId, answer) {
  const pc = peers.get(fromSocketId);
  if (!pc) return;
  // Only accept an answer when we actually have a local offer outstanding
  if (pc.signalingState !== 'have-local-offer') {
    console.warn('[simple] ignoring answer in state:', pc.signalingState);
    return;
  }
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleAnswer(fromSocketId, answer) {
  const pc = peers.get(fromSocketId);
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleIce(fromSocketId, candidate) {
  const pc = peers.get(fromSocketId);
  if (!pc) return;
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    log('ICE add error', e);
  }
}

async function startLocalMedia() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  return localStream;
}

function cleanup() {
  peers.forEach((pc, id) => { try { pc.close(); } catch {} });
  peers.clear();
  remotes.innerHTML = '';
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
    localVideo.srcObject = null;
  }
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }
  joinedRoomId = null;
  btnLeave.disabled = true;
  btnJoin.disabled = false;
  roomIdInput.disabled = false;
}

async function join() {
  const roomId = roomIdInput.value.trim();
  if (!roomId) { alert('Enter a Room ID'); return; }

  await startLocalMedia();

  // connect socket.io (same origin)
  socket = io({ transports: ['websocket'] });

  // socket event handlers (match your server’s events)
  socket.on('connect', () => log('socket connected', socket.id));

  socket.on('room-joined', async ({ participants }) => {
    // we joined; make offers to existing peers
    for (const p of participants) {
      await createPeer(p.socketId);
      await doOffer(p.socketId);
    }
  });

socket.on('user-joined', async ({ socketId }) => {
  // Existing participants wait for the NEW joiner to offer (avoid glare).
  // Pre-create the peer so tracks attach cleanly when offer arrives.
  await createPeer(socketId);
  // No offer here.
});

  socket.on('offer', async ({ fromSocketId, offer }) => {
    await doAnswer(fromSocketId, offer);
  });

  socket.on('answer', async ({ fromSocketId, answer }) => {
    await handleAnswer(fromSocketId, answer);
  });

  socket.on('ice-candidate', async ({ fromSocketId, candidate }) => {
    await handleIce(fromSocketId, candidate);
  });

  socket.on('user-left', ({ socketId }) => {
    const pc = peers.get(socketId);
    if (pc) { try { pc.close(); } catch {} }
    peers.delete(socketId);
    removeRemoteVideoEl(socketId);
  });

  socket.on('disconnect', () => {
    log('socket disconnected');
  });

  // finally, ask server to join
  socket.emit('join-room', {
    roomId,
    userData: { name: 'Guest', roomName: roomId }
  });

  joinedRoomId = roomId;
  btnJoin.disabled = true;
  btnLeave.disabled = false;
  roomIdInput.disabled = true;
}

function leave() {
  if (socket) {
    socket.emit('leave-room');
  }
  cleanup();
}

// UI wiring
btnJoin.addEventListener('click', join);
btnLeave.addEventListener('click', leave);

// optional: prefill room from ?room= query
const qpRoom = qs.get('room');
if (qpRoom) {
  roomIdInput.value = qpRoom;
}
