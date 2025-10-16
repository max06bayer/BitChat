import { Peer } from 'peerjs';
import { logs, messages } from '../src/store.js'; // <-- IMPORT MESSAGES
import { connected_with_network } from '../src/store.js';
import { hash_table } from '../src/store.js';

const bootstrap_node = 'a3912a4d5fd8492188ac0e70441f342e6440ce77bcabe00c0becb8d41a02b998';

function overrideConsole(method) {
  const original = console[method];
  console[method] = (...args) => {
      logs.update((n) => [...n, { method, message: args.join(' ') }]);
      original.apply(console, args);
  };
}
['log', 'info', 'warn', 'error'].forEach((method) => overrideConsole(method));

export class PeerToPeerConnection {
    constructor(peerId = null) {
        this.peer = new Peer(peerId, {
            host: 'bitchat.baby', // Your new domain
            path: '/bitchat',   // The path Nginx is listening for
            secure: true,       // Use a secure connection (WSS)
            debug: 3,
            config: {
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            }
        });
        this.knownPeers = new Set();

        this.peer.on('open', (id) => {
            console.warn('Peer is ready with ID:', id);
            if (peerId != bootstrap_node) {
                this.connectToPeer(bootstrap_node);
            }
        });

        this.peer.on('connection', (conn) => {
            console.info('Incoming connection from:', conn.peer);
            this.knownPeers.add(conn.peer);
            this.setupConnectionHandlers(conn);
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
        });
    }

    connectToPeer(peerId) {
        const conn = this.peer.connect(peerId);
        conn.on('open', () => {
            console.info('Connected to peer:', peerId);
            this.knownPeers.add(peerId);
            this.setupConnectionHandlers(conn);
            connected_with_network.set(true);
        });
        conn.on('error', (err) => {
            console.error('Connection error with', peerId, ':', err);
        });
    }
    
    setupConnectionHandlers(conn) {
        conn.on('data', (data) => {
            console.log('Received data:', data);
            const [type, ...payloadParts] = data.split(':');
            const payload = payloadParts.join(':');

            if (type === 'node_info_request') {
                const requestingPeerId = payload;
                this.knownPeers.add(requestingPeerId);
                const peerList = JSON.stringify(Array.from(this.knownPeers));
                this.send(requestingPeerId, `node_info_response:${peerList}`);
            } else if (type === 'node_info_response') {
                const newPeers = JSON.parse(payload);
                newPeers.forEach(peerId => {
                    if (peerId !== this.peer.id && !this.knownPeers.has(peerId)) {
                        this.connectToPeer(peerId);
                    }
                });
            } else if (type === 'chat_message') {
                // --- UPDATE UI INSTEAD OF CONSOLE ---
                messages.update(msgs => [payload, ...msgs]);
            }
        });

        conn.on('close', () => {
            console.warn('Connection closed with', conn.peer);
            this.knownPeers.delete(conn.peer);
        });
    }

    broadcast(message) {
        console.log(`Broadcasting to ${this.knownPeers.size} peers: ${message}`);
        this.knownPeers.forEach(peerId => {
            if (peerId !== this.peer.id) {
                 this.send(peerId, message);
            }
        });
    }

    send(peerId, message) {
        const conn = this.peer.connections[peerId]?.[0];
        if (conn && conn.open) {
            conn.send(message);
        } else {
            console.warn('No open connection to', peerId);
        }
    }
}