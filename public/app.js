// WebRTC Teams Integration Application
class WebRTCApp {
  constructor() {
    // Application data from provided JSON
    this.stunServers = [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302", 
      "stun:stun2.l.google.com:19302"
    ];

    this.roomData = {
      roomId: "room-12345",
      roomName: "Weekly Team Sync",
      maxParticipants: 8,
      createdAt: "2025-09-02T10:32:00Z",
      duration: "00:15:32"
    };

    this.participants = [
      {
        id: "user-001",
        name: "John Smith",
        isLocal: true,
        videoEnabled: true,
        audioEnabled: true,
        isScreenSharing: false,
        connectionStatus: "connected",
        networkQuality: "good",
        joinedAt: "2025-09-02T10:32:00Z"
      },
      {
        id: "user-002", 
        name: "Sarah Johnson",
        isLocal: false,
        videoEnabled: true,
        audioEnabled: false,
        isScreenSharing: false,
        connectionStatus: "connected",
        networkQuality: "excellent",
        joinedAt: "2025-09-02T10:33:15Z"
      },
      {
        id: "user-003",
        name: "Mike Chen", 
        isLocal: false,
        videoEnabled: false,
        audioEnabled: true,
        isScreenSharing: true,
        connectionStatus: "connecting",
        networkQuality: "poor",
        joinedAt: "2025-09-02T10:34:22Z"
      }
    ];

    this.teamsContext = {
      teamName: "Engineering Team",
      channelName: "General",
      meetingId: "meet-456789",
      userPrincipalName: "john.smith@contoso.com",
      theme: "default",
      locale: "en-US",
      isInTeams: true
    };

    this.deviceOptions = {
      cameras: [
        {deviceId: "cam-001", label: "HD Webcam (Built-in)"},
        {deviceId: "cam-002", label: "External USB Camera"}
      ],
      microphones: [
        {deviceId: "mic-001", label: "Default Microphone"},
        {deviceId: "mic-002", label: "Headset Microphone"}
      ],
      speakers: [
        {deviceId: "spk-001", label: "Default Speakers"},
        {deviceId: "spk-002", label: "Headset Speakers"}
      ]
    };

    // Application state
    this.currentView = 'dashboard';
    this.localStream = null;
    this.peerConnections = new Map();
    this.isInCall = false;
    this.roomStartTime = null;

    // Initialize after DOM is ready
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkWebRTCSupport();
    this.updateDuration();
    
    // Start duration timer
    setInterval(() => this.updateDuration(), 1000);
  }

