<script>
  import messages from "../../public/chat/chat.json";
  import Message from "./Message.svelte";
</script>

<div class="middle">
  <div class="dropdown">
    <div class="content">
      {#each messages as message}
        <div class="item"><Message {message} /></div>
      {/each}
    </div>
    <div class="shadow-overlay-top"></div>
    <div class="shadow-overlay-bottom"></div>
  </div>
</div>

<style>
  .item {
    padding: 1rem;
    border-bottom: 1px solid #353535;
    color: #ffffff;
    font-family: "Questrial", sans-serif;
    display: block;
  }

  .dropdown {
    position: fixed;
    border: 1px solid #353535;
    border-radius: 14px 14px 0 0; /* Only round the top corners */
    background-color: #111111;
    font-size: 16px;
    width: 32.3rem;
    margin-left: 8.4rem;
    top: 4.3rem;
    bottom: 0;
    overflow: hidden;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
    border-bottom: none;
  }

  .content {
    padding: 0;
    max-height: 45rem;
    overflow-y: scroll;
    scrollbar-width: none; /* Firefox */
    padding-bottom: 2rem;
  }

  .shadow-overlay-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 30px;
    background: linear-gradient(
      to bottom,
      rgba(17, 17, 17, 1) 0%,
      rgba(17, 17, 17, 0) 100%
    );
    pointer-events: none;
    z-index: 2;
  }

  .shadow-overlay-bottom {
    position: absolute;
    bottom: -20px;
    left: 0;
    right: 0;
    height: 50px;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 1) 0%,
      rgba(0, 00, 0, 0) 100%
    );
    pointer-events: none;
    z-index: 2;
  }

  .middle {
    display: flex;
    justify-content: center;
    width: 97.5%;
    z-index: 1;
  }
</style>
