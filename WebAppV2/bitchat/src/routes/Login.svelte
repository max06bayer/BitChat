<script>
  import nacl from "tweetnacl";
  import sha256 from "crypto-js/sha256";
  import encHex from "crypto-js/enc-hex";
  import { credentials } from '../store.js';
  import { navigate } from "svelte-routing";
  import { PeerToPeerConnection } from '../networking.js';
  import LogConsole from '../lib/Console.svelte';

  const bootstrap_node = 'a3912a4d5fd8492188ac0e70441f342e6440ce77bcabe00c0becb8d41a02b998';

  let public_key = null;
  let username = "";
  let password = "";
  let network = null;
  let isConnected = false;

  // --- START: ADDED FOR CHAT ---
  let chatMessage = ""; 
  // --- END: ADDED FOR CHAT ---

  function generate_keys(u, p) {
    username = u;
    password = p;
    const seed_str = `${username}:${password}`;
    const hash_hex = sha256(seed_str).toString(encHex);
    const seed = new Uint8Array(hash_hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    const keypair = nacl.sign.keyPair.fromSeed(seed);

    public_key = Array.from(keypair.publicKey).map(byte => byte.toString(16).padStart(2, '0')).join('');
    const private_key = Array.from(keypair.secretKey).map(byte => byte.toString(16).padStart(2, '0')).join('');
    
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
        network.connectToPeer(bootstrap_node);
        setTimeout(() => {
            network.send(bootstrap_node, `node_info_request:${public_key}`);
            console.log('Requested node info from bootstrap node.');
        }, 1000);
    }
  }

  // --- START: NEW SEND MESSAGE FUNCTION ---
  function sendMessage() {
      if (!chatMessage.trim() || !network) return;
      const fullMessage = `chat_message:${username}: ${chatMessage.trim()}`;
      
      // Log it to our own console immediately
      console.log(`[ME] ${username}: ${chatMessage.trim()}`);
      
      // Broadcast it to all connected peers
      network.broadcast(fullMessage);
      
      chatMessage = ""; // Clear the input
  }
  // --- END: NEW SEND MESSAGE FUNCTION ---
</script>

<main>
  <form on:submit|preventDefault={() => generate_keys(username, password)}>
    <label for="username">Username:</label>
    <input type="text" id="username" bind:value={username} required />
    <label for="password">Password:</label>
    <input type="password" id="password" name="password" bind:value={password} required />
    <button type="submit">Login</button>
  </form>
  <hr/>
  
  <LogConsole/>

  <!-- START: ADDED CHAT INPUT UI -->
  {#if isConnected}
  <div class="chat-input-area">
      <h3>Send a Message</h3>
      <form on:submit|preventDefault={sendMessage}>
          <input type="text" bind:value={chatMessage} placeholder="Type something..." />
          <button type="submit">Send to All</button>
      </form>
  </div>
  {/if}
  <!-- END: ADDED CHAT INPUT UI -->
</main>

<style>
    .chat-input-area {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #444;
    }
    .chat-input-area form {
        display: flex;
        gap: 10px;
    }
    .chat-input-area input {
        flex-grow: 1;
    }
</style>
