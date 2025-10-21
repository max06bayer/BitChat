<script>
  import nacl from "tweetnacl";
  import sha256 from "crypto-js/sha256";
  import encHex from "crypto-js/enc-hex";
  import { Buffer } from 'buffer';
  import { openDB } from "idb"; // <-- NEW: Import openDB
  // --- CHANGED: Removed 'users' from the import ---
  import { credentials, messages, connected_with_network } from '../store.js'; 
  import { PeerToPeerConnection } from '../networking.js';
  import LogConsole from '../lib/Console.svelte';
  import { Link } from "svelte-routing";

  // Import fonts
  import "@fontsource/geist/300.css";
  import "@fontsource/questrial";
  
  // State variables (unchanged)
  let public_key = null;
  let private_key = null;
  let username = "";
  let password = "";
  let network = null;
  let isConnected = false;
  let chatMessage = ""; 
  let showLogin = true;
  let isLoading = false;
  let loginError = "";
  
  let activeTab = 'home';
  let searchQuery = '';

  // --- NEW: Add IndexedDB helpers directly in the component ---
  async function openDatabase() {
    return openDB('DecentralizedSocialDB', 2); // Version 2 has the 'users' table
  }
  async function getUserFromDB(username) {
    const db = await openDatabase();
    return await db.get('users', username);
  }

  // $: filteredMessages (unchanged)
  $: filteredMessages = $messages.filter(msg => {
    if (!msg || typeof msg !== 'object' || !msg.content) return false;
    const messageContent = (msg.content || '').toLowerCase();
    const senderName = (msg.sender || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return senderName.includes(query) || messageContent.includes(query);
  });

  // setTab (unchanged)
  function setTab(tab) {
    activeTab = tab;
    if (tab === 'home') searchQuery = '';
  }

  // handleLoginAndRegistration (logic updated)
  async function handleLoginAndRegistration(u, p) {
    isLoading = true;
    loginError = "";
    username = u;
    password = p;

    // 1. Generate keys (unchanged)
    const seed_str = `${username}:${password}`;
    const hash_hex = sha256(seed_str).toString(encHex);
    const seed = new Uint8Array(hash_hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    const keypair = nacl.sign.keyPair.fromSeed(seed);

    public_key = Buffer.from(keypair.publicKey).toString('hex');
    private_key = Buffer.from(keypair.secretKey).toString('hex'); 
    
    credentials.set({ username, public_key, private_key });

    // 2. Instantiate network (unchanged)
    network = new PeerToPeerConnection(public_key, private_key);

    // This listener confirms when the network is ready (unchanged)
    const unsubscribe = connected_with_network.subscribe(connected => {
        if (connected) {
            isConnected = true;
            isLoading = false;
            showLogin = false;
            unsubscribe();
        }
    });

    // --- CHANGED: Check against IndexedDB, not a store ---
    setTimeout(async () => {
        const existingUser = await getUserFromDB(username);

        if (existingUser) {
            // LOGIN PATH
            if (existingUser.publicKey !== public_key) {
                loginError = "Wrong password for this username.";
                isLoading = false;
                if (network) network.peer.destroy();
                return;
            }
            console.log(`Login successful for ${username}.`);
        } else {
            // REGISTRATION PATH
            console.log(`User ${username} not found locally. Attempting to register...`);
            const registered = await network.registerUser(username, public_key);
            if (!registered) {
                loginError = "Registration failed. Username might be taken.";
                isLoading = false;
                if (network) network.peer.destroy();
            } else {
                console.log(`Registration successful for ${username}.`);
            }
        }
    }, 4000);
  }

  // sendMessage (unchanged)
  async function sendMessage() {
      if (!chatMessage.trim() || !network) return;
      await network.postMessage(username, chatMessage.trim(), public_key);
      chatMessage = "";
  }

  // --- Helper functions for message display (unchanged) ---
  function getSenderFromMessage(msg) {
    return msg.sender || 'Anonymous';
  }

  function getBodyFromMessage(msg) {
    return msg.content || '';
  }

  function getFormattedTimeFromMessage(msg) {
    const time = msg.time ? new Date(msg.time) : new Date();
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        <form on:submit|preventDefault={() => handleLoginAndRegistration(username, password)}>
          <input type="text" placeholder="Benutzername" bind:value={username} required disabled={isLoading} />
          <input type="password" placeholder="Passwort" bind:value={password} required disabled={isLoading} />

          <!-- 2. NEW: Display login error messages -->
          {#if loginError}
            <p class="error-message">{loginError}</p>
          {/if}

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
            {#each filteredMessages as msg (msg.signature)}
            <div class="post">
              <div class="post-header">
                <span class="sender-name">{getSenderFromMessage(msg)}</span>
                <span class="timestamp">{getFormattedTimeFromMessage(msg)}</span>
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
