<script>
  import nacl from "tweetnacl";
  import sha256 from "crypto-js/sha256";
  import encHex from "crypto-js/enc-hex";
  // Make sure to import connected_with_network from your store
  import { credentials, messages, connected_with_network } from '../store.js'; 
  import { PeerToPeerConnection } from '../networking.js';
  import LogConsole from '../lib/Console.svelte';
  import { Link } from "svelte-routing";

  // Import fonts
  import "@fontsource/geist/300.css";
  import "@fontsource/questrial";

  const bootstrap_node = 'a3912a4d5fd8492188ac0e70441f342e6440ce77bcabe00c0becb8d41a02b998';

  // State variables - all preserved
  let public_key = null;
  let private_key = null; // Storing private key for potential future signing
  let username = "";
  let password = "";
  let network = null;
  let isConnected = false;
  let chatMessage = ""; 
  let showLogin = true;
  let isLoading = false;
  
  // Toolbar state - all preserved
  let activeTab = 'home';
  let searchQuery = '';

  // UPDATED: This now works with message objects
  $: filteredMessages = $messages.filter(msg => {
    if (!msg || typeof msg !== 'object') return false; // Guard against non-object messages
    const messageContent = getBodyFromMessage(msg).toLowerCase();
    const senderName = getSenderFromMessage(msg).toLowerCase();
    const query = searchQuery.toLowerCase();
    return senderName.includes(query) || messageContent.includes(query);
  });

  function setTab(tab) {
    activeTab = tab;
    if (tab === 'home') {
      searchQuery = '';
    }
  }

  // PRESERVED: Your original key generation function
  function generate_keys(u, p) {
    isLoading = true;
    username = u;
    password = p;
    const seed_str = `${username}:${password}`;
    const hash_hex = sha256(seed_str).toString(encHex);
    const seed = new Uint8Array(hash_hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    const keypair = nacl.sign.keyPair.fromSeed(seed);

    public_key = Array.from(keypair.publicKey).map(byte => byte.toString(16).padStart(2, '0')).join('');
    private_key = Array.from(keypair.secretKey).map(byte => byte.toString(16).padStart(2, '0')).join('');
    
    credentials.set({ username, public_key, private_key });

    network = new PeerToPeerConnection(public_key);
    
    // PRESERVED: Your original event listeners for connection status
    network.peer.on('open', (id) => {
        // isConnected = true; // This will now be handled by the store subscription
        isLoading = false;
        showLogin = false;
        console.log('Peer is ready with ID:', id);
        bootstrap(); // Call your bootstrap function
    });

    network.peer.on('error', (err) => {
        isLoading = false;
        console.error("PeerJS error in Main.svelte:", err);
    });

    // PRESERVED: Subscribing to the store to keep `isConnected` reactive
    connected_with_network.subscribe(val => {
        isConnected = val;
    });
  }

  // PRESERVED: Your original bootstrap logic
  function bootstrap() {
    // Check isConnected from the store or local state
    if (public_key !== bootstrap_node && isConnected) {
        network.connectToPeer(bootstrap_node);
        // The new networking.js handles sharing history and peers automatically
        // on connection, so a separate `node_info_request` might be redundant,
        // but we can keep it for now as it doesn't hurt.
        setTimeout(() => {
            // Note: The new bootstrap node doesn't use this format.
            // This message will be ignored by the new bootstrap server, which is fine.
            // The connection itself is what triggers the data exchange.
            // network.send(bootstrap_node, `node_info_request:${public_key}`);
            console.log('Connected to bootstrap node. History and peers will be synced automatically.');
        }, 1000);
    }
  }

  // --- UPDATED ---
  async function sendMessage() {
      if (!chatMessage.trim() || !network) return;

      // This is the main change:
      // Call the new `postMessage` method to create and broadcast a transaction.
      // This single call replaces the old `messages.update` and `network.broadcast` lines.
      await network.postMessage(username, chatMessage.trim(), public_key);
      
      chatMessage = ""; // Clear the input field
  }
  
  // --- UPDATED to work with transaction objects ---
  function getSenderFromMessage(msg) {
    // Messages are now objects, so we access the 'sender' property.
    // Provide a fallback for any old string-based messages during transition.
    return typeof msg === 'object' ? msg.sender : (msg.split(':')[0] || 'Anonymous');
  }

  function getBodyFromMessage(msg) {
    if (typeof msg === 'object') {
        return msg.content || '';
    }
    // Fallback for old message format
    const parts = msg.split(':');
    parts.shift();
    return parts.join(':').trim();
  }

  function getFormattedTimeFromMessage(msg) {
    if (typeof msg === 'object' && msg.time) {
        return new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Fallback for old messages without a timestamp
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function parseHashtags(text) {
    if (typeof text !== 'string') return '';
    const hashtagRegex = /(#\w+)/g;
    return text.replace(hashtagRegex, '<span class="hashtag">$1</span>');
  }
</script>


<main>
  <div class="top-left-logo">
    <img src="/bitchat.svg" alt="BitChat Logo" />
  </div>
  
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
    <!-- START: New Layout Wrapper -->
    <div class="feed-column">
      <div class="feed-toolbar">
        <button class="home-btn" class:active={activeTab === 'home'} on:click={() => setTab('home')}>
          <img src="/home.svg" alt="Home" />
          Home
        </button>
        <div class="search-bar">
          <img src="/search.svg" alt="Search" class="search-icon" />
          <input 
            type="text" 
            placeholder="Search" 
            bind:value={searchQuery}
            on:focus={() => setTab('search')}
          />
        </div>
      </div>
      <div class="feed-container">
        <div class="posts-list">
          {#if filteredMessages.length === 0}
            <div class="no-messages-placeholder">
              {#if searchQuery}
                No posts found.
              {:else}
                Connect to the network to see posts.
              {/if}
            </div>
          {:else}
            {#each filteredMessages as msg (msg)}
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
            placeholder={isConnected ? "Poste etwas..." : "Connect to post a message"}
            disabled={!isConnected} 
          />
          <button type="submit" disabled={!isConnected} aria-label="Send">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>
      </div>
    </div>
    <!-- END: New Layout Wrapper -->

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
    background: linear-gradient(20deg, #002982 0%, #520075 18%, #0600B7 40%, #0086FB 61%, #C700EF 83%, #00035C 100%);
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
    background-attachment: fixed;
    overflow: hidden;
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

  /* --- START: New and Adjusted Styles --- */
  .feed-column {
    flex: 2;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }

  .feed-toolbar {
    display: flex;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .home-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    border-radius: 14px;
    border: 1px solid #3a3a3a;
    cursor: pointer;
    font-family: "Geist", sans-serif;
    font-size: 16px;
    font-weight: 400;
    transition: background-color 0.2s, color 0.2s;
    background-color: #111;
    color: #ffffff;
  }

  .home-btn img {
    height: 20px;
    width: 20px;
    transition: filter 0.2s;
  }

  .search-bar {
    flex-grow: 1;
    position: relative;
  }
  
  .search-bar .search-icon {
    position: absolute;
    left: 0.8rem;
    top: 50%;
    transform: translateY(-55%);
    height: 18px;
    width: 18px;
    filter: brightness(100);
  }

  .search-bar input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.4rem 0.8rem 0.4rem 2.3rem;
    border-radius: 14px;
    background-color: #111;
    border: 1px solid #3a3a3a;
    color: #fff;
    font-family: "Geist", sans-serif;
    font-size: 16px;
    font-weight: 300;
  }
  /* --- END: New and Adjusted Styles --- */

  .feed-container {
    flex-grow: 1; /* Takes remaining space in the column */
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
    background: linear-gradient(90deg,rgba(22, 22, 22, 0.7) 0%, rgba(22, 22, 22, 1) 65%);
    border-radius: 16px;
    border: 1px solid #3a3a3a;
    padding: 0;
    box-sizing: border-box;
  }
  
  .feed-container::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
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
    padding: 0 0rem 2rem;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .posts-list::-webkit-scrollbar {
    display: none;
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .post:first-child {
      border-top: none;
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
    color: #00aaff;
    cursor: pointer;
  }

  :global(.impressum-link:hover) { text-decoration: underline; }

  .top-left-logo {
    position: fixed;
    top: 22px;
    left: 28px;
    z-index: 100;
  }

  .top-left-logo img {
    height: 40px;
    width: auto;
  }
</style>
