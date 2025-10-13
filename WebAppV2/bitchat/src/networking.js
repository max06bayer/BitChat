
import { Peer } from 'peerjs';
import { logs } from '../src/store.js';
import { connected_with_network } from '../src/store.js';
import {hash_table} from '../src/store.js';

const bootstrap_node = '4b155bdc91027be3f733b56ca238f16f2c609670b8079ee503d0e1c0fb9f9aef';

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
            host: '188.245.50.153',
            port: 9000,
            path: '/bitchat'
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
            this.setupConnectionHandlers(conn);
        });

        this.peer.on('disconnected', () => {
            console.error('Peer disconnected');
        });

        this.peer.on('close', () => {
            console.warn('Peer connection closed');
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
        });
    }

    connectToPeer(peerId) {
        const conn = this.peer.connect(peerId);

        conn.on('open', () => {
            console.info('Connected to peer:', peerId);
            this.setupConnectionHandlers(conn);
            connected_with_network.set(true);
        });

        conn.on('error', (err) => {
            console.error('Connection error with', peerId, ':', err);
        });
    }

    addToHashTable(peerId) {
      const peerFirst16BitsHex = peerId.slice(0, 4);
      const myFirst16BitsHex = this.peer.id.slice(0, 4);
      const hash0 = BigInt('0x' + peerFirst16BitsHex);
      const hash1 = BigInt('0x' + myFirst16BitsHex);
      const distance = hash0 ^ hash1;
      return distance.toString(2).length - 1;
    }

    setupConnectionHandlers(conn) {
        conn.on('data', (data) => {
            console.log('Received data:', data);
            const [type, payload] = data.split(':');

            if (type === 'node_info_request') {
                // A peer is requesting our list of known peers.
                const requestingPeerId = payload;
                this.knownPeers.add(requestingPeerId);
                const peerList = JSON.stringify(Array.from(this.knownPeers));
                this.send(requestingPeerId, `node_info_response:${peerList}`);
                
            } else if (type === 'node_info_response') {
                // We have received a list of peers from the bootstrap node.
                const newPeers = JSON.parse(payload);
                newPeers.forEach(peerId => {
                    if (peerId !== this.peer.id && !this.knownPeers.has(peerId)) {
                        this.knownPeers.add(peerId);
                        this.connectToPeer(peerId);
                    }
                });
            }
        });

        conn.on('close', () => {
            console.warn('Connection closed with', conn.peer);
            this.knownPeers.delete(conn.peer);
        });
    }

    send(peerId, message) {
        // Use this.peer.connections to check for existing connections
        if (this.peer.connections[peerId] && this.peer.connections[peerId].length > 0) {
            const conn = this.peer.connections[peerId][0];
            if (conn.open) {
                conn.send(message);
            } else {
                console.warn('Connection to', peerId, 'is not open.');
            }
        } else {
            console.warn('No connection to', peerId, '. Use connectToPeer first.');
        }
    }
}