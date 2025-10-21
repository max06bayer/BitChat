import { Peer } from 'peerjs';
import { openDB } from 'idb';
import { logs, messages, connected_with_network } from '../src/store.js';


const BOOTSTRAP_NODES = [
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


// --- Console Override (Preserved) ---
function overrideConsole(method) {
  const original = console[method];
  console[method] = (...args) => {
      logs.update((n) => [...n, { method, message: args.join(' ') }]);
      original.apply(console, args);
  };
}
['log', 'info', 'warn', 'error'].forEach((method) => overrideConsole(method));


// --- IndexedDB Functions ---
async function openDatabase() {
    return openDB('DecentralizedSocialDB', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'signature' });
        }
      },
    });
}
async function storeTransaction(transaction) {
    const db = await openDatabase();
    await db.put('transactions', transaction);
}
async function getAllTransactions() {
    const db = await openDatabase();
    return await db.getAll('transactions');
}


// --- Transaction Creation ---
async function createSignedTransaction(name, content, publicKey) {
    const transactionData = { sender: name, content, time: new Date().toISOString(), publicKey };
    const encoder = new TextEncoder();
    const dataToSign = encoder.encode(JSON.stringify(transactionData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataToSign);
    const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return { ...transactionData, signature };
}


export class PeerToPeerConnection {
    constructor(peerId = null) {
        this.peer = new Peer(peerId, {
            host: 'bitchat.baby',
            path: '/bitchat',
            secure: true,
            debug: 2, // Reduced debug spam
            config: { 
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ],
                iceCandidatePoolSize: 10
            }
        });
        this.knownPeers = new Set();
        this.connectingPeers = new Set(); // Track peers we're currently connecting to
        this.peerId = peerId;


        this.peer.on('open', async (id) => {
            console.warn('Peer is ready with ID:', id);

            // Load local history on startup
            const history = await getAllTransactions();
            messages.set(history.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
            
            // Connect to bootstrap nodes with staggered timing
            if (!BOOTSTRAP_NODES.includes(id)) {
                console.log('This is a client node. Connecting to bootstrap nodes...');
                
                // Connect to bootstrap nodes one at a time with delays
                BOOTSTRAP_NODES.forEach((nodeId, index) => {
                    setTimeout(() => {
                        this.connectToPeer(nodeId);
                    }, index * 500); // 500ms delay between each connection attempt
                });
            }
        });


        this.peer.on('connection', (conn) => {
            console.info('Incoming connection from:', conn.peer);
            this.setupConnectionHandlers(conn);
        });


        this.peer.on('error', (err) => {
            if (err.type === 'peer-unavailable') {
                console.warn(`Attempted to connect to an unavailable peer. This is normal for stale IDs.`);
            } else {
                console.error('PeerJS error:', err.type, err);
            }
        });
    }


    async postMessage(name, content, publicKey) {
        const transaction = await createSignedTransaction(name, content, publicKey);
        await storeTransaction(transaction);
        messages.update(current => [transaction, ...current].sort((a,b)=> new Date(b.time).getTime() - new Date(a.time).getTime()));
        
        this.broadcast(`transaction:${JSON.stringify(transaction)}`);
    }


    connectToPeer(peerId) {
        // Avoid connecting to self, existing connections, or peers we're already connecting to
        if (peerId === this.peer.id || 
            this.knownPeers.has(peerId) || 
            this.connectingPeers.has(peerId)) {
            return;
        }
        
        // If WE are a bootstrap node, don't connect to other bootstrap nodes
        if (BOOTSTRAP_NODES.includes(this.peer.id) && BOOTSTRAP_NODES.includes(peerId)) {
            return;
        }

        this.connectingPeers.add(peerId);
        console.log(`Attempting to connect to: ${peerId}`);

        const conn = this.peer.connect(peerId, {
            reliable: true
        });
        
        // Set connection timeout
        const timeout = setTimeout(() => {
            if (this.connectingPeers.has(peerId) && !this.knownPeers.has(peerId)) {
                console.warn(`Connection timeout for ${peerId}`);
                this.connectingPeers.delete(peerId);
                conn.close();
            }
        }, 15000); // 15 second timeout
        
        conn.on('open', () => {
            clearTimeout(timeout);
            console.info('Connected to peer:', peerId);
            this.connectingPeers.delete(peerId);
            this.setupConnectionHandlers(conn);
        });
        
        conn.on('error', (err) => {
            clearTimeout(timeout);
            console.warn('Connection error with', peerId, ':', err.message || err.type);
            this.connectingPeers.delete(peerId);
            
            // Retry connection to bootstrap nodes after delay
            if (BOOTSTRAP_NODES.includes(peerId)) {
                setTimeout(() => {
                    console.log(`Retrying connection to bootstrap node: ${peerId}`);
                    this.connectToPeer(peerId);
                }, 5000); // Retry after 5 seconds
            }
        });

        conn.on('close', () => {
            clearTimeout(timeout);
            this.connectingPeers.delete(peerId);
            
            // Retry connection to bootstrap nodes after delay
            if (BOOTSTRAP_NODES.includes(peerId)) {
                setTimeout(() => {
                    console.log(`Reconnecting to bootstrap node: ${peerId}`);
                    this.connectToPeer(peerId);
                }, 3000); // Retry after 3 seconds
            }
        });
    }
    
    setupConnectionHandlers(conn) {
        this.knownPeers.add(conn.peer);
        this.connectingPeers.delete(conn.peer); // Remove from connecting set
        connected_with_network.set(true);

        // Request peer list from new connection
        this.send(conn.peer, `node_info_request:${this.peer.id}`);

        conn.on('data', async (data) => {
            console.log('Received data:', data);
            const separatorIndex = data.indexOf(':');
            const type = data.substring(0, separatorIndex);
            const payload = data.substring(separatorIndex + 1);

            if (type === 'node_info_request') {
                const requestingPeerId = payload;
                this.knownPeers.add(requestingPeerId);
                
                // Filter out bootstrap nodes from the peer list we send
                const nonBootstrapPeers = Array.from(this.knownPeers).filter(
                    id => !BOOTSTRAP_NODES.includes(id)
                );
                const peerList = JSON.stringify(nonBootstrapPeers);
                this.send(requestingPeerId, `node_info_response:${peerList}`);

            } else if (type === 'node_info_response') {
                const newPeers = JSON.parse(payload);
                // Connect to all peers (connectToPeer will handle bootstrap filtering)
                newPeers.forEach(peerId => {
                    this.connectToPeer(peerId);
                });

            } else if (type === 'transaction') {
                const transaction = JSON.parse(payload);
                await storeTransaction(transaction);
                messages.update(current => {
                    if (current.some(m => m.signature === transaction.signature)) return current;
                    return [transaction, ...current].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
                });
            } else if (type === 'peer_disconnected') {
                const disconnectedPeerId = payload;
                console.warn(`Peer ${disconnectedPeerId} has disconnected.`);
                this.knownPeers.delete(disconnectedPeerId);
            }
        });

        conn.on('close', () => {
            console.warn('Connection closed with', conn.peer);
            this.knownPeers.delete(conn.peer);
            if (this.knownPeers.size === 0) {
                connected_with_network.set(false);
            }
        });
    }

    broadcast(message) {
        console.log(`Broadcasting to ${this.knownPeers.size} peers: ${message}`);
        this.knownPeers.forEach(peerId => {
            this.send(peerId, message);
        });
    }

    send(peerId, message) {
        if (peerId === this.peer.id) return;
        const connections = this.peer.connections[peerId];
        if (connections) {
            connections.forEach(conn => {
                if (conn && conn.open) {
                    conn.send(message);
                }
            });
        } else {
            console.warn('No open connection to', peerId);
        }
    }
}