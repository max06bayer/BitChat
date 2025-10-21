import { Peer } from 'peerjs';
import { openDB } from 'idb';
import { logs, messages, connected_with_network } from '../src/store.js';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

// Fallback for environments where Buffer is not global
if (typeof window !== 'undefined' && !window.Buffer) {
    window.Buffer = Buffer;
}

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

// --- IndexedDB Functions (UPDATED FOR USERS TABLE) ---
async function openDatabase() {
    return openDB('DecentralizedSocialDB', 2, { // Version must be incremented
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('transactions', { keyPath: 'signature' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('users', { keyPath: 'username' });
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
// --- NEW: User Database Functions ---
async function storeUser(user) {
    const db = await openDatabase();
    await db.put('users', user);
}
async function getUser(username) {
    const db = await openDatabase();
    return await db.get('users', username);
}

// --- Cryptography & Transaction Creation (UPDATED) ---
function hexToUint8Array(hexString) {
    return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

async function createSignedMessage(privateKey, dataToSign) {
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(JSON.stringify(dataToSign));
    const signatureBytes = nacl.sign.detached(messageBytes, privateKey);
    return Buffer.from(signatureBytes).toString('hex');
}

async function verifySignature(publicKey, signature, signedData) {
    try {
        const encoder = new TextEncoder();
        const messageBytes = encoder.encode(JSON.stringify(signedData));
        const signatureBytes = hexToUint8Array(signature);
        const publicKeyBytes = hexToUint8Array(publicKey);
        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (e) {
        console.error("Signature verification failed:", e);
        return false;
    }
}

export class PeerToPeerConnection {
    constructor(peerId = null, privateKey = null) {
        this.peer = new Peer(peerId, {
            host: 'bitchat.baby',
            path: '/bitchat',
            secure: true,
            debug: 2,
            config: { 
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ],
                iceCandidatePoolSize: 10
            }
        });
        this.knownPeers = new Set();
        this.connectingPeers = new Set();
        this.peerId = peerId;
        this.privateKey = privateKey ? hexToUint8Array(privateKey) : null; // Store private key for signing

        this.peer.on('open', async (id) => {
            console.warn('Peer is ready with ID:', id);

            const history = await getAllTransactions();
            messages.set(history.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
            
            if (!BOOTSTRAP_NODES.includes(id)) {
                console.log('This is a client node. Connecting to bootstrap nodes...');
                BOOTSTRAP_NODES.forEach((nodeId, index) => {
                    setTimeout(() => this.connectToPeer(nodeId), index * 500);
                });
            }
        });

        this.peer.on('connection', (conn) => {
            console.info('Incoming connection from:', conn.peer);
            this.setupConnectionHandlers(conn);
        });

        this.peer.on('error', (err) => {
            if (err.type === 'peer-unavailable') {
                console.warn(`Attempted to connect to an unavailable peer.`);
            } else {
                console.error('PeerJS error:', err.type, err);
            }
        });
    }

    // --- NEW: User Registration ---
    async registerUser(username, publicKey) {
        if (!this.privateKey) {
            console.error("Private key not available for registration.");
            return false;
        }
        const existingUser = await getUser(username);
        if (existingUser) {
            console.error("Username already registered!");
            return false;
        }

        const registrationData = { type: 'user_registration', username, publicKey, time: new Date().toISOString() };
        const signature = await createSignedMessage(this.privateKey, registrationData);
        const registrationTx = { ...registrationData, signature };
        
        await storeUser({ username, publicKey });
        this.broadcast(`transaction:${JSON.stringify(registrationTx)}`);
        console.log(`Successfully registered and broadcasted user: ${username}`);
        return true;
    }

    // --- UPDATED: postMessage now uses real signing ---
    async postMessage(name, content, publicKey) {
        if (!this.privateKey) {
            console.error("Private key not available for posting.");
            return;
        }
        const postData = { type: 'post', sender: name, content, time: new Date().toISOString(), publicKey };
        const signature = await createSignedMessage(this.privateKey, postData);
        const transaction = { ...postData, signature };
        
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
        this.connectingPeers.delete(conn.peer);
        connected_with_network.set(true);
        this.send(conn.peer, `node_info_request:${this.peer.id}`);

        conn.on('data', async (data) => {
            const separatorIndex = data.indexOf(':');
            const type = data.substring(0, separatorIndex);
            const payload = data.substring(separatorIndex + 1);

            if (type === 'node_info_request') {
                // ... (logic unchanged)
            } else if (type === 'node_info_response') {
                // ... (logic unchanged)
            } else if (type === 'transaction') {
                try {
                    const transaction = JSON.parse(payload);
                    const { signature, ...signedData } = transaction;

                    // --- Verification Step 1: Check Signature ---
                    const isSignatureValid = await verifySignature(transaction.publicKey, signature, signedData);
                    if (!isSignatureValid) {
                        console.error("INVALID SIGNATURE. Discarding transaction.", transaction);
                        return;
                    }
                    console.log("Signature is valid for transaction:", transaction.type);

                    // --- Verification Step 2: Handle based on type ---
                    if (transaction.type === 'user_registration') {
                        const user = await getUser(transaction.username);
                        if (!user) {
                            console.log(`Registering new user from network: ${transaction.username}`);
                            await storeUser({ username: transaction.username, publicKey: transaction.publicKey });
                        }
                    } else if (transaction.type === 'post') {
                        const user = await getUser(transaction.sender);
                        if (!user || user.publicKey !== transaction.publicKey) {
                            console.error("Post from unverified user or with mismatched public key. Discarding.", transaction);
                            return;
                        }
                        await storeTransaction(transaction);
                        messages.update(current => {
                            if (current.some(m => m.signature === transaction.signature)) return current;
                            return [transaction, ...current].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
                        });
                    }
                } catch(e) {
                    console.error("Error processing transaction payload:", e);
                }
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