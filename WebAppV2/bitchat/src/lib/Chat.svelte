<script>
    import { messages } from '../store.js';
    import { onMount, tick } from 'svelte';

    export let network;
    export let username;

    let newMessage = '';
    let messageListElement;

    // Automatically scroll to the bottom when new messages arrive
    $: if ($messages && messageListElement) {
        tick().then(() => {
            messageListElement.scrollTop = messageListElement.scrollHeight;
        });
    }

    function sendMessage() {
        if (!newMessage.trim()) return;

        const fullMessage = `${username}: ${newMessage.trim()}`;
        
        // Add to our own store for instant UI update
        messages.update(msgs => [...msgs, fullMessage]);

        // Broadcast to the network
        network.broadcastMessage(fullMessage);

        newMessage = ''; // Clear the input
    }
</script>

<div class="chat-container">
    <h2>Decentralized Chat</h2>
    <div class="message-list" bind:this={messageListElement}>
        {#if $messages.length === 0}
            <p class="no-messages">No messages yet. Be the first to say something!</p>
        {:else}
            {#each $messages as msg}
                <div class="message">{msg}</div>
            {/each}
        {/if}
    </div>
    <form class="message-form" on:submit|preventDefault={sendMessage}>
        <input type="text" bind:value={newMessage} placeholder="Type a message and press Enter..." required />
        <button type="submit">Send</button>
    </form>
</div>

<style>
    .chat-container {
        border: 1px solid #444;
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
    }
    .message-list {
        height: 300px;
        overflow-y: auto;
        border: 1px solid #333;
        padding: 0.5rem;
        margin-bottom: 1rem;
        background-color: #222;
        border-radius: 4px;
    }
    .no-messages {
        color: #888;
        text-align: center;
        margin-top: 20px;
    }
    .message {
        padding: 4px 2px;
        border-bottom: 1px solid #3a3a3a;
    }
    .message-form {
        display: flex;
    }
    .message-form input {
        flex-grow: 1;
        margin-right: 0.5rem;
    }
</style>
