<script>
    import { credentials } from '../store.js';
    let public_key = null;
    let private_key = null;
    let username = "";

    credentials.subscribe(value => {
        public_key = value.public_key;
        private_key = value.private_key;
        username = value.username;
    });
</script>

<main>
    <h1>Main</h1>
    {#if public_key && private_key}
        <p><strong>Public Key:</strong> {public_key}</p>
        <p><strong>Private Key:</strong> {private_key}</p>
    {/if}
</main>