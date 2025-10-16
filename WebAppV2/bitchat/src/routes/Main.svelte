<script>
  import nacl from "tweetnacl";
  import sha256 from "crypto-js/sha256";
  import encHex from "crypto-js/enc-hex";
  import { credentials, messages } from '../store.js';
  import { PeerToPeerConnection } from '../networking.js';
  import LogConsole from '../lib/Console.svelte';
  import { Link } from "svelte-routing";

  // Import fonts
  import "@fontsource/geist/300.css";
  import "@fontsource/questrial";

  const bootstrap_node = 'a3912a4d5fd8492188ac0e70441f342e6440ce77bcabe00c0becb8d41a02b998';

  // State variables
  let public_key = null;
  let username = "";
  let password = "";
  let network = null;
  let isConnected = false;
  let chatMessage = ""; 
  let showLogin = true;
  let isLoading = false;

  function generate_keys(u, p) {
    isLoading = true;
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
        isLoading = false;
        showLogin = false;
        console.log('Peer is ready with ID:', id);
        bootstrap();
    });
    network.peer.on('error', () => {
        isLoading = false;
    });
  }

  function parseHashtags(text) {
    // A regular expression to find words starting with #
    const hashtagRegex = /(#\w+)/g;
    // Replace found hashtags with a styled span
    return text.replace(hashtagRegex, '<span class="hashtag">$1</span>');
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

  // --- FIX 1: New messages now go to the START of the array ---
  function sendMessage() {
      if (!chatMessage.trim() || !network) return;
      const fullMessage = `${username}: ${chatMessage.trim()}`;
      // Add the new message to the beginning of the array
      messages.update(msgs => [`[ME] ${fullMessage}`, ...msgs]);
      network.broadcast(`chat_message:${fullMessage}`);
      chatMessage = "";
  }
  
  function getSenderFromMessage(msg) {
    const content = msg.replace('[ME] ', '');
    const parts = content.split(':');
    return parts[0].trim();
  }

  function getBodyFromMessage(msg) {
    const content = msg.replace('[ME] ', '');
    const parts = content.split(':');
    parts.shift(); 
    return parts.join(':').trim();
  }

  function getFormattedTimeFromMessage() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<main>
  <div class="top-left-logo">
    <img src="/bitchat.svg" alt="BitChat Logo" />
  </div>
  <!-- Login Modal (Untouched) -->
  {#if showLogin}
    <div class="login-overlay">
      <div class="login-box">
        <h1>Connect to Network</h1>
        <form on:submit|preventDefault={() => generate_keys(username, password)}>
          <input type="text" placeholder="Benutzername" bind:value={username} required disabled={isLoading} />
          <input type="password" placeholder="Passwort" bind:value={password} required disabled={isLoading} />
          <button type="submit" disabled={isLoading}>
            {#if isLoading}
              Connecting...
            {:else}
              <img src="./next.svg" alt=">>>" />
            {/if}
          </button>
        </form>
      </div>
    </div>
  {/if}

  <div class="app-container">
    <div class="feed-container">
      <div class="posts-list">
        {#if $messages.length === 0}
          <div class="no-messages-placeholder">
            Connect to the network to see posts.
          </div>
        {:else}
          {#each $messages as msg}
            <div class="post">
              <div class="post-header">
                <span class="sender-name">{getSenderFromMessage(msg)}</span>
                <span class="timestamp">{getFormattedTimeFromMessage()}</span>
              </div>
              <div class="post-body">
                {@html parseHashtags(getBodyFromMessage(msg))}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <form on:submit|preventDefault={sendMessage} class="chat-input-form">
        <input 
          type="text" 
          bind:value={chatMessage} 
          placeholder={isConnected ? "Type a message..." : "Connect to post a message"}
          disabled={!isConnected} 
        />
        <button type="submit" disabled={!isConnected} aria-label="Send">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
    </div>

    <div class="console-container">
      <LogConsole />
    </div>

  </div>
</main>

<Link to="/impressum" class="impressum-link">Impressum</Link>

<style>
  /* Login Modal Styles (Untouched) */
  .login-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .login-box {
    background-color: black;
    padding: 1.5rem;
    border-radius: 24px;
    width: 100%;
    max-width: 320px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }
  .login-box::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: url('./texture.jpg');
    background-size: cover;
    opacity: 0.1;
    pointer-events: none;
  }
  .login-box h1 {
    font-family: 'Questrial', sans-serif;
    font-size: 1.7rem;
    font-weight: 300;
    text-align: center;
    color: #fff;
    margin: 0 0 3rem 0;
    margin-top: 2rem;
  }
  .login-box form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .login-box input {
    background-color: #1a1a1a;
    border: 1px solid #333;
    border-radius: 14px;
    padding: 10px 12px;
    color: #e0e0e0;
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
  }
  .login-box button {
    background-color: #fff;
    color: #000;
    border: none;
    border-radius: 12px;
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    cursor: pointer;
    height: 40px;
    transition: linear;
  }
  .login-box button img {
    height: 16px;
  }
  .login-box button:disabled {
    background-color: #555;
    color: #999;
    cursor: not-allowed;
  }

  /* --- Main Layout Styles --- */
  :global(body) {
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
    background-color: #000000;
    color: #e0e0e0;
    margin: 0;
    background-image: url('/background.jpg');
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    background-attachment: fixed; /* Keeps the background static during scroll */
    /* --- END OF ADDITIONS --- */

    background-color: #000000; /* This acts as a fallback color */
    color: #e0e0e0;
    margin: 0;
    overflow: hidden; /* Prevent body scroll */
  }
  
  main {
    padding: 24px;
    box-sizing: border-box;
    height: 100vh;
  }
  
  .app-container {
    display: flex;
    gap: 16px;
    height: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  .feed-container {
    flex: 2;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
    background: #121212;
    background: linear-gradient(90deg,rgba(22, 22, 22, 0.7) 0%, rgba(22, 22, 22, 1) 65%);
    border-radius: 16px;
    border: 1px solid #3a3a3a;
    padding: 0rem;
    box-sizing: border-box;
  }
  
  .feed-container::after {
    content: '';
    position: absolute;
    bottom: 0rem;
    left: 0rem;
    right: 0rem;
    height: 150px;
    background: linear-gradient(to top, #0d0d0d, transparent);
    pointer-events: none;
    z-index: 5;
    border-radius: 0 0 16px 16px;
  }

  .console-container {
    flex: 1 1 120px;
    background-color: transparent;
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid #3a3a3a;
    position: relative;
  }

  .console-container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 80px;
      background: linear-gradient(to bottom, #000000, transparent);
      pointer-events: none;
  }

  .posts-list {
    flex-grow: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding-bottom: 2rem;
    /* --- FIX 2: Hide scrollbar on all browsers --- */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none;  /* IE and Edge */
  }
  .posts-list::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }
  
  .no-messages-placeholder {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
  }

  .post {
    padding: 16px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .post:first-child {
      border-top: none; /* Optional: remove top border for the very first item */
  }

  .post-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .sender-name {
    font-weight: 900;
    font-size: 16px;
    color: #fff;
  }

  .timestamp {
    font-size: 16px;
    color: #888;
  }

  .post-body {
    font-weight: 300;
    color: #fff;
    line-height: 1.5;
    font-size: 16px;
  }

  .chat-input-form {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
    right: 1rem;
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
    z-index: 10;
  }

  .chat-input-form input {
    flex-grow: 1;
    background-color: #1a1a1a;
    border: 1px solid #3a3a3a;
    border-radius: 14px;
    padding: 0.5rem 0.6rem;
    color: #e0e0e0;
    font-size: 16px;
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
  }

  .chat-input-form button {
    background-color: white;
    border: none;
    border-radius: 14px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .chat-input-form button svg { stroke: black; stroke-width: 1.5px;}
  button:disabled { background-color: #3a3a3a !important; cursor: not-allowed; }
  button:disabled svg { stroke: #666; }

  :global(.impressum-link) {
    position: fixed;
    bottom: 1.5rem;
    left: 1.5rem;
    color: #ffffff68;
    font-size: 16px;
    z-index: 1000000;
    cursor: pointer;
  }

  :global(.hashtag) {
    color: #00aaff; /* A nice, bright blue */
    cursor: pointer; /* Makes it feel interactive */
  }

  :global(.impressum-link:hover) { text-decoration: underline; }

  .top-left-logo {
    position: fixed;
    top: 22px;
    left: 28px;
    z-index: 100; /* Higher than login overlay to be visible */
  }

  .top-left-logo img {
    height: 40px; /* Or your desired size */
    width: auto;
  }
  /* END: Logo addition */
</style>
