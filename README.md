# WebRTC Teams Integration App 🚀

A powerful Node.js application that brings real-time video collaboration to Microsoft Teams using WebRTC technology. Built with Express, Socket.IO, and modern web standards.

## 🌟 Features

### Real-time Video Calls
- HD video communication with multiple participants
- Adaptive bitrate streaming for optimal quality
- Automatic camera/microphone device detection
- Video quality controls and settings

### Screen Sharing
- Share your screen with meeting participants
- Support for entire screen or specific application windows
- Screen share indicators and controls
- Picture-in-picture mode support

### Audio/Video Controls
- Toggle camera and microphone on/off
- Device selection (camera, microphone, speakers)
- Audio level indicators and noise suppression
- Video resolution and quality settings

### Microsoft Teams Integration
- Seamless integration as a Teams app
- Teams SDK initialization and context
- Single Sign-On (SSO) with Teams authentication
- Teams theme adaptation (default, dark, high contrast)

### Advanced Features
- Multi-participant support (up to 8 participants per room)
- STUN servers for NAT traversal
- Optional TURN servers for enterprise networks
- Real-time connection monitoring
- Participant management and status indicators
- Responsive design for desktop, tablet, and mobile

## 🛠️ Technology Stack

### Backend
- **Node.js 16+** - Server runtime
- **Express.js** - Web framework
- **Socket.IO** - Real-time signaling
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing

### Frontend
- **Vanilla HTML/CSS/JavaScript** - Core web technologies
- **WebRTC APIs** - Peer-to-peer communication
- **Microsoft Teams SDK** - Teams integration

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-service orchestration
- **Nginx** - Reverse proxy and SSL termination

## 📋 Prerequisites

### Development Requirements
- Node.js 16+ and npm 8+
- Modern web browser with WebRTC support
- HTTPS domain (required for production WebRTC)

### Teams Integration
- Microsoft Teams developer account
- Azure AD app registration
- Teams app manifest and icons

### Optional
- TURN server for enterprise NAT traversal
- SSL certificates for HTTPS
- Docker for containerization

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/yourusername/webrtc-teams-integration.git
cd webrtc-teams-integration
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Development Server
```bash
npm run dev
# Server runs on http://localhost:3001
```

### 4. Production Deployment
```bash
docker-compose up -d
# Access via https://your-domain.com
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `CLIENT_URL` | Frontend URL | https://localhost:3000 |
| `TEAMS_APP_ID` | Teams app ID | - |
| `TEAMS_CLIENT_SECRET` | Teams client secret | - |
| `TEAMS_TENANT_ID` | Azure tenant ID | - |
| `TURN_URL` | TURN server URL | - |
| `TURN_USERNAME` | TURN username | - |
| `TURN_CREDENTIAL` | TURN password | - |

### STUN/TURN Server Setup

The application uses Google's public STUN servers by default:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

For enterprise deployments, configure your own TURN server:

#### Using CoTURN (Ubuntu/Debian)
```bash
# Install CoTURN
sudo apt-get install coturn

# Configure /etc/turnserver.conf
listening-port=3478
external-ip=YOUR_PUBLIC_IP
realm=your-domain.com
fingerprint
lt-cred-mech

# Start service
sudo service coturn start
```

#### TURN Configuration in App
```javascript
const iceConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password'
    }
  ]
};
```

## 🔗 Microsoft Teams Integration

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Register new application
3. Configure redirect URIs
4. Generate client secret
5. Set API permissions

### 2. Teams App Manifest

Update `manifest.json` with your configuration:
```json
{
  "id": "your-app-id",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://yourcompany.com"
  },
  "staticTabs": [{
    "entityId": "webrtc-main",
    "contentUrl": "https://yourapp.com/index.html",
    "scopes": ["personal", "team", "groupChat"]
  }],
  "validDomains": ["yourapp.com"]
}
```

### 3. Deploy to Teams

1. Zip manifest.json with icons
2. Upload to Teams Admin Center
3. Install app in Teams client
4. Test integration

## 📁 Project Structure

```
webrtc-teams-integration/
├── public/                 # Static files
│   ├── index.html         # Main application
│   ├── style.css          # Styles
│   └── app.js            # Client-side logic
├── server.js             # Node.js server
├── manifest.json         # Teams app manifest
├── package.json          # Dependencies
├── Dockerfile           # Container config
├── docker-compose.yml   # Multi-service setup
├── nginx.conf          # Reverse proxy
└── README.md           # Documentation
```

## 🔧 API Endpoints

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/room/:id` | GET | Room information |
| `/api/room` | POST | Create new room |

