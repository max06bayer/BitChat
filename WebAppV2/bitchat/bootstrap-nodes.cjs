// --- Polyfills and Dependencies ---
const WebSocket = require('ws');
global.WebSocket = WebSocket;
global.window = global;
global.location = { protocol: 'http:' };
global.navigator = { userAgent: 'node', onLine: true };
const wrtc = require('wrtc');
global.RTCPeerConnection = wrtc.RTCPeerConnection;
global.RTCSessionDescription = wrtc.RTCSessionDescription;
global.RTCIceCandidate = wrtc.RTCIceCandidate;
global.webkitRTCPeerConnection = wrtc.RTCPeerConnection;
const { Peer } = require('peerjs');

// --- Configuration ---
const BOOTSTRAP_IDS = [
  'a3912a4d5fd8492188ac0e70441f342e6440ce77bcabe00c0becb8d41a02b998',
  '09f7874a33816b89be86d85bb6149d07dc7f8cf3b4d89a090a428ae27a19ea90',
  'ae17321686948704d06522bd8d3c51fd105266d86a5d1138e70a30f1e9d60041',
  'b8d41a02b998a3912a4d5fd8492188ac0e70441f342e6440ce77bcabe00c0becb',
  '88ac0e70441fa3912a4d5fd84921b9980ce77bcabe00c0becb8d41a02b998ce77',
  'ce77bcabe00c0becb8d41a02b998a3912a4d5fd8492188ac0e70441f342e6440c',
  '492188ac0e70441f342e6440ca3912a4d5fd8ce77bcabe00c0becb8d41a02b998',
  'fd8492188ac0e70441f342e6440ce77bcabe00c0becb8d41a02b998a3912a4d5f',
  '342e6440ce77bcabe00c0becb8d41a02b998a3912a4d5fd8492188ac0e70441f',
  'e00c0becb8d41a02b998a3912a4d5fd8492188ac0e70441f342e6440ce77bcab'
];

// Shared state
const transactions = [];
const knownPeers = new Set();
// NEW: Content storage for DHT
const contentStorage = new Map(); // hash -> { data, type, timestamp }

// --- Main Function to Start a Node ---
function startBootstrapNode(id) {
  const peer = new Peer(id, {
    host: '0.0.0.0',
    port: 9000,
    path: '/bitchat',
    wrtc,
    debug: 2,
    pingInterval: 5000,
    config: { 
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }
  });

  peer.on('open', (peerId) => console.log(`✅ Bootstrap node running: ${peerId}`));
  
  peer.on('error', (err) => {
    if (err.type === 'network' || err.type === 'peer-unavailable') {
      console.warn(`⚠️ Network error in node ${id}:`, err.type);
    } else {
      console.error(`❌ Error in node ${id}:`, err.type);
    }
  });
  
  peer.on('connection', (conn) => {
    // CHANGED: Accept connections from other bootstrap nodes for DHT storage
    if (BOOTSTRAP_IDS.includes(conn.peer)) {
      console.log(`🔗 Connection from fellow bootstrap node: ${conn.peer.substring(0, 16)}...`);
    } else {
      console.log(`➡️ Incoming connection to ${id.substring(0, 16)}... from: ${conn.peer.substring(0, 16)}...`);
    }
    
    knownPeers.add(conn.peer);
    
    conn.on('data', (data) => {
      const separatorIndex = data.indexOf(':');
      if (separatorIndex === -1) return;
      const type = data.substring(0, separatorIndex);
      const payload = data.substring(separatorIndex + 1);
      
      if (type === 'node_info_request') {
        // Send all non-bootstrap peers
        const nonBootstrapPeers = Array.from(knownPeers).filter(
          peerId => !BOOTSTRAP_IDS.includes(peerId)
        );
        
        conn.send(`node_info_response:${JSON.stringify(nonBootstrapPeers)}`);
        console.log(`📋 Sent ${nonBootstrapPeers.length} peers to ${conn.peer.substring(0, 16)}...`);
        
        // Send transaction history
        console.log(`✉️ Sending ${transactions.length} transactions to ${conn.peer.substring(0, 16)}...`);
        for (const tx of transactions) {
          conn.send(`transaction:${JSON.stringify(tx)}`);
        }
      } else if (type === 'transaction') {
        try {
          const transaction = JSON.parse(payload);
          if (!transactions.some(t => t.signature === transaction.signature)) {
            console.log(`🦄 New transaction from ${transaction.sender}`);
            transactions.push(transaction);
            broadcast(`transaction:${payload}`, conn.peer);
          }
        } catch (error) {
          console.error("Error parsing transaction:", error);
        }
      } else if (type === 'message-content-set') {
        // NEW: Handle content storage requests
        try {
          const { hash, data, type: contentType } = JSON.parse(payload);
          console.log(`💾 Storing content: ${hash.substring(0, 16)}... (type: ${contentType})`);
          contentStorage.set(hash, { data, type: contentType, timestamp: Date.now() });
          console.log(`   Total stored items: ${contentStorage.size}`);
        } catch (error) {
          console.error("Error storing content:", error);
        }
      } else if (type === 'message-content-get') {
        // NEW: Handle content retrieval requests
        try {
          const { hash, requestId, messageLostCount } = JSON.parse(payload);
          console.log(`🔎 Content request for: ${hash.substring(0, 16)}... (lost count: ${messageLostCount})`);
          
          const content = contentStorage.get(hash);
          if (content) {
            console.log(`   ✅ Found! Sending to ${conn.peer.substring(0, 16)}...`);
            conn.send(`message-content-response:${JSON.stringify({
              requestId,
              hash,
              data: content.data,
              type: content.type,
              success: true
            })}`);
          } else {
            console.log(`   ❌ Not found locally`);
            conn.send(`message-content-response:${JSON.stringify({
              requestId,
              hash,
              success: false
            })}`);
          }
        } catch (error) {
          console.error("Error handling content request:", error);
        }
      }
    });
    
    conn.on('close', () => {
      console.log(`🚪 Connection closed with: ${conn.peer.substring(0, 16)}...`);
      knownPeers.delete(conn.peer);
      console.log(`Total connected peers: ${knownPeers.size}`);
    });
    
    conn.on('error', (err) => {
      console.error(`Connection error with ${conn.peer.substring(0, 16)}...:`, err.type);
    });
  });
  
  function broadcast(message, excludePeerId) {
    let broadcastCount = 0;
    for (const peerId of knownPeers) {
      // Don't broadcast to bootstrap nodes or the sender
      if (!BOOTSTRAP_IDS.includes(peerId) && peerId !== excludePeerId) {
        const connections = peer.connections[peerId];
        if (connections) {
          connections.forEach(conn => {
            if (conn && conn.open) {
              conn.send(message);
              broadcastCount++;
            }
          });
        }
      }
    }
    if (broadcastCount > 0) {
      console.log(`📢 Broadcasted to ${broadcastCount} peers`);
    }
  }
}

console.log('🚀 Starting bootstrap nodes...');
BOOTSTRAP_IDS.forEach(startBootstrapNode);

// NEW: Log storage stats periodically
setInterval(() => {
  console.log(`\n📊 === BOOTSTRAP NODE STATS ===`);
  console.log(`   Total content items stored across all nodes: ${contentStorage.size}`);
  console.log(`   Connected peers: ${knownPeers.size}`);
  console.log(`   Transactions: ${transactions.length}`);
}, 60000); // Every 60 seconds

process.on('SIGINT', () => {
  console.log('Bootstrap nodes shutting down...');
  process.exit(0);
});