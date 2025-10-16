<script>
  import { logs } from '../store.js';
  import { afterUpdate } from 'svelte';

  let consoleElement;
  let logCount = 0;

  afterUpdate(() => {
    if ($logs.length > logCount && consoleElement) {
      consoleElement.scrollTop = consoleElement.scrollHeight;
    }
    logCount = $logs.length;
  });
</script>

<div class="log-console" bind:this={consoleElement}>
  {#each $logs as log}
    <div class="log-line {log.method}">{log.message}</div>
  {/each}
</div>

<style>
  .log-console {
      height: 100%; /* Fill the parent container */
      overflow-y: auto;
      padding: 1rem;
      scrollbar-width: none;
      -ms-overflow-style: none;
      font-family: "JetBrains Mono", monospace;
      font-weight: 300;
      font-size: 14px;
      color: #888; /* Default text color */
      background-color: rgba(0, 0, 0, 0.33);
  }
  .log-console::-webkit-scrollbar {
      display: none;
  }
  .log { color: #888888a4; }
  .info { color: #00aaff; }
  .warn { color: #ffcc00; }
  .error { color: #ff4444; }

  .log-line {
    overflow: hidden;
  }
</style>
