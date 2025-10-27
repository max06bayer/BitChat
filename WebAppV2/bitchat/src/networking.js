import { Peer } from 'peerjs';
import { openDB } from 'idb';
import { logs, messages, connected_with_network, contentStorage } from '../src/store.js';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import CryptoJS from 'crypto-js';

// Fallback for environments where Buffer is not global
if (typeof window !== 'undefined' && !window.Buffer) {
    window.Buffer = Buffer;
}

const BOOTSTRAP_NODES = [
    '09f7874a33816b89be86d85bb6149d07dc7f8cf3b4d89a090a428ae27a19ea90',
    'ae17321686948704d06522bd8d3c51fd105266d86a5d1138e70a30f1e9d60041',
    'b8d41a02b998a3912a4d5fd8492188ac0e70441f342e6440ce77bcabe00c0becb',
    '88ac0e70441fa3912a4d5fd84921b9980ce77bcabe00c0becb8d41a02b998ce77',
    'ce77bcabe00c0becb8d41a02b998a3912a4d5fd8492188ac0e70441f342e6440c',
    '492188ac0e70441f342e6440ca3912a4d5fd8ce77bcabe00c0becb8d41a02b998',
    'fd8492188ac0e70441f342e6440ce77bcabe00c0becb8d41a02b998a3912a4d5f',
    '342e6440ce77bcabe00c0becb8d41a02b998a3912a4d5fd8492188ac0e70441f'
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

// --- IndexedDB Functions (UPDATED FOR USERS TABLE AND CONTENT STORAGE) ---
async function openDatabase() {
    return openDB('DecentralizedSocialDB', 4, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('transactions', { keyPath: 'signature' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('users', { keyPath: 'username' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('content', { keyPath: 'hash' });
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
async function storeUser(user) {
    const db = await openDatabase();
    await db.put('users', user);
}
async function getUser(username) {
    const db = await openDatabase();
    return await db.get('users', username);
}

// Content storage functions
async function storeContent(hash, data, type) {
    const db = await openDatabase();
    await db.put('content', { hash, data, type, timestamp: Date.now() });
    
    console.log(`✅ Stored content in local DB: ${hash.substring(0, 16)}... (type: ${type})`);
    
    // Also update the in-memory store
    contentStorage.update(current => ({
        ...current,
        [hash]: { data, type }
    }));
}

async function getContent(hash) {
    const db = await openDatabase();
    return await db.get('content', hash);
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

// Generate hash from text (same format as public keys)
export function generateTextHash(text) {
    return CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex);
}

// XOR distance calculation for DHT
function xorDistance(hash1, hash2) {
    const buf1 = Buffer.from(hash1, 'hex');
    const buf2 = Buffer.from(hash2, 'hex');
    let distance = 0n;
    
    for (let i = 0; i < buf1.length; i++) {
        distance = (distance << 8n) | BigInt(buf1[i] ^ buf2[i]);
    }
    
    return distance;
}

// Find the 3 closest nodes to a given hash
function findClosestNodes(targetHash, knownPeers, count = 3) {
    const peerArray = Array.from(knownPeers);
    
    console.log(`🔍 Finding closest nodes to hash: ${targetHash.substring(0, 16)}...`);
    console.log(`   Available peers (including bootstrap): ${peerArray.length}`);
    
    if (peerArray.length === 0) {
        console.warn(`   ⚠️ No peers available!`);
        return [];
    }
    
    const distances = peerArray.map(peerId => ({
        peerId,
        distance: xorDistance(targetHash, peerId)
    }))
    .sort((a, b) => {
        if (a.distance < b.distance) return -1;
        if (a.distance > b.distance) return 1;
        return 0;
    });
    
    const closest = distances.slice(0, count);
    console.log(`   📍 Top ${closest.length} closest nodes:`);
    closest.forEach((node, idx) => {
        const isBootstrap = BOOTSTRAP_NODES.includes(node.peerId);
        console.log(`      ${idx + 1}. ${node.peerId.substring(0, 16)}... ${isBootstrap ? '[BOOTSTRAP]' : '[CLIENT]'} (distance: ${node.distance.toString(16).substring(0, 16)}...)`);
    });
    
    return closest.map(d => d.peerId);
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
        this.privateKey = privateKey ? hexToUint8Array(privateKey) : null;
        this.pendingContentRequests = new Map();

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

    // UPDATED: postMessage now creates hashes and stores content in DHT
    async postMessage(name, content, publicKey, imageData = null, imageHash = null) {
        if (!this.privateKey) {
            console.error("Private key not available for posting.");
            return;
        }
        
        console.log(`\n📝 === POSTING NEW MESSAGE ===`);
        console.log(`   Content: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
        console.log(`   Has image: ${imageData ? 'Yes' : 'No'}`);
        
        // Step 1: Generate hash for text content
        const contentHash = generateTextHash(content);
        console.log(`   Generated content hash: ${contentHash}`);
        
        // Prepare hashes array
        const hashes = { content: contentHash };
        if (imageHash) {
            hashes.image = imageHash;
            console.log(`   Image hash: ${imageHash}`);
        }
        
        // Create transaction with hashes instead of actual content
        const postData = { 
            type: 'post', 
            sender: name, 
            hashes: hashes,
            likes: [], // NEW: Initialize empty likes array
            time: new Date().toISOString(), 
            publicKey 
        };
        const signature = await createSignedMessage(this.privateKey, postData);
        const transaction = { ...postData, signature };
        
        console.log(`   Transaction signature: ${signature.substring(0, 16)}...`);
        
        await storeTransaction(transaction);
        messages.update(current => [transaction, ...current].sort((a,b)=> new Date(b.time).getTime() - new Date(a.time).getTime()));
        
        console.log(`   📡 Broadcasting transaction to network...`);
        this.broadcast(`transaction:${JSON.stringify(transaction)}`);
        
        // Step 2: Store actual content in DHT
        console.log(`\n💾 === STORING CONTENT IN DHT ===`);
        
        // Store text content locally first
        await storeContent(contentHash, content, 'text');
        
        // Find closest nodes for content hash
        console.log(`   Current known peers: ${this.knownPeers.size}`);
        const contentNodes = findClosestNodes(contentHash, this.knownPeers, 3);
        
        if (contentNodes.length === 0) {
            console.error(`   ❌ No peers available to store content!`);
        } else {
            console.log(`   📤 Sending content to ${contentNodes.length} nodes...`);
            
            // Send content to closest nodes
            contentNodes.forEach(nodeId => {
                const payload = {
                    hash: contentHash,
                    data: content,
                    type: 'text'
                };
                console.log(`      → Sending to ${nodeId.substring(0, 16)}...`);
                this.send(nodeId, `message-content-set:${JSON.stringify(payload)}`);
            });
        }
        
        // If there's an image, store it too
        if (imageData && imageHash) {
            console.log(`\n🖼️ === STORING IMAGE IN DHT ===`);
            await storeContent(imageHash, imageData, 'image');
            
            const imageNodes = findClosestNodes(imageHash, this.knownPeers, 3);
            
            if (imageNodes.length === 0) {
                console.error(`   ❌ No peers available to store image!`);
            } else {
                console.log(`   📤 Sending image to ${imageNodes.length} nodes...`);
                
                imageNodes.forEach(nodeId => {
                    const payload = {
                        hash: imageHash,
                        data: imageData,
                        type: 'image'
                    };
                    console.log(`      → Sending to ${nodeId.substring(0, 16)}...`);
                    this.send(nodeId, `message-content-set:${JSON.stringify(payload)}`);
                });
            }
        }
        
        console.log(`✅ === POST COMPLETE ===\n`);
    }

    // NEW: Like a post
    async likePost(postSignature, publicKey) {
        if (!this.privateKey) {
            console.error("Private key not available for liking.");
            return false;
        }

        console.log(`\n❤️ === LIKING POST ===`);
        console.log(`   Post signature: ${postSignature.substring(0, 16)}...`);
        console.log(`   Your public key: ${publicKey.substring(0, 16)}...`);

        const likeData = {
            type: 'like',
            postSignature,
            publicKey,
            time: new Date().toISOString()
        };
        const signature = await createSignedMessage(this.privateKey, likeData);
        const likeTransaction = { ...likeData, signature };

        console.log(`   Broadcasting like to network...`);
        this.broadcast(`transaction:${JSON.stringify(likeTransaction)}`);

        // Update local message store
        messages.update(current => {
            return current.map(msg => {
                if (msg.signature === postSignature) {
                    if (!msg.likes) msg.likes = [];
                    if (!msg.likes.includes(publicKey)) {
                        msg.likes.push(publicKey);
                    }
                }
                return msg;
            });
        });

        // Store updated transaction
        const db = await openDatabase();
        const tx = await db.get('transactions', postSignature);
        if (tx) {
            if (!tx.likes) tx.likes = [];
            if (!tx.likes.includes(publicKey)) {
                tx.likes.push(publicKey);
            }
            await db.put('transactions', tx);
        }

        console.log(`✅ Like sent!\n`);
        return true;
    }

    // NEW: Unlike a post
    async unlikePost(postSignature, publicKey) {
        if (!this.privateKey) {
            console.error("Private key not available for unliking.");
            return false;
        }

        console.log(`\n💔 === UNLIKING POST ===`);
        console.log(`   Post signature: ${postSignature.substring(0, 16)}...`);

        const unlikeData = {
            type: 'unlike',
            postSignature,
            publicKey,
            time: new Date().toISOString()
        };
        const signature = await createSignedMessage(this.privateKey, unlikeData);
        const unlikeTransaction = { ...unlikeData, signature };

        console.log(`   Broadcasting unlike to network...`);
        this.broadcast(`transaction:${JSON.stringify(unlikeTransaction)}`);

        // Update local message store
        messages.update(current => {
            return current.map(msg => {
                if (msg.signature === postSignature) {
                    if (msg.likes) {
                        msg.likes = msg.likes.filter(pk => pk !== publicKey);
                    }
                }
                return msg;
            });
        });

        // Store updated transaction
        const db = await openDatabase();
        const tx = await db.get('transactions', postSignature);
        if (tx) {
            if (tx.likes) {
                tx.likes = tx.likes.filter(pk => pk !== publicKey);
            }
            await db.put('transactions', tx);
        }

        console.log(`✅ Unlike sent!\n`);
        return true;
    }

    // Retrieve content from DHT
    async getContentFromDHT(hash, messageLostCount = 0) {
        console.log(`\n🔎 === RETRIEVING CONTENT FROM DHT ===`);
        console.log(`   Hash: ${hash.substring(0, 16)}...`);
        console.log(`   Message lost count: ${messageLostCount}`);
        
        // First check local storage
        const localContent = await getContent(hash);
        if (localContent) {
            console.log(`   ✅ Content found locally!`);
            return localContent;
        }
        
        console.log(`   ⚠️ Content not found locally, querying network...`);
        
        // Find closest nodes
        const closestNodes = findClosestNodes(hash, this.knownPeers, 3);
        if (closestNodes.length === 0) {
            console.warn(`   ❌ No peers available to retrieve content for hash: ${hash}`);
            return null;
        }
        
        console.log(`   📥 Requesting from ${closestNodes.length} nodes sequentially...`);
        
        // Try each node in sequence
        for (let i = 0; i < closestNodes.length; i++) {
            const nodeId = closestNodes[i];
            
            try {
                console.log(`      Attempt ${i + 1}/${closestNodes.length}: ${nodeId.substring(0, 16)}...`);
                const content = await this.requestContentFromNode(nodeId, hash, messageLostCount + i);
                if (content) {
                    console.log(`      ✅ Success! Received content from ${nodeId.substring(0, 16)}...`);
                    // Store it locally for future use
                    await storeContent(hash, content.data, content.type);
                    return content;
                }
            } catch (error) {
                console.warn(`      ❌ Failed: ${error.message}`);
            }
        }
        
        console.error(`   ❌ Failed to retrieve content after trying ${closestNodes.length} nodes`);
        return null;
    }

    // Request content from a specific node
    requestContentFromNode(nodeId, hash, messageLostCount) {
        return new Promise((resolve, reject) => {
            const requestId = `${hash}-${Date.now()}`;
            
            // Set timeout
            const timeout = setTimeout(() => {
                this.pendingContentRequests.delete(requestId);
                reject(new Error('Content request timeout'));
            }, 10000);
            
            // Store callback
            this.pendingContentRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeout);
                    this.pendingContentRequests.delete(requestId);
                    resolve(data);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    this.pendingContentRequests.delete(requestId);
                    reject(error);
                }
            });
            
            // Send request
            this.send(nodeId, `message-content-get:${JSON.stringify({
                hash,
                requestId,
                messageLostCount
            })}`);
        });
    }

    connectToPeer(peerId) {
        if (peerId === this.peer.id || 
            this.knownPeers.has(peerId) || 
            this.connectingPeers.has(peerId)) {
            return;
        }
        
        if (BOOTSTRAP_NODES.includes(this.peer.id) && BOOTSTRAP_NODES.includes(peerId)) {
            return;
        }

        this.connectingPeers.add(peerId);
        console.log(`Attempting to connect to: ${peerId}`);

        const conn = this.peer.connect(peerId, {
            reliable: true
        });
        
        const timeout = setTimeout(() => {
            if (this.connectingPeers.has(peerId) && !this.knownPeers.has(peerId)) {
                console.warn(`Connection timeout for ${peerId}`);
                this.connectingPeers.delete(peerId);
                conn.close();
            }
        }, 15000);
        
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
            
            if (BOOTSTRAP_NODES.includes(peerId)) {
                setTimeout(() => {
                    console.log(`Retrying connection to bootstrap node: ${peerId}`);
                    this.connectToPeer(peerId);
                }, 5000);
            }
        });

        conn.on('close', () => {
            clearTimeout(timeout);
            this.connectingPeers.delete(peerId);
            
            if (BOOTSTRAP_NODES.includes(peerId)) {
                setTimeout(() => {
                    console.log(`Reconnecting to bootstrap node: ${peerId}`);
                    this.connectToPeer(peerId);
                }, 3000);
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
                const nonBootstrapPeers = Array.from(this.knownPeers).filter(
                    peerId => !BOOTSTRAP_NODES.includes(peerId)
                );
                conn.send(`node_info_response:${JSON.stringify(nonBootstrapPeers)}`);
            } else if (type === 'node_info_response') {
                try {
                    const peers = JSON.parse(payload);
                    peers.forEach(peerId => {
                        if (!this.knownPeers.has(peerId) && peerId !== this.peer.id) {
                            setTimeout(() => this.connectToPeer(peerId), Math.random() * 2000);
                        }
                    });
                } catch (error) {
                    console.error("Error parsing node_info_response:", error);
                }
            } else if (type === 'transaction') {
                try {
                    const transaction = JSON.parse(payload);
                    const { signature, ...signedData } = transaction;
                    const dataForVerification = JSON.parse(JSON.stringify(signedData));
                    if (dataForVerification.likes) {
                        dataForVerification.likes = [];
                    }
            
                    const isSignatureValid = await verifySignature(transaction.publicKey, signature, dataForVerification);

                    if (!isSignatureValid) {
                        console.error("INVALID SIGNATURE. Discarding transaction.", transaction);
                        return;
                    }
                    console.log("Signature is valid for transaction:", transaction.type);

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
                    } else if (transaction.type === 'like') {
                        // NEW: Handle like transactions
                        console.log(`❤️ Received like from ${transaction.publicKey.substring(0, 16)}... for post ${transaction.postSignature.substring(0, 16)}...`);
                        
                        const db = await openDatabase();
                        const post = await db.get('transactions', transaction.postSignature);
                        if (post) {
                            if (!post.likes) post.likes = [];
                            if (!post.likes.includes(transaction.publicKey)) {
                                post.likes.push(transaction.publicKey);
                                await db.put('transactions', post);
                                
                                // Update messages store
                                messages.update(current => {
                                    return current.map(msg => {
                                        if (msg.signature === transaction.postSignature) {
                                            if (!msg.likes) msg.likes = [];
                                            if (!msg.likes.includes(transaction.publicKey)) {
                                                msg.likes.push(transaction.publicKey);
                                            }
                                        }
                                        return msg;
                                    });
                                });
                            }
                        }
                    } else if (transaction.type === 'unlike') {
                        // NEW: Handle unlike transactions
                        console.log(`💔 Received unlike from ${transaction.publicKey.substring(0, 16)}... for post ${transaction.postSignature.substring(0, 16)}...`);
                        
                        const db = await openDatabase();
                        const post = await db.get('transactions', transaction.postSignature);
                        if (post && post.likes) {
                            post.likes = post.likes.filter(pk => pk !== transaction.publicKey);
                            await db.put('transactions', post);
                            
                            // Update messages store
                            messages.update(current => {
                                return current.map(msg => {
                                    if (msg.signature === transaction.postSignature) {
                                        if (msg.likes) {
                                            msg.likes = msg.likes.filter(pk => pk !== transaction.publicKey);
                                        }
                                    }
                                    return msg;
                                });
                            });
                        }
                    }
                } catch(e) {
                    console.error("Error processing transaction payload:", e);
                }
            } else if (type === 'message-content-set') {
                // Handle incoming content storage request
                try {
                    const { hash, data, type: contentType } = JSON.parse(payload);
                    console.log(`📥 Received content storage request from ${conn.peer.substring(0, 16)}...`);
                    console.log(`   Hash: ${hash.substring(0, 16)}... (type: ${contentType})`);
                    await storeContent(hash, data, contentType);
                } catch (error) {
                    console.error("Error storing content:", error);
                }
            } else if (type === 'message-content-get') {
                // Handle content retrieval request
                try {
                    const { hash, requestId, messageLostCount } = JSON.parse(payload);
                    console.log(`📤 Content request from ${conn.peer.substring(0, 16)}... for hash: ${hash.substring(0, 16)}... (lost: ${messageLostCount})`);
                    
                    const content = await getContent(hash);
                    if (content) {
                        console.log(`   ✅ Found content, sending response`);
                        this.send(conn.peer, `message-content-response:${JSON.stringify({
                            requestId,
                            hash,
                            data: content.data,
                            type: content.type,
                            success: true
                        })}`);
                    } else {
                        console.log(`   ❌ Content not found locally`);
                        this.send(conn.peer, `message-content-response:${JSON.stringify({
                            requestId,
                            hash,
                            success: false
                        })}`);
                    }
                } catch (error) {
                    console.error("Error handling content request:", error);
                }
            } else if (type === 'message-content-response') {
                // Handle content retrieval response
                try {
                    const { requestId, hash, data, type: contentType, success } = JSON.parse(payload);
                    
                    const request = this.pendingContentRequests.get(requestId);
                    if (request) {
                        if (success) {
                            console.log(`📦 Received content response for hash: ${hash.substring(0, 16)}...`);
                            request.resolve({ data, type: contentType });
                        } else {
                            request.reject(new Error('Content not found on peer'));
                        }
                    }
                } catch (error) {
                    console.error("Error handling content response:", error);
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
        console.log(`Broadcasting to ${this.knownPeers.size} peers`);
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