### WebSocket Events

#### Client to Server
- `join-room` - Join video room
- `offer` - WebRTC offer
- `answer` - WebRTC answer  
- `ice-candidate` - ICE candidate
- `media-state-change` - Audio/video toggle
- `screen-share-start` - Start screen sharing
- `leave-room` - Leave room

#### Server to Client
- `room-joined` - Successfully joined
- `user-joined` - New participant
- `user-left` - Participant left
- `offer` - Incoming WebRTC offer
- `answer` - Incoming WebRTC answer
- `ice-candidate` - Incoming ICE candidate
- `participant-media-change` - Media state update

## 🎯 Usage Examples

### Basic Room Creation
```javascript
// Create new room
fetch('/api/room', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ roomName: 'Team Meeting' })
})
.then(response => response.json())
.then(data => {
  console.log('Room created:', data.roomId);
});
```

### WebRTC Peer Connection
```javascript
// Initialize peer connection
const peerConnection = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
});

// Handle incoming stream
peerConnection.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
};

// Handle ICE candidates
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit('ice-candidate', {
      targetSocketId: targetId,
      candidate: event.candidate
    });
  }
};
```

### Screen Sharing
```javascript
// Start screen sharing
async function startScreenShare() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });
    
    // Replace video track
    const videoTrack = screenStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );
    
    await sender.replaceTrack(videoTrack);
    socket.emit('screen-share-start');
    
  } catch (error) {
    console.error('Screen sharing failed:', error);
  }
}
```

## 🔒 Security Considerations

### HTTPS Requirement
WebRTC requires HTTPS in production:
- Use SSL certificates (Let's Encrypt recommended)
- Configure proper security headers
- Enable HSTS

### Network Security
- Configure firewall rules for STUN/TURN ports
- Use authentication for TURN servers
- Implement rate limiting

### Teams Integration Security
- Validate Teams context and tokens
- Implement proper CORS policies
- Use secure storage for secrets

## 🚦 Monitoring and Logging

### Health Checks
```bash
# Server health
curl https://your-app.com/api/health

# Docker health
docker-compose ps
```

### Logs
```bash
# Application logs
docker-compose logs -f webrtc-app

# Nginx logs
docker-compose logs -f nginx
```

### Performance Metrics
- Monitor connection success rates
- Track bandwidth usage
- Monitor server resource utilization
- Log WebRTC connection states

## 🐛 Troubleshooting

### Common Issues

#### Camera/Microphone Access Denied
- Ensure HTTPS is enabled
- Check browser permissions
- Verify SSL certificate validity

#### Connection Failures
- Check STUN server accessibility
- Configure TURN server for restrictive networks
- Verify firewall settings

#### Teams Integration Issues
- Validate app manifest
- Check Azure AD configuration
- Verify domain permissions

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# Check WebRTC internals
# Chrome: chrome://webrtc-internals/
# Firefox: about:webrtc
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [WebRTC.org](https://webrtc.org/) for WebRTC standards
- [Socket.IO](https://socket.io/) for real-time communication
- [Microsoft Teams Platform](https://docs.microsoft.com/en-us/microsoftteams/platform/) for integration docs
- [CoTURN](https://github.com/coturn/coturn) for TURN server implementation

## 📞 Support

- 📧 Email: support@yourcompany.com
- 💬 Teams: [Join Support Channel](https://teams.microsoft.com/l/channel/...)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/webrtc-teams-integration/issues)
- 📖 Docs: [Documentation Site](https://docs.yourcompany.com)

---

**Ready to bring real-time video collaboration to your Teams environment!** 🚀