  setupEventListeners() {
    // Dashboard events
    const createBtn = document.getElementById('createRoomBtn');
    const joinBtn = document.getElementById('joinRoomBtn');
    
    if (createBtn) {
      createBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.createRoom();
      });
    }
    
    if (joinBtn) {
      joinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.joinRoom();
      });
    }
    
    // Video call controls
    const micBtn = document.getElementById('micBtn');
    const cameraBtn = document.getElementById('cameraBtn');
    const screenShareBtn = document.getElementById('screenShareBtn');
    const leaveBtn = document.getElementById('leaveBtn');
    const participantsBtn = document.getElementById('participantsBtn');
    
    if (micBtn) micBtn.addEventListener('click', () => this.toggleMicrophone());
    if (cameraBtn) cameraBtn.addEventListener('click', () => this.toggleCamera());
    if (screenShareBtn) screenShareBtn.addEventListener('click', () => this.toggleScreenShare());
    if (leaveBtn) leaveBtn.addEventListener('click', () => this.leaveCall());
    if (participantsBtn) participantsBtn.addEventListener('click', () => this.toggleParticipantsSidebar());
    
    // Header controls
    const settingsBtn = document.getElementById('settingsBtn');
    const teamsBtn = document.getElementById('teamsBtn');
    
    if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettings());
    if (teamsBtn) teamsBtn.addEventListener('click', () => this.openTeams());
    
    // Modal controls
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const settingsBackdrop = document.getElementById('settingsBackdrop');
    const closeTeamsBtn = document.getElementById('closeTeamsBtn');
    const teamsBackdrop = document.getElementById('teamsBackdrop');
    
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => this.closeModal('settingsModal'));
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', () => this.closeModal('settingsModal'));
    if (closeTeamsBtn) closeTeamsBtn.addEventListener('click', () => this.closeModal('teamsModal'));
    if (teamsBackdrop) teamsBackdrop.addEventListener('click', () => this.closeModal('teamsModal'));
    
    // Sidebar controls
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => this.closeParticipantsSidebar());
    
    // Device selection events
    const cameraSelect = document.getElementById('cameraSelect');
    const microphoneSelect = document.getElementById('microphoneSelect');
    const speakerSelect = document.getElementById('speakerSelect');
    const videoQuality = document.getElementById('videoQuality');
    
    if (cameraSelect) cameraSelect.addEventListener('change', (e) => this.changeCamera(e.target.value));
    if (microphoneSelect) microphoneSelect.addEventListener('change', (e) => this.changeMicrophone(e.target.value));
    if (speakerSelect) speakerSelect.addEventListener('change', (e) => this.changeSpeaker(e.target.value));
    if (videoQuality) videoQuality.addEventListener('change', (e) => this.changeVideoQuality(e.target.value));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  checkWebRTCSupport() {
    const webrtcSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection);
    
    if (!webrtcSupported) {
      this.showToast('WebRTC not supported', 'Please use a modern browser that supports WebRTC', 'error');
    }
  }

  async createRoom() {
    try {
      const createBtn = document.getElementById('createRoomBtn');
      if (createBtn) {
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';
      }
      
      this.showToast('Creating room...', 'Setting up your meeting room', 'info');
      
      // Simulate room creation delay
      await this.delay(1500);
      
      const roomNameInput = document.getElementById('roomNameInput');
      const roomName = roomNameInput ? roomNameInput.value || 'Weekly Team Sync' : 'Weekly Team Sync';
      this.roomData.roomName = roomName;
      this.roomData.roomId = 'room-' + Math.random().toString(36).substr(2, 9);
      
      await this.joinCall();
      this.showToast('Room created!', `Room ${this.roomData.roomId} is ready`, 'success');
      
    } catch (error) {
      this.showToast('Failed to create room', error.message, 'error');
    } finally {
      const createBtn = document.getElementById('createRoomBtn');
      if (createBtn) {
        createBtn.disabled = false;
        createBtn.textContent = 'Create Meeting';
      }
    }
  }

  async joinRoom() {
    try {
      const joinBtn = document.getElementById('joinRoomBtn');
      if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Joining...';
      }
      
      const roomCodeInput = document.getElementById('roomCodeInput');
      const roomCode = roomCodeInput ? roomCodeInput.value : '';
      
      if (!roomCode) {
        this.showToast('Room code required', 'Please enter a room code to join', 'error');
        return;
      }

      this.showToast('Joining room...', `Connecting to ${roomCode}`, 'info');
      
      // Simulate room join delay
      await this.delay(1500);
      
      this.roomData.roomId = roomCode;
      await this.joinCall();
      this.showToast('Joined successfully!', `Connected to ${roomCode}`, 'success');
      
    } catch (error) {
      this.showToast('Failed to join room', error.message, 'error');
    } finally {
      const joinBtn = document.getElementById('joinRoomBtn');
      if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Meeting';
      }
    }
  }

  async joinCall() {
    try {
      // Request media permissions
      await this.requestMediaPermissions();
      
      // Switch to video call view
      this.switchView('videoCall');
      this.isInCall = true;
      this.roomStartTime = new Date();
      
      // Initialize WebRTC simulation
      await this.initializeWebRTC();
      
      // Setup UI
      this.updateParticipantCount();
      this.renderParticipants();
      this.updateRoomInfo();
      
    } catch (error) {
      throw new Error('Failed to access camera/microphone');
    }
  }

  async requestMediaPermissions() {
    try {
      // Simulate getUserMedia call
      this.localStream = await this.simulateGetUserMedia({
        video: true,
        audio: true
      });
      
      this.showToast('Permissions granted', 'Camera and microphone access granted', 'success');
    } catch (error) {
      throw new Error('Camera/microphone access denied');
    }
  }

  async simulateGetUserMedia(constraints) {
    // Create a simulated video element for local stream
    const video = document.createElement('video');
    video.srcObject = null; // In real app, this would be the actual stream
    video.muted = true;
    video.autoplay = true;
    
    // Simulate the stream object
    return {
      id: 'local-stream',
      active: true,
      getTracks: () => [
        { kind: 'video', enabled: constraints.video },
        { kind: 'audio', enabled: constraints.audio }
      ]
    };
  }

  async initializeWebRTC() {
    // Simulate WebRTC peer connection setup
    this.participants.forEach(participant => {
      if (!participant.isLocal) {
        const pc = new RTCPeerConnectionSimulator(this.stunServers);
        this.peerConnections.set(participant.id, pc);
      }
    });
  }

  toggleMicrophone() {
    const localParticipant = this.participants.find(p => p.isLocal);
    if (!localParticipant) return;
    
    localParticipant.audioEnabled = !localParticipant.audioEnabled;
    
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.setAttribute('data-enabled', localParticipant.audioEnabled.toString());
    }
    
    // Update local stream
    if (this.localStream) {
      const audioTracks = this.localStream.getTracks().filter(track => track.kind === 'audio');
      audioTracks.forEach(track => track.enabled = localParticipant.audioEnabled);
    }
    
    this.renderParticipants();
    
    const message = localParticipant.audioEnabled ? 'Microphone unmuted' : 'Microphone muted';
    this.showToast(message, '', localParticipant.audioEnabled ? 'success' : 'info');
  }

  toggleCamera() {
    const localParticipant = this.participants.find(p => p.isLocal);
    if (!localParticipant) return;
    
    localParticipant.videoEnabled = !localParticipant.videoEnabled;
    
    const cameraBtn = document.getElementById('cameraBtn');
    if (cameraBtn) {
      cameraBtn.setAttribute('data-enabled', localParticipant.videoEnabled.toString());
    }
    
    // Update local stream
    if (this.localStream) {
      const videoTracks = this.localStream.getTracks().filter(track => track.kind === 'video');
      videoTracks.forEach(track => track.enabled = localParticipant.videoEnabled);
    }
    
    this.renderParticipants();
    
    const message = localParticipant.videoEnabled ? 'Camera on' : 'Camera off';
    this.showToast(message, '', localParticipant.videoEnabled ? 'success' : 'info');
  }

  toggleScreenShare() {
    const localParticipant = this.participants.find(p => p.isLocal);
    if (!localParticipant) return;
    
    localParticipant.isScreenSharing = !localParticipant.isScreenSharing;
    
    const screenShareBtn = document.getElementById('screenShareBtn');
    if (screenShareBtn) {
      screenShareBtn.setAttribute('data-sharing', localParticipant.isScreenSharing.toString());
    }
    
    this.renderParticipants();
    
    const message = localParticipant.isScreenSharing ? 'Screen sharing started' : 'Screen sharing stopped';
    this.showToast(message, '', 'info');
  }

  leaveCall() {
    if (confirm('Are you sure you want to leave the call?')) {
      this.isInCall = false;
      this.roomStartTime = null;
      
      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
      
      // Close peer connections
      this.peerConnections.forEach(pc => pc.close());
      this.peerConnections.clear();
      
      // Reset participant states
      const localParticipant = this.participants.find(p => p.isLocal);
      if (localParticipant) {
        localParticipant.audioEnabled = true;
        localParticipant.videoEnabled = true;
        localParticipant.isScreenSharing = false;
      }
      
      // Reset button states
      const micBtn = document.getElementById('micBtn');
      const cameraBtn = document.getElementById('cameraBtn');
      const screenShareBtn = document.getElementById('screenShareBtn');
      
      if (micBtn) micBtn.setAttribute('data-enabled', 'true');
      if (cameraBtn) cameraBtn.setAttribute('data-enabled', 'true');
      if (screenShareBtn) screenShareBtn.setAttribute('data-sharing', 'false');
      
      this.switchView('dashboard');
      this.showToast('Call ended', 'You have left the meeting', 'info');
    }
  }

  switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => view.classList.add('hidden'));
    
    // Show target view
    const targetView = document.getElementById(viewName + 'View');
    if (targetView) {
      targetView.classList.remove('hidden');
      this.currentView = viewName;
    }
    
    // Update header visibility
    const headerControls = document.querySelectorAll('#settingsBtn, #teamsBtn');
    const roomInfo = document.getElementById('roomInfo');
    
    if (viewName === 'videoCall') {
      headerControls.forEach(btn => btn.style.display = 'flex');
      if (roomInfo) roomInfo.style.display = 'flex';
    } else {
      headerControls.forEach(btn => btn.style.display = 'none');
      if (roomInfo) roomInfo.style.display = 'none';
    }
  }

  renderParticipants() {
    const videoGrid = document.getElementById('videoGrid');
    const participantsList = document.getElementById('participantsList');
    
    if (!videoGrid || !participantsList) return;
    
    // Clear existing content
    videoGrid.innerHTML = '';
    participantsList.innerHTML = '';
    
    // Update grid class based on participant count
    videoGrid.className = `video-grid participants-${this.participants.length}`;
    
    // Render video participants
    this.participants.forEach(participant => {
      // Create video element
      const videoParticipant = this.createVideoParticipant(participant);
      videoGrid.appendChild(videoParticipant);
      
      // Create sidebar participant
      const sidebarParticipant = this.createSidebarParticipant(participant);
      participantsList.appendChild(sidebarParticipant);
    });
  }

  createVideoParticipant(participant) {
    const videoDiv = document.createElement('div');
    videoDiv.className = `video-participant ${participant.isLocal ? 'local' : ''} ${participant.isScreenSharing ? 'screen-sharing' : ''}`;
    videoDiv.setAttribute('data-participant-id', participant.id);
    
    let content = '';
    
    if (participant.videoEnabled) {
      if (participant.isScreenSharing) {
        content = `
          <div class="video-element screen-share">
            <div style="background: linear-gradient(45deg, #1FB8CD 0%, #32a852 100%); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">
              🖥️ Screen Share
            </div>
          </div>
        `;
      } else {
        const bgColor = participant.isLocal ? '#1FB8CD' : ['#FFC185', '#B4413C', '#5D878F'][Math.floor(Math.random() * 3)];
        content = `
          <div class="video-element">
            <div style="background: ${bgColor}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
              📹 ${participant.name.split(' ').map(n => n[0]).join('')}
            </div>
          </div>
        `;
      }
    } else {
      content = `
        <div class="video-placeholder">
          <div class="avatar-placeholder">
            ${participant.name.split(' ').map(n => n[0]).join('')}
          </div>
          <span>${participant.name}</span>
        </div>
      `;
    }
    
    videoDiv.innerHTML = `
      ${content}
      <div class="video-participant__overlay">
        <span class="participant-name">${participant.name}${participant.isLocal ? ' (You)' : ''}</span>
        <div class="participant-indicators">
          ${!participant.audioEnabled ? '<svg class="participant-indicator muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>' : ''}
          ${participant.isScreenSharing ? '<svg class="participant-indicator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>' : ''}
        </div>
      </div>
    `;
    
    return videoDiv;
  }

  createSidebarParticipant(participant) {
    const participantDiv = document.createElement('div');
    participantDiv.className = `participant-item ${participant.isLocal ? 'local' : ''}`;
    
    participantDiv.innerHTML = `
      <div class="participant-avatar">
        ${participant.name.split(' ').map(n => n[0]).join('')}
      </div>
      <div class="participant-info">
        <h4>${participant.name}${participant.isLocal ? ' (You)' : ''}</h4>
        <div class="participant-status">
          <div class="connection-indicator ${participant.connectionStatus}"></div>
          <span class="network-quality">${participant.networkQuality}</span>
        </div>
      </div>
      <div class="participant-controls">
        ${!participant.audioEnabled ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>' : ''}
        ${participant.isScreenSharing ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>' : ''}
      </div>
    `;
    
    return participantDiv;
  }

  updateParticipantCount() {
    const countElement = document.getElementById('participantCountText');
    if (!countElement) return;
    
    const count = this.participants.length;
    countElement.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
  }

  updateRoomInfo() {
    const roomNameElement = document.getElementById('roomName');
    if (roomNameElement) {
      roomNameElement.textContent = this.roomData.roomName;
    }
  }

  updateDuration() {
    const durationElement = document.getElementById('roomDuration');
    if (!this.isInCall || !this.roomStartTime || !durationElement) return;
    
    const now = new Date();
    const elapsed = Math.floor((now - this.roomStartTime) / 1000);
    
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    const duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    durationElement.textContent = duration;
  }

  toggleParticipantsSidebar() {
    const sidebar = document.getElementById('participantsSidebar');
    if (sidebar) {
      sidebar.classList.toggle('hidden');
    }
  }

  closeParticipantsSidebar() {
    const sidebar = document.getElementById('participantsSidebar');
    if (sidebar) {
      sidebar.classList.add('hidden');
    }
  }

  openSettings() {
    this.openModal('settingsModal');
  }

  openTeams() {
    this.openModal('teamsModal');
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Trap focus in modal
    const focusableElements = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  changeCamera(deviceId) {
    this.showToast('Camera changed', `Switched to ${this.getDeviceLabel('cameras', deviceId)}`, 'success');
  }

  changeMicrophone(deviceId) {
    this.showToast('Microphone changed', `Switched to ${this.getDeviceLabel('microphones', deviceId)}`, 'success');
  }

  changeSpeaker(deviceId) {
    this.showToast('Speaker changed', `Switched to ${this.getDeviceLabel('speakers', deviceId)}`, 'success');
  }

  changeVideoQuality(quality) {
    const qualityMap = {
      high: 'High (720p)',
      medium: 'Medium (480p)',
      low: 'Low (360p)'
    };
    this.showToast('Quality changed', `Video quality set to ${qualityMap[quality]}`, 'success');
  }

  getDeviceLabel(deviceType, deviceId) {
    const device = this.deviceOptions[deviceType].find(d => d.deviceId === deviceId);
    return device ? device.label : 'Unknown device';
  }

  handleKeyboardShortcuts(e) {
    if (this.currentView !== 'videoCall') return;
    
    // Prevent shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch (e.key.toLowerCase()) {
      case 'm':
        e.preventDefault();
        this.toggleMicrophone();
        break;
      case 'v':
        e.preventDefault();
        this.toggleCamera();
        break;
      case 's':
        e.preventDefault();
        this.toggleScreenShare();
        break;
      case 'p':
        e.preventDefault();
        this.toggleParticipantsSidebar();
        break;
      case 'escape':
        this.closeParticipantsSidebar();
        this.closeModal('settingsModal');
        this.closeModal('teamsModal');
        break;
    }
  }

  showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    
    const iconMap = {
      success: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      info: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };
    
    toast.innerHTML = `
      ${iconMap[type] || iconMap.info}
      <div class="toast__content">
        <div class="toast__title">${title}</div>
        ${message ? `<div class="toast__message">${message}</div>` : ''}
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Simulate RTCPeerConnection for demo purposes
class RTCPeerConnectionSimulator {
  constructor(stunServers) {
    this.stunServers = stunServers;
    this.connectionState = 'connecting';
    this.iceConnectionState = 'checking';
    
    // Simulate connection process
    setTimeout(() => {
      this.connectionState = 'connected';
      this.iceConnectionState = 'connected';
    }, Math.random() * 3000 + 1000);
  }

  close() {
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
  }

  addStream(stream) {
    // Simulate adding stream
  }

  createOffer() {
    return Promise.resolve({
      type: 'offer',
      sdp: 'simulated-sdp-offer'
    });
  }

  createAnswer() {
    return Promise.resolve({
      type: 'answer',
      sdp: 'simulated-sdp-answer'
    });
  }

  setLocalDescription(desc) {
    return Promise.resolve();
  }

  setRemoteDescription(desc) {
    return Promise.resolve();
  }

  addIceCandidate(candidate) {
    return Promise.resolve();
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.webrtcApp = new WebRTCApp();
});