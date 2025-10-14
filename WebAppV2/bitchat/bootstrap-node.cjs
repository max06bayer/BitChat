// --- Define polyfills BEFORE loading peerjs ---

// WebSocket (signaling)
const WebSocket = require('ws');
global.WebSocket = WebSocket;

// Minimal browser globals some code expects
global.window = global;
global.location = { protocol: 'http:' };
global.navigator = { userAgent: 'node', onLine: true };

// WebRTC primitives from wrtc (data channels, etc.)
const wrtc = require('wrtc');
global.RTCPeerConnection = wrtc.RTCPeerConnection;
global.RTCSessionDescription = wrtc.RTCSessionDescription;
global.RTCIceCandidate = wrtc.RTCIceCandidate;
// Some libs sniff prefixed names:
global.webkitRTCPeerConnection = wrtc.RTCPeerConnection;

// Now load PeerJS after the environment is ready
const { Peer } = require('peerjs');

// --- Bootstrap node logic ---

const bootstrap_node_id = 'a3912a4d5fd8492188ac0e70441f342e6440ce77bcabe00c0becb8d41a02b998';

const peer = new Peer(bootstrap_node_id, {
  host: '127.0.0.1',
  port: 9000,
  path: '/bitchat',
  secure: false,
  debug: 3,
  // Pass wrtc so PeerJS can create RTCPeerConnection in Node
  wrtc,
  // Helpful ICE servers; add your TURN later if needed
  config: {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }
});

const knownPeers = new Set();

peer.on('open', (id) => {
  console.log('✅ Bootstrap node is running with ID:', id);
});

peer.on('connection', (conn) => {
  console.log('➡️  Incoming connection from:', conn.peer);
  setupConnectionHandlers(conn);
});

peer.on('disconnected', () => {
  console.log('🔌 Disconnected from signaling. Letting pm2 handle restarts if needed.');
});

peer.on('error', (err) => {
  console.error('❌ PeerJS error:', err);
});

function setupConnectionHandlers(conn) {
  conn.on('open', () => {
    console.log('🤝 Connection established with:', conn.peer);
    knownPeers.add(conn.peer);
  });

  conn.on('data', (data) => {
    const message = data.toString();
    console.log(`📥 From ${conn.peer}:`, message);
    const [type, payload] = message.split(':');

    if (type === 'node_info_request') {
      const requestingPeerId = payload;
      knownPeers.add(requestingPeerId);
      const peerList = JSON.stringify(Array.from(knownPeers));
      conn.send(`node_info_response:${peerList}`);
      console.log(`📤 Sent peer list to ${requestingPeerId}`);
    }
  });

  conn.on('close', () => {
    console.log('Connection closed with:', conn.peer);
    knownPeers.delete(conn.peer);
  });
}

process.on('SIGINT', () => {
  console.log('Bootstrap node shutting down...');
  peer.destroy();
  process.exit(0);
});

console.log('🚀 Bootstrap node starting...');
