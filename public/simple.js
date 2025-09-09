const qs = new URLSearchParams(location.search);
const roomNameEl = document.getElementById('roomName');
const roomIdInput = document.getElementById('roomId');
const btnJoin = document.getElementById('btnJoin');
const btnLeave = document.getElementById('btnLeave');
const btnMuteAudio = document.getElementById('btnMuteAudio');
const btnMuteVideo = document.getElementById('btnMuteVideo');
const themeToggle = document.getElementById('themeToggle');
const localVideo = document.getElementById('localVideo');
const videosContainer = document.getElementById('videos');

let socket, localStream, joinedRoomId = null;
const peers = new Map();
const pendingCandidates = new Map();

// Theme toggle
themeToggle.addEventListener('click', () => {
  const body = document.body;
  const isLight = body.getAttribute('data-theme') === 'light';
  body.setAttribute('data-theme', isLight ? 'dark' : 'light');
  themeToggle.textContent = isLight ? 'Switch to Light' : 'Switch to Dark';
});

// Helpers
function log(...args) { console.log('[simple]', ...args); }
async function getIceServers() {
  try {
    const res = await fetch('/api/ice');
    const j = await res.json();
    return j.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }];
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}
function addVideoCard(id, label = id, stream) {
  let card = document.getElementById('card-' + id);
  if (!card) {
    card = document.createElement('div');
    card.className = 'video-card';
    card.id = 'card-' + id;
    card.innerHTML = `
      <div class="info">${label}</div>
      <video id="vid-${id}" autoplay playsinline></video>
      <div class="actions">
        <button class="pip">PIP</button>
        <button class="fs">FullScreen</button>
      </div>
    `;
    videosContainer.appendChild(card);

    const vid = card.querySelector('video');
    vid.srcObject = stream;
    // PIP
    card.querySelector('.pip').onclick = async () => {
      try { await vid.requestPictureInPicture(); } catch (e) { log(e); }
    };
    // Fullscreen
    card.querySelector('.fs').onclick = () => {
      vid.requestFullscreen().catch(e => log(e));
    };
  } else {
    const vid = card.querySelector('video');
    vid.srcObject = stream;
  }
}
function removeVideoCard(id) {
  const card = document.getElementById('card-' + id);
  if (card) card.remove();
}

// Media controls
btnMuteAudio.addEventListener('click', () => {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  btnMuteAudio.textContent = audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
  socket.emit('toggle-audio', { enabled: audioTrack.enabled });
});
btnMuteVideo.addEventListener('click', () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  btnMuteVideo.textContent = videoTrack.enabled ? 'Disable Video' : 'Enable Video';
  socket.emit('toggle-video', { enabled: videoTrack.enabled });
});

// Clean up
function cleanup() {
  peers.forEach(pc => pc.close());
  peers.clear();
  pendingCandidates.clear();
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  videosContainer.querySelectorAll('.video-card:not(#localCard)')
    .forEach(c => c.remove());
  roomNameEl.textContent = '—';
  btnLeave.disabled = true;
  btnMuteAudio.disabled = true;
  btnMuteVideo.disabled = true;
  btnJoin.disabled = false;
  roomIdInput.disabled = false;
  joinedRoomId = null;
  socket.disconnect();
}

// Join & Leave
async function join() {
  const roomId = roomIdInput.value.trim();
  if (!roomId) return alert('Enter a Room ID');
  // Get media
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  // Socket.io
  socket = io({ transports: ['websocket'] });
  socket.on('connect', () => log('connected', socket.id));

  socket.on('room-joined', ({ participants }) => {
    roomNameEl.textContent = roomId;
    participants.forEach(p => createPeer(p.socketId, p.name, true));
  });
  socket.on('user-joined', ({ socketId, name }) => {
    createPeer(socketId, name, false);
  });
  socket.on('offer', async ({ fromSocketId, offer, name }) => {
    await handleOffer(fromSocketId, offer, name);
  });
  socket.on('answer', ({ fromSocketId, answer }) => handleAnswer(fromSocketId, answer));
  socket.on('ice-candidate', ({ fromSocketId, candidate }) => handleIce(fromSocketId, candidate));
  socket.on('user-left', ({ socketId }) => {
    const pc = peers.get(socketId);
    if (pc) pc.close();
    peers.delete(socketId);
    removeVideoCard(socketId);
  });

  // Join
  socket.emit('join-room', { roomId, userData: { name: 'Guest' } });
  joinedRoomId = roomId;
  btnJoin.disabled = true;
  btnLeave.disabled = false;
  btnMuteAudio.disabled = false;
  btnMuteVideo.disabled = false;
  roomIdInput.disabled = true;
}

function leave() {
  socket.emit('leave-room');
  cleanup();
}

btnJoin.addEventListener('click', join);
btnLeave.addEventListener('click', leave);

// Peer connection helpers
async function createPeer(id, name, makeOffer) {
  const pc = new RTCPeerConnection({ iceServers: await getIceServers() });
  // Attach local tracks
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  // Incoming
  pc.ontrack = ev => addVideoCard(id, name, ev.streams[0]);
  // ICE
  pc.onicecandidate = ev => {
    if (ev.candidate) {
      socket.emit('ice-candidate', { targetSocketId: id, candidate: ev.candidate });
    }
  };
  peers.set(id, pc);
  addVideoCard(id, name, new MediaStream()); // placeholder

  if (makeOffer) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { targetSocketId: id, offer, name: 'Guest' });
  }
  return pc;
}

async function handleOffer(id, offer, name) {
  const pc = peers.get(id) || await createPeer(id, name, false);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { targetSocketId: id, answer });
}

function handleAnswer(id, answer) {
  const pc = peers.get(id);
  if (!pc) return;
  pc.setRemoteDescription(answer);
}

function handleIce(id, candidate) {
  const pc = peers.get(id);
  if (pc?.remoteDescription) {
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(log);
  } else {
    const q = pendingCandidates.get(id) || [];
    q.push(candidate);
    pendingCandidates.set(id, q);
  }
}
