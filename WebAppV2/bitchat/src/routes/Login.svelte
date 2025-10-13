<!-- Login.svelte -->
<script>
  import nacl from "tweetnacl";
  import sha256 from "crypto-js/sha256";
  import encHex from "crypto-js/enc-hex";
  import { credentials } from '../store.js';
  import { navigate } from "svelte-routing";
  import { PeerToPeerConnection } from '../networking.js';
  import LogConsole from '../lib/Console.svelte';
  import { onMount } from 'svelte';

  const bootstrap_node = '4b155bdc91027be3f733b56ca238f16f2c609670b8079ee503d0e1c0fb9f9aef';

  let public_key = null;
  let private_key = null;
  let username = "";
  let password = "";
  let network = null;
  let isConnected = false;

  function generate_keys(username, password) {
    const seed_str = `${username}:${password}`;
    const hash_hex = sha256(seed_str).toString(encHex);
    const seed = new Uint8Array(hash_hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    const keypair = nacl.sign.keyPair.fromSeed(seed);

    public_key = Array.from(keypair.publicKey).map(byte => byte.toString(16).padStart(2, '0')).join('');
    private_key = Array.from(keypair.secretKey).map(byte => byte.toString(16).padStart(2, '0')).join('');
    
    credentials.set({ username, public_key, private_key });

    network = new PeerToPeerConnection(public_key);
    network.peer.on('open', (id) => {
        isConnected = true;
        console.log('Peer is ready with ID:', id);
        bootstrap();
    });
  }

  function bootstrap() {
    if (public_key !== bootstrap_node && isConnected) {
        // Connect to the bootstrap node to get the list of other peers
        network.connectToPeer(bootstrap_node);
        
        // A short delay to ensure the connection is established before sending data
        setTimeout(() => {
            network.send(bootstrap_node, `node_info_request:${public_key}`);
            console.log('Requested node info from bootstrap node.');
        }, 1000);
    }
  }
</script>

<main>
  <h1>Sign In</h1>
  <form on:submit|preventDefault={() => generate_keys(username, password)}>
    <label for="username">Username:</label>
    <input type="text" id="username" bind:value={username} required />
    <label for="password">Password:</label>
    <input type="password" id="password" name="password" bind:value={password} required />
    <button type="submit">Login / Register</button>
  </form>
  <LogConsole/>
</main>
