<script>
    import { logs } from '../store.js';
    import { afterUpdate } from 'svelte';
  
    let consoleElement;
    let logCount = 0;
  
    // This Svelte lifecycle function runs after the component updates.
    afterUpdate(() => {
      // If new logs have been added, scroll to the bottom.
      if ($logs.length > logCount && consoleElement) {
        consoleElement.scrollTop = consoleElement.scrollHeight;
      }
      logCount = $logs.length;
    });
  </script>
  
  <!-- We bind the div to our 'consoleElement' variable -->
  <div class="console" bind:this={consoleElement}>
    {#each $logs as log}
      <div class="log-line {log.method}">{log.message}</div>
    {/each}
  </div>
  

<style>
    .console {
        flex-shrink: 0;
        height: 250px; /* More compact height */
        resize: vertical;
        min-height: 50px;
        max-height: 300px;
        overflow: auto;
        background-color: #000000;
        border: 1px solid #2a2a2a;
        border-radius: 12px; /* Rounded corners */
        padding: 0.75rem;
        /* --- Invisible Scrollbar --- */
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none;  /* IE and Edge */
        font-family: "JetBrains Mono", monospace;
        font-weight: 300;
        font-size: 14px;
    }
    .console::-webkit-scrollbar {
        display: none; /* WebKit */
    }
    .log { color: #ffffff80; }
    .info { color: #00f; }
    .warn { color: #ff0; }
    .error { color: #f00; }
</style>