<script>
  import nacl from "tweetnacl";
  import sha256 from "crypto-js/sha256";
  import encHex from "crypto-js/enc-hex";
  import { Buffer } from 'buffer';
  import { openDB } from "idb";
  import { credentials, messages, connected_with_network, contentStorage } from '../store.js';
  import { PeerToPeerConnection, generateTextHash } from '../networking.js';
  import LogConsole from '../lib/Console.svelte';
  import { Link } from "svelte-routing";
  import Trending from "../lib/Trending.svelte";
  import CryptoJS from 'crypto-js';

  import "@fontsource/geist/300.css";
  import "@fontsource/questrial";
  
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

  let fileInput;

  let imagePreviewUrl = null;
  let imagePreviewFilename = null;
  let imagePreviewData = null;
  let imagePreviewHash = null;

  function handleImageUpload() {
    fileInput.click();
  }

  async function processImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    imagePreviewUrl = URL.createObjectURL(file);
    imagePreviewFilename = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      
      if (result instanceof ArrayBuffer) {
        const wordArray = CryptoJS.lib.WordArray.create(result);
        const hash = CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
        
        imagePreviewHash = hash;
        
        const uint8Array = new Uint8Array(result);
        const binaryString = uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '');
        imagePreviewData = btoa(binaryString);
        
        console.log(`Image hash: ${hash}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function getHashtagsFromText(text) {
    if (typeof text !== 'string') return [];
    return (text.match(/#\w+/g) || []);
  }

  $: hashtagCounts = (() => {
    const counts = {};
    for (const msg of $messages) {
      const content = getContentFromMessage(msg);
      for (const hashtag of getHashtagsFromText(content || "")) {
        const tag = hashtag.toLowerCase();
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return counts;
  })();

  $: topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  async function openDatabase() {
    return openDB('DecentralizedSocialDB', 4, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'signature' });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'username' });
        }
        if (!db.objectStoreNames.contains('content')) {
          db.createObjectStore('content', { keyPath: 'hash' });
        }
      },
    });
  }
  
  async function getUserFromDB(username) {
    const db = await openDatabase();
    return await db.get('users', username);
  }

  function removeImagePreview() {
    imagePreviewUrl = null;
    imagePreviewFilename = null;
    imagePreviewData = null;
    imagePreviewHash = null;
    if (fileInput) {
      fileInput.value = "";
    }
  }

  function getContentFromMessage(msg) {
    if (!msg || !msg.hashes) return msg.content || '';
    
    const contentHash = msg.hashes.content;
    if ($contentStorage[contentHash]) {
      return $contentStorage[contentHash].data;
    }
    
    if (network) {
      network.getContentFromDHT(contentHash).then(content => {
        if (content) {
          contentStorage.update(current => ({
            ...current,
            [contentHash]: { data: content.data, type: content.type }
          }));
        }
      }).catch(err => {
        console.error('Failed to retrieve content:', err);
      });
    }
    
    return 'Loading...';
  }

  function handlePostClick(event) {
    // Check if the clicked element is a span with the 'hashtag' class
    if (event.target.tagName === 'SPAN' && event.target.classList.contains('hashtag')) {
        const hashtagText = event.target.innerText; // This will get the text, e.g., "#Svelte"
      
        handleHashtagSearch(hashtagText);
    }
  }

  function getImageFromMessage(msg) {
    if (!msg || !msg.hashes || !msg.hashes.image) return null;
    
    const imageHash = msg.hashes.image;
    if ($contentStorage[imageHash]) {
      return $contentStorage[imageHash].data;
    }
    
    if (network) {
      network.getContentFromDHT(imageHash).then(content => {
        if (content) {
          contentStorage.update(current => ({
            ...current,
            [imageHash]: { data: content.data, type: content.type }
          }));
        }
      }).catch(err => {
        console.error('Failed to retrieve image:', err);
      });
    }
    
    return null;
  }

  $: filteredMessages = $messages.filter(msg => {
    if (!msg || typeof msg !== 'object') return false;
    const messageContent = getContentFromMessage(msg).toLowerCase();
    const senderName = (msg.sender || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return senderName.includes(query) || messageContent.includes(query);
  });

  function setTab(tab) {
    activeTab = tab;
    if (tab === 'home') searchQuery = '';
  }

  async function handleLoginAndRegistration(u, p) {
    isLoading = true;
    loginError = "";
    username = u;
    password = p;

    await openDatabase();

    const seed_str = `${username}:${password}`;
    const hash_hex = sha256(seed_str).toString(encHex);
    const seed = new Uint8Array(hash_hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    const keypair = nacl.sign.keyPair.fromSeed(seed);

    public_key = Buffer.from(keypair.publicKey).toString('hex');
    private_key = Buffer.from(keypair.secretKey).toString('hex'); 
    
    credentials.set({ username, public_key, private_key });

    network = new PeerToPeerConnection(public_key, private_key);

    const unsubscribe = connected_with_network.subscribe(connected => {
        if (connected) {
            isConnected = true;
            isLoading = false;
            showLogin = false;
            unsubscribe();
        }
    });

    setTimeout(async () => {
        const existingUser = await getUserFromDB(username);

        if (existingUser) {
            if (existingUser.publicKey !== public_key) {
                loginError = "Wrong password for this username.";
                isLoading = false;
                if (network) network.peer.destroy();
                return;
            }
            console.log(`Login successful for ${username}.`);
        } else {
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

  async function sendMessage() {
      if (!chatMessage.trim() || !network) return;
      
      await network.postMessage(
        username, 
        chatMessage.trim(), 
        public_key,
        imagePreviewData,
        imagePreviewHash
      );
      
      chatMessage = "";
      removeImagePreview();
  }

  // NEW: Like/Unlike functionality
  function isLikedByMe(msg) {
    if (!msg.likes || !public_key) return false;
    return msg.likes.includes(public_key);
  }

  function getLikeCount(msg) {
    return msg.likes ? msg.likes.length : 0;
  }

  async function toggleLike(msg) {
    if (!network || !public_key) return;
    
    const liked = isLikedByMe(msg);
    
    if (liked) {
      await network.unlikePost(msg.signature, public_key);
    } else {
      await network.likePost(msg.signature, public_key);
    }
  }

  // NEW: Share functionality
  async function sharePost(msg) {
    const content = getContentFromMessage(msg);
    const sender = getSenderFromMessage(msg);
    const text = `${sender}: ${content}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${sender}`,
          text: text
        });
        console.log('Post shared successfully');
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
          fallbackCopyToClipboard(text);
        }
      }
    } else {
      fallbackCopyToClipboard(text);
    }
  }

  function fallbackCopyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Copied to clipboard!');
      alert('Post copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  function getSenderFromMessage(msg) {
    return msg.sender || 'Anonymous';
  }

  function getBodyFromMessage(msg) {
    return getContentFromMessage(msg);
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

  function handleHashtagSearch(tag) {
    searchQuery = tag;
    activeTab = 'search';
  }
</script>

<main>
  <div class="top-left-logo">
    <img src="/bitchat.svg" alt="BitChat Logo" />
  </div>

  {#if !showLogin && username}
    <div class="username-indicator">
      {username}
    </div>
  {/if}

  <div class="trending-container">
    <Trending trends={topHashtags} onHashtagClick={handleHashtagSearch} />
  </div>
  
  {#if showLogin}
    <div class="login-overlay">
      <div class="login-box">
        <h1>Connect to Network</h1>
        <form on:submit|preventDefault={() => handleLoginAndRegistration(username, password)}>
          <input type="text" placeholder="Benutzername" bind:value={username} required disabled={isLoading} />
          <input type="password" placeholder="Passwort" bind:value={password} required disabled={isLoading} />

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
              <div class="post-body" on:click={handlePostClick}>
                {@html parseHashtags(getBodyFromMessage(msg))}
              </div>
              {#if msg.hashes && msg.hashes.image}
                {@const imageData = getImageFromMessage(msg)}
                {#if imageData}
                  <div class="post-image-container">
                    <img src="data:image/png;base64,{imageData}" alt="Post image" class="post-image" />
                  </div>
                {/if}
              {/if}
              
              <!-- NEW: Like and Share buttons -->
              <div class="post-actions">
                <button 
                  class="action-btn like-btn" 
                  class:liked={isLikedByMe(msg)}
                  on:click={() => toggleLike(msg)}
                  disabled={!isConnected}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isLikedByMe(msg) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                  <span class="like-count">{getLikeCount(msg)}</span>
                </button>
                
                <button 
                  class="action-btn share-btn"
                  on:click={() => sharePost(msg)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
          {/if}
        </div>

        {#if imagePreviewUrl}
          <div class="image-preview-container">
            <img src={imagePreviewUrl} alt="Image preview" class="preview-image" />
            <span class="preview-filename">{imagePreviewFilename}</span>
            <button class="remove-preview-btn" on:click={removeImagePreview}>&times;</button>
          </div>
        {/if}

        <form on:submit|preventDefault={sendMessage} class="chat-input-form">
          <input 
            type="text" 
            bind:value={chatMessage} 
            placeholder={isConnected ? "Poste etwas..." : "Connect to post a message"}
            disabled={!isConnected} 
          />

          <img 
            src="/image-icon.svg" 
            alt="Upload Image" 
            class="upload-icon"
            on:click={handleImageUpload}
          />
          
          <input 
            type="file" 
            accept="image/*" 
            style="display: none;" 
            bind:this={fileInput}
            on:change={processImage}
          />

          <button type="submit" disabled={!isConnected} aria-label="Send">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>
      </div>
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
    transform: translateX(6rem);
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

  .chat-input-form {
    position: relative; /* Needed for absolute positioning of the icon */
    display: flex;
    align-items: center;
  }

  .chat-input-form input[type="text"] {
    padding-right: 60px; /* Make space for the new icon and the send button */
    max-width: 18rem;
  }

  .upload-icon {
    position: absolute;
    right: 50px; /* Position it to the left of the send button */
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;
    margin-right: 2.5em;
  }

  .upload-icon:hover {
    opacity: 1;
  }

  .trending-container {
    position: absolute; /* Takes the element out of the normal page flow */
    top: -8px;          /* Position it from the top */
    left: 50%;          /* Center it horizontally */
    margin-left: -6rem;
    z-index: 10;        /* Ensure it sits on top of other content */
  }

  .username-indicator {
    position: absolute;
    top: 1.5rem;
    right: 2.5rem;
    background: #111111;
    border: 1px solid #353535;
    border-radius: 14px;
    padding: 0.5rem 0.5rem;
    color: #fff;
    font-family: 'Geist', 'Questrial', sans-serif;
    font-weight: 300;
    font-size: 16px;
    box-shadow: 0px 0px 16px rgba(0,0,0,0.75);
    z-index: 50;
    letter-spacing: 0.02em;
    min-width: 3rem;
    text-align: center;
    user-select: text;
  }

  .image-preview-container {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    margin-bottom: 20px;
    background-color: #000000;
    border: 1px solid rgb(78, 78, 78);
    border-radius: 14px;
    position: relative;
    margin-right: 1rem;
    margin-left: 1rem;
  }

  .preview-image {
    max-height: 50px;
    max-width: 50px;
    border-radius: 10px;
    object-fit: cover;
    border: 1px solid rgb(68, 68, 68);
  }

  .preview-filename {
    font-size: 0.9em;
    color: #f6f6f6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-preview-btn {
    background: none;
    border: none;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    color: #9c9c9c;
    margin-left: auto;
  }

  .remove-preview-btn:hover {
    color: #ffffff;
  }

  /* --- NEW: Style for images inside a post --- */
  .post-image {
    width: 100%;
    max-height: 400px;
    object-fit: cover;
    border-radius: 12px;
    margin-top: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .post-image-container {
    margin-bottom: 0px;
  }

  /* NEW: Post action buttons */
  .post-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 5px;
    padding-top: 6px;
    border-top: none;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0;
    border-radius: 12px;
    border: none;
    background-color: transparent;
    color: #999;
    cursor: pointer;
    font-family: "Geist", sans-serif;
    font-size: 14px;
    font-weight: 300;
    transition: all 0.2s;
  }

  .action-btn:hover:not(:disabled) {
    color: #fff;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .like-btn svg {
    transition: all 0.2s;
    stroke-width: 1.5px;
  }

  .like-btn.liked {
    color: #ff4458;
    border-color: #ff4458;
  }

  .like-btn.liked svg {
    fill: #ff4458;
    stroke: #ff4458;
  }

  .like-count {
    min-width: 20px;
    text-align: left;
  }

  .share-btn:hover:not(:disabled) {
    border-color: #0084ff;
    color: #0084ff;
  }

  .share-btn svg{
    stroke-width: 1.5px;
  }

</style>
