// === Quality: Improved capture constraints (1080p30) ===
const mediaConstraints = {
  video: {
    width:  { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: { ideal: 30, max: 30 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false
  }
};


    // Global variables
    let localStream = null;
    let localVideo = null;
    let displayName = '';
    let roomId = '';
    let socket = null;
    let peers = new Map();
    let pendingCandidates = new Map();
    let isMuted = false;
    let isVideoOff = false;
    let isMirrored = true;
    let isBeautyOn = false;
    let isSpeakerView = false;
    let devices = {
      cameras: [],
      microphones: [],
      speakers: []
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', async () 
updateParticipantCount();
=> {
      await loadDevices();
      await initPreview();
      
      // Prefill room ID from URL params if available
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) {
        document.getElementById('roomId').value = roomParam;
      }
      
      // Setup event listeners
      setupEventListeners();
    });

    // Setup event listeners
    function setupEventListeners() {
      document.getElementById('mirrorPreviewBtn').addEventListener('click', togglePreviewMirror);
      document.getElementById('joinConferenceBtn').addEventListener('click', joinConference);
      document.getElementById('muteBtn').addEventListener('click', toggleMute);
      document.getElementById('videoBtn').addEventListener('click', toggleVideo);
      document.getElementById('screenBtn').addEventListener('click', toggleScreenShare);
      document.getElementById('layoutBtn').addEventListener('click', toggleLayout);
      document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
      document.getElementById('leaveBtn').addEventListener('click', leaveConference);
      document.getElementById('closeSettingsBtn').addEventListener('click', toggleSettings);
      document.getElementById('mirrorToggle').addEventListener('click', toggleMirror);
      document.getElementById('beautyToggle').addEventListener('click', toggleBeauty);
      document.getElementById('noiseToggle').addEventListener('click', toggleNoise);
      document.getElementById('speakerViewToggle').addEventListener('click', toggleSpeakerView);
      
      // Device change listeners
      document.getElementById('cameraSelect').addEventListener('change', async () => {
        if (window.previewStream || localStream) {
          await initPreview();
        }
      });

      document.getElementById('microphoneSelect').addEventListener('change', async () => {
        if (window.previewStream || localStream) {
          await initPreview();
        }
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        
        switch (e.code) {
          case 'KeyM':
            e.preventDefault();
            toggleMute();
            break;
          case 'KeyV':
            e.preventDefault();
            toggleVideo();
            break;
          case 'KeyS':
            e.preventDefault();
            toggleScreenShare();
            break;
          case 'KeyL':
            e.preventDefault();
            toggleLayout();
            break;
          case 'Escape':
            if (document.getElementById('settingsPanel').classList.contains('open')) {
              toggleSettings();
            }
            break;
        }
      });

      // Handle device changes
      navigator.mediaDevices.addEventListener('devicechange', loadDevices);

      // Handle window resize
      window.addEventListener('resize', () => {
        // Adjust layout for mobile
        const isMobile = window.innerWidth <= 768;
        const videoGrid = document.getElementById('videoGrid');
        
        if (isMobile && videoGrid.classList.contains('speaker-view')) {
          videoGrid.style.gridTemplateColumns = '1fr';
          videoGrid.style.gridTemplateRows = 'auto';
        }
      });

      // Auto-hide controls on mobile after inactivity
      let controlTimeout;
      function resetControlTimeout() {
        clearTimeout(controlTimeout);
        document.getElementById('controlBar').style.opacity = '1';
        
        if (window.innerWidth <= 768) {
          controlTimeout = setTimeout(() => {
            document.getElementById('controlBar').style.opacity = '0.7';
          }, 3000);
        }
      }

      document.addEventListener('touchmove', resetControlTimeout);
      document.addEventListener('mousemove', resetControlTimeout);

      // Initialize control timeout
      resetControlTimeout();
    }

    // Device Management
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const cameras = devices.filter(d => d.kind === 'videoinput');
        const microphones = devices.filter(d => d.kind === 'audioinput');
        const speakers = devices.filter(d => d.kind === 'audiooutput');
        
        updateDeviceSelect('cameraSelect', cameras);
        updateDeviceSelect('microphoneSelect', microphones);
        updateDeviceSelect('speakerSelect', speakers);
      } catch (error) {
        console.error('Error loading devices:', error);
      }
    }

    function updateDeviceSelect(selectId, devices) {
      const select = document.getElementById(selectId);
      select.innerHTML = '';
      
      if (devices.length === 0) {
        select.innerHTML = '<option value="">No devices found</option>';
        return;
      }
      
      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `${device.kind} ${devices.indexOf(device) + 1}`;
        select.appendChild(option);
      });
    }

    // Preview
    async function initPreview() {
      try {
        const constraints = {
          video: {
            deviceId: document.getElementById('cameraSelect').value || undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: {
            deviceId: document.getElementById('microphoneSelect').value || undefined
          }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const previewVideo = document.getElementById('previewVideo');
        previewVideo.srcObject = stream;
        previewVideo.style.transform = isMirrored ? 'scaleX(-1)' : 'none';
        
        // Store for later use
        window.previewStream = stream;
      } catch (error) {
        console.error('Error initializing preview:', error);
        alert('Could not access camera/microphone. Please check permissions.');
      }
    }

    function togglePreviewMirror() {
      isMirrored = !isMirrored;
      const previewVideo = document.getElementById('previewVideo');
      previewVideo.style.transform = isMirrored ? 'scaleX(-1)' : 'none';
    }

    // WebRTC Functions
    async function getIceServers() {
      try {
        const r = await fetch('/api/ice');
        const j = await r.json();
        return j.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }];
      } catch (e) {
        return [{ urls: 'stun:stun.l.google.com:19302' }];
      }
    }

    async function createPeer(remoteSocketId) {
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
watchOutboundVideoStats(pc);


      // when we get a remote track, attach it
      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        addParticipant(remoteSocketId, `User ${remoteSocketId.substr(0, 5)}`, stream, false);
      };

      // gather ICE and send to target peer via signaling
      pc.onicecandidate = (ev) => {
        if (ev.candidate && socket) {
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
      updateParticipantCount();
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

    function drainPendingCandidates(id) {
      const pc = peers.get(id);
      const q = pendingCandidates.get(id);
      if (!pc || !q || q.length === 0) return;
      (async () => {
        for (const c of q) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
          catch (e) { console.log('ICE add (drain) error', e); }
        }
        pendingCandidates.delete(id);
      })();
    }

    async function doAnswer(fromSocketId, offer) {
      const pc = peers.get(fromSocketId) || await createPeer(fromSocketId);
      // Only respond to an offer when stable (perfect-negotiation pattern)
      if (pc.signalingState !== 'stable') {
        console.warn('[simple] got offer in state', pc.signalingState, '— rolling back');
        await Promise.allSettled([
          pc.setLocalDescription({ type: 'rollback' }),
          pc.setRemoteDescription(offer)
        ]);
      } else {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { targetSocketId: fromSocketId, answer });

      // now it's safe to add any queued ICE from the caller
      drainPendingCandidates(fromSocketId);
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
      // safe to add any queued ICE from the answerer
      drainPendingCandidates(fromSocketId);
    }

    async function handleIce(fromSocketId, candidate) {
      const pc = peers.get(fromSocketId);
      if (!pc) return;
      // If remoteDescription isn't set yet, queue the candidate.
      if (!pc.remoteDescription) {
        const q = pendingCandidates.get(fromSocketId) || [];
        q.push(candidate);
        pendingCandidates.set(fromSocketId, q);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.log('ICE add error', e);
      }
    }

    // Join Conference
    async function joinConference() {
      displayName = document.getElementById('displayName').value.trim() || 'Guest User';
      roomId = document.getElementById('roomId').value.trim() || generateRoomId();
      
      try {
        // Get user media with selected devices
        const constraints = {
          video: {
            deviceId: document.getElementById('cameraSelect').value || undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: {
            deviceId: document.getElementById('microphoneSelect').value || undefined
          }
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Stop preview stream
        if (window.previewStream) {
          window.previewStream.getTracks().forEach(track => track.stop());
        }
        
        // Hide modal and show main UI
        document.getElementById('preJoinModal').classList.add('hidden');
        document.getElementById('header').classList.remove('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        document.getElementById('controlBar').classList.remove('hidden');
        
        // Update room info
        document.getElementById('roomName').textContent = `Room: ${roomId}`;
        document.getElementById('participantCount').textContent = '1 participant';
        
        // Add local video
        addParticipant('local', displayName, localStream, true);
        
        // Connect to signaling server
        connectSignalingServer();
        
      } catch (error) {
        console.error('Error joining conference:', error);
        alert('Failed to join conference. Please try again.');
      }
    }

    function connectSignalingServer() {
      // Connect socket.io (same origin)
      socket = io({ transports: ['websocket'] });

      // socket event handlers (match your server's events)
      socket.on('connect', () => {
        console.log('socket connected', socket.id);
        
        // Ask server to join room
        socket.emit('join-room', {
          roomId,
          userData: { name: displayName, roomName: roomId }
        });
      });

      socket.on('room-joined', async ({ participants }) => {
        // we joined; make offers to existing peers
        for (const p of participants) {
          await createPeer(p.socketId);
          await doOffer(p.socketId);
        }
        
        // Update participant count
        updateParticipantCount();
      });

      socket.on('user-joined', async ({ socketId }) => {
        // Existing participants wait for the NEW joiner to offer (avoid glare).
        // Pre-create the peer so tracks attach cleanly when offer arrives.
        await createPeer(socketId);
        // No offer here.
        
        // Update participant count
        updateParticipantCount();
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
        updateParticipantCount();
removeParticipant(socketId);
        pendingCandidates.delete(socketId);
        
        // Update participant count
        updateParticipantCount();
      });

      socket.on('disconnect', () => {
        console.log('socket disconnected');
      });
    }

    function updateParticipantCount() {
      const count = document.querySelectorAll('.video-card').length;
      document.getElementById('participantCount').textContent = `${count} participant${count !== 1 ? 's' : ''}`;
    }

    function generateRoomId() {
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Participant Management
    function addParticipant(id, name, stream, isLocal = false) {
      // Remove existing participant if any
      removeParticipant(id);
      
      const videoGrid = document.getElementById('videoGrid');
      
      const videoCard = document.createElement('div');
      videoCard.className = `video-card ${isLocal ? 'local-video' : ''} ${isMirrored && isLocal ? 'mirrored' : ''}`;
      videoCard.id = `participant-${id}`;
      
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = isLocal;
      video.srcObject = stream;
      
      const overlay = document.createElement('div');
      overlay.className = 'video-overlay';
      
      const participantInfo = document.createElement('div');
      participantInfo.className = 'participant-info';
      
      const participantName = document.createElement('span');
      participantName.className = 'participant-name';
      participantName.textContent = `${name}${isLocal ? ' (You)' : ''}`;
      
      const participantStatus = document.createElement('div');
      participantStatus.className = 'participant-status';
      
      const audioIndicator = document.createElement('div');
      audioIndicator.className = 'status-indicator';
      audioIndicator.id = `audio-${id}`;
      
      const videoIndicator = document.createElement('div');
      videoIndicator.className = 'status-indicator';
      videoIndicator.id = `video-${id}`;
      
      participantStatus.appendChild(audioIndicator);
      participantStatus.appendChild(videoIndicator);
      participantInfo.appendChild(participantName);
      participantInfo.appendChild(participantStatus);
      
      const videoActions = document.createElement('div');
      videoActions.className = 'video-actions';
      
      const pipButton = document.createElement('button');
      pipButton.className = 'action-btn';
      pipButton.title = 'Picture in Picture';
      pipButton.innerHTML = '📺';
      pipButton.addEventListener('click', () => requestPiP(id));
      
      const fullscreenButton = document.createElement('button');
      fullscreenButton.className = 'action-btn';
      fullscreenButton.title = 'Fullscreen';
      fullscreenButton.innerHTML = '⛶';
      fullscreenButton.addEventListener('click', () => requestFullscreen(id));
      
      videoActions.appendChild(pipButton);
      
      if (!isLocal) {
        const muteButton = document.createElement('button');
        muteButton.className = 'action-btn';
        muteButton.title = 'Mute';
        muteButton.innerHTML = '🔇';
        muteButton.addEventListener('click', () => muteParticipant(id));
        videoActions.appendChild(muteButton);
      }
      
      videoActions.appendChild(fullscreenButton);
      
      overlay.appendChild(participantInfo);
      overlay.appendChild(videoActions);
      
      videoCard.appendChild(video);
      videoCard.appendChild(overlay);
      videoGrid.appendChild(videoCard);
      
      if (isLocal) {
        localVideo = video;
        updateMirrorState();
        
        // Update status indicators for local user
        updateAudioIndicator(id, true);
        updateVideoIndicator(id, true);
      }
    }

    function removeParticipant(id) {
      const existing = document.getElementById(`participant-${id}`);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }

    function updateAudioIndicator(id, enabled) {
      const indicator = document.getElementById(`audio-${id}`);
      if (indicator) {
        indicator.classList.toggle('muted', !enabled);
      }
    }

    function updateVideoIndicator(id, enabled) {
      const indicator = document.getElementById(`video-${id}`);
      if (indicator) {
        indicator.classList.toggle('muted', !enabled);
        
        // Also adjust video opacity if it's the local video
        if (id === 'local') {
          const video = document.querySelector(`#participant-${id} video`);
          if (video) {
            video.style.opacity = enabled ? '1' : '0.3';
          }
        }
      }
    }

    // Control Functions
    function toggleMute() {
      if (!localStream) return;
      
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isMuted = !audioTrack.enabled;
        
        const muteBtn = document.getElementById('muteBtn');
        muteBtn.classList.toggle('active', isMuted);
        muteBtn.querySelector('.icon').textContent = isMuted ? '🎤' : '🔇';
        
        // Update status indicator
        updateAudioIndicator('local', audioTrack.enabled);
      }
    }

    function toggleVideo() {
      if (!localStream) return;
      
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        isVideoOff = !videoTrack.enabled;
        
        const videoBtn = document.getElementById('videoBtn');
        videoBtn.classList.toggle('active', isVideoOff);
        videoBtn.querySelector('.icon').textContent = isVideoOff ? '📹' : '📷';
        
        // Update status indicator
        updateVideoIndicator('local', videoTrack.enabled);
      }
    }

    async function toggleScreenShare() {
      try {
        if (document.getElementById('screenBtn').classList.contains('active')) {
          // Stop screen sharing, return to camera
          const constraints = {
            video: {
              deviceId: document.getElementById('cameraSelect').value || undefined,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: {
              deviceId: document.getElementById('microphoneSelect').value || undefined
            }
          };
          
          const newStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          // Replace video track in all peer connections
          const videoTrack = newStream.getVideoTracks()[0];
          if (localVideo && videoTrack) {
            // Update local video
            localVideo.srcObject = newStream;
            
            // Replace track in all peer connections
            peers.forEach(pc => {
              const sender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
              );
              if (sender) {
                sender.replaceTrack(videoTrack);
              }
            });
            
            localStream = newStream;
          }
          
          document.getElementById('screenBtn').classList.remove('active');
          document.getElementById('screenBtn').querySelector('.icon').textContent = '🖥️';
        } else {
          // Start screen sharing
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          
          if (localVideo) {
            // Update local video
            localVideo.srcObject = screenStream;
            
            // Replace track in all peer connections
            const videoTrack = screenStream.getVideoTracks()[0];
            peers.forEach(pc => {
              const sender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
              );
              if (sender) {
                sender.replaceTrack(videoTrack);
              }
            });
            
            localStream = screenStream;
          }
          
          document.getElementById('screenBtn').classList.add('active');
          document.getElementById('screenBtn').querySelector('.icon').textContent = '🛑';
          
          // Handle screen share end
          screenStream.getVideoTracks()[0].onended = () => {
            toggleScreenShare(); // Return to camera
          };
        }
      } catch (error) {
        console.error('Error with screen sharing:', error);
        alert('Screen sharing failed. Please try again.');
      }
    }

    function toggleLayout() {
      const videoGrid = document.getElementById('videoGrid');
      const layoutBtn = document.getElementById('layoutBtn');
      
      if (videoGrid.classList.contains('speaker-view')) {
        videoGrid.classList.remove('speaker-view');
        layoutBtn.querySelector('.icon').textContent = '⊞';
        isSpeakerView = false;
      } else {
        videoGrid.classList.add('speaker-view');
        layoutBtn.querySelector('.icon').textContent = '⊡';
        isSpeakerView = true;
      }
      
      // Update toggle in settings
      document.getElementById('speakerViewToggle').classList.toggle('active', isSpeakerView);
    }

    function leaveConference() {
      if (confirm('Are you sure you want to leave the conference?')) {
        // Stop all tracks
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        
        // Close all peer connections
        peers.forEach(pc => pc.close());
        peers.clear();
        pendingCandidates.clear();
        
        // Disconnect from signaling server
        if (socket) {
          socket.emit('leave-room');
          socket.disconnect();
          socket = null;
        }
        
        // Reset UI
        document.getElementById('preJoinModal').classList.remove('hidden');
        document.getElementById('header').classList.add('hidden');
        document.getElementById('mainContent').classList.add('hidden');
        document.getElementById('controlBar').classList.add('hidden');
        document.getElementById('settingsPanel').classList.remove('open');
        
        // Clear video grid
        document.getElementById('videoGrid').innerHTML = '';
        
        // Reset states
        isMuted = false;
        isVideoOff = false;
        isSpeakerView = false;
        
        // Restart preview
        initPreview();
      }
    }

    // Settings Functions
    function toggleSettings() {
      document.getElementById('settingsPanel').classList.toggle('open');
    }

    function toggleMirror() {
      isMirrored = !isMirrored;
      document.getElementById('mirrorToggle').classList.toggle('active', isMirrored);
      updateMirrorState();
    }

    function updateMirrorState() {
      const localVideoCard = document.querySelector('.local-video');
      if (localVideoCard) {
        localVideoCard.classList.toggle('mirrored', isMirrored);
      }
    }

    function toggleBeauty() {
      isBeautyOn = !isBeautyOn;
      document.getElementById('beautyToggle').classList.toggle('active', isBeautyOn);
      
      // Apply beauty filter (simplified demo)
      if (localVideo) {
        localVideo.style.filter = isBeautyOn ? 'blur(0.5px) brightness(1.1) contrast(1.1)' : 'none';
      }
    }

    function toggleNoise() {
      // Noise cancellation toggle (demo)
      const noiseToggle = document.getElementById('noiseToggle');
      noiseToggle.classList.toggle('active');
    }

    function toggleSpeakerView() {
      toggleLayout();
    }

    // Video Actions
    async function requestPiP(participantId) {
      const videoCard = document.getElementById(`participant-${participantId}`);
      const video = videoCard?.querySelector('video');
      
      if (video && document.pictureInPictureEnabled) {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else {
            await video.requestPictureInPicture();
          }
        } catch (error) {
          console.error('PiP error:', error);
        }
      }
    }

    function requestFullscreen(participantId) {
      const videoCard = document.getElementById(`participant-${participantId}`);
      const video = videoCard?.querySelector('video');
      
      if (video) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          video.requestFullscreen().catch(console.error);
        }
      }
    }

    function muteParticipant(participantId) {
      // In a real implementation, this would send a message to mute the participant
      console.log(`Requesting to mute participant: ${participantId}`);
      alert('Mute request sent to participant');
    }
  
