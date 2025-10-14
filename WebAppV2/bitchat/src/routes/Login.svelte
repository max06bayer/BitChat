<script>
  import nacl from "tweetnacl";
  import sha256 from "crypto-js/sha256";
  import encHex from "crypto-js/enc-hex";
  import { credentials, messages } from '../store.js';
  import { PeerToPeerConnection } from '../networking.js';
  import LogConsole from '../lib/Console.svelte';
  import { Link } from "svelte-routing";

  // Import the font for a modern look
  import "@fontsource/geist/300.css";

  const bootstrap_node = 'a3912a4d5fd8492188ac0e70441f342e6440ce77bcabe00c0becb8d41a02b998';

  let public_key = null;
  let username = "";
  let password = "";
  let network = null;
  let isConnected = false;
  let chatMessage = ""; 

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

  function sendMessage() {
      if (!chatMessage.trim() || !network) return;
      const fullMessage = `${username}: ${chatMessage.trim()}`;
      
      // THIS IS THE FIX: Update the store so your own message appears instantly.
      messages.update(msgs => [...msgs, `[ME] ${fullMessage}`]);
      
      // Broadcast to the network.
      network.broadcast(`chat_message:${fullMessage}`);
      
      chatMessage = "";
  }
</script>

<main>
  <!-- 1. Top inputs on one compact line -->
  <form on:submit|preventDefault={() => generate_keys(username, password)} class="login-form">
    <input type="text" placeholder="Username" bind:value={username} required />
    <input type="password" placeholder="Password" bind:value={password} required />
    <button type="submit">Connect</button>
  </form>

  <!-- 2. Console is wider, rounded, and has invisible scrollbars -->
  <LogConsole />

  <!-- 3. Chat pane with a less tall message list -->
  <div class="chat-pane">
    <div class="message-list">
      {#if $messages.length === 0}
        <p class="no-messages">Connect to begin chatting.</p>
      {:else}
        {#each $messages as msg}
          <div 
            class="message" 
            class:me={msg.startsWith('[ME]')}
          >
            {msg.replace('[ME] ', '')}
          </div>
        {/each}
      {/if}
    </div>

    <!-- 4. Chat input with white button and icon -->
    <form on:submit|preventDefault={sendMessage} class="message-form">
      <input 
        type="text" 
        bind:value={chatMessage} 
        placeholder={isConnected ? "Type a message..." : "Connect to enable chat"}
        disabled={!isConnected}
      />
      <button type="submit" disabled={!isConnected} aria-label="Send">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </form>
  </div>
</main>

<Link to="/impressum" class="impressum-link">Impressum</Link>

<style>
  /* Global styles for font and background */
  :global(body) {
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
    background-color: #121212;
    color: #e0e0e0;
    margin: 0;
  }
  
  /* Main layout container */
  main {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 2rem);
    max-width: 700px;
    margin: 1rem auto;
    gap: 1rem;
  }

  /* Login form styling */
  .login-form {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .login-form input {
    flex-grow: 1;
    background-color: #2a2a2a;
    border: 1px solid #3a3a3a;
    border-radius: 12px;
    padding: 0.5rem 1rem;
    color: #e0e0e0;
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
  }
  .login-form button {
    background-color: white;
    color: black;
    border: none;
    border-radius: 12px;
    padding: 0.5rem 1.25rem;
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
    cursor: pointer;
  }

  /* Chat area fills remaining space */
  .chat-pane {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background-color: #1e1e1e;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    padding: 1rem;
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
  }
  .message-list {
    flex-grow: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    /* --- Invisible Scrollbar --- */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .message-list::-webkit-scrollbar {
    display: none;
  }

  .no-messages { color: #666; text-align: center; margin: auto; }
  
  .message {
    padding: 0.5rem 1rem;
    border-radius: 12px;
    background-color: #2a2a2a;
    max-width: 80%;
    word-break: break-word;
    align-self: flex-start; /* Messages from others align left */
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
  }
  .message.me {
    background-color: #3a3a3a;
    align-self: flex-end; /* Your messages align right */
  }

  /* Message input styling */
  .message-form {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    flex-shrink: 0;
  }
  .message-form input {
    flex-grow: 1;
    background-color: #2a2a2a;
    border: 1px solid #3a3a3a;
    border-radius: 12px;
    padding: 0.5rem 1rem;
    color: #e0e0e0;
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
  }
  .message-form button {
    background-color: white;
    border: none;
    border-radius: 12px;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
  }
  .message-form button svg {
    position: relative;
    stroke: black; /* Icon color matches button text */
    transform: translateX(-1px);
    stroke-width: 1.5;
  }
  button:disabled {
    background-color: #3a3a3a !important;
    cursor: not-allowed;
  }
  button:disabled svg {
    stroke: #666;
  }

  :global(.impressum-link) {
    position: fixed;
    bottom: 1rem;
    left: 1rem;
    color: #a0a0a0;
    text-decoration: underline;
    font-size: 15px;
    z-index: 100;
    cursor: pointer;
  }
  :global(.impressum-link):hover {
    color: #fff;
    background: #2a2a2a;
  }


</style>
