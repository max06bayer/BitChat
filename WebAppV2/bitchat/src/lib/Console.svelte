<script>
    import { logs } from '../store.js';
</script>

<div class="console">
    {#each $logs as log}
        <div class="{log.method}">{log.message}</div>
    {/each}
</div>

<style>
    .console {
        background-color: #000000;
        color: #fff;
        padding: 10px;
        font-family: monospace;
        height: 200px;
        overflow-y: auto;
    }
    .log { color: #fff; }
    .info { color: #00f; }
    .warn { color: #ff0; }
    .error { color: #f00; }
</style>