// === Quality: Apply higher bitrate & stable framerate to video sender ===
async function applyVideoSenderParams(pc, localStream, kbps=3500) {
  const vt = localStream.getVideoTracks()[0];
  if (!vt) return;
  let sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
  if (!sender) {
    try { sender = pc.addTrack(vt, localStream); } catch (e) {}
  }
  if (!sender) return;
  const p = sender.getParameters();
  if (!p.encodings || !p.encodings.length) p.encodings = [{}];
  p.encodings[0].maxBitrate = kbps * 1000;
  p.encodings[0].maxFramerate = 30;
  p.degradationPreference = 'maintain-framerate';
  try { await sender.setParameters(p); } catch (e) { console.warn('setParameters failed', e); }
}


// === Quality: Prefer better codecs (VP9/VP8 or H.264 on Safari) ===
function preferBestVideoCodecs(pc) {
  const tx = (pc.getTransceivers && pc.getTransceivers().find(t => t.sender && t.sender.track && t.sender.track.kind === 'video')) || null;
  if (!tx || !window.RTCRtpSender || !RTCRtpSender.getCapabilities) return;
  const caps = RTCRtpSender.getCapabilities('video');
  if (!caps || !caps.codecs) return;
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const find = t => caps.codecs.find(c => (c.mimeType || '').toLowerCase() === t);
  const picks = [];
  if (isSafari && find('video/h264')) picks.push(find('video/h264'));
  else {
    if (find('video/vp9')) picks.push(find('video/vp9'));
    if (find('video/vp8')) picks.push(find('video/vp8'));
    if (find('video/h264')) picks.push(find('video/h264'));
  }
  const rest = caps.codecs.filter(c => !picks.includes(c));
  try { tx.setCodecPreferences([...picks, ...rest]); } catch (e) { console.warn('codec pref failed', e); }
}


// === Quality: watch outbound stats (debug) ===
function watchOutboundVideoStats(pc) {
  let lastBytes = 0, lastTs = 0;
  setInterval(async () => {
    const stats = await pc.getStats();
    stats.forEach(r => {
      if (r.type === 'outbound-rtp' && r.kind === 'video' && !r.isRemote) {
        if (lastTs) {
          const dt = (r.timestamp - lastTs) / 1000;
          const db = r.bytesSent - lastBytes;
          const kbps = (db * 8 / 1000) / dt;
          console.log(`↑ video ~${kbps.toFixed(0)} kbps, fps=${r.framesPerSecond || '?'}, loss=${r.packetsLost || 0}`);
        }
        lastBytes = r.bytesSent;
        lastTs = r.timestamp;
      }
    });
  }, 5000);
}


try { setInterval(updateParticipantCount, 5000); } catch(e) {}
