<script lang="ts">
  import Navbar from "./lib/Navbar.svelte";
  import Trending from "./lib/Trending.svelte";
  import Profile from "./lib/Profile.svelte";
  import Home from "./lib/Home.svelte";
</script>

<main>
  <div class="mobile-warning">⚠️ Funktioniert nur am Desktop.</div>
  <Trending />
  <Profile />
  <Navbar />
  <Home />
</main>

<style>
  .mobile-warning {
    display: none;
    background: #111;
    color: white;
    text-align: center;
    font-family: "Questrial", sans-serif;
    font-size: 1rem;
  }

  @media (max-width: 1200px) {
    .mobile-warning {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 9999;
      background: #111;
      height: 100vh; /* cover full screen */
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 1.2rem;
    }

    main > :not(.mobile-warning) {
      display: none !important; /* hide everything else inside <main> */
    }
  }
</style>
