<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import NavButton from "./Button.svelte";
  import SearchBar from "./Search.svelte";
  import Icon from "./Icon.svelte";

  export let active_page;
  const dispatch = createEventDispatcher();

  function setActivePage(page: string) {
    dispatch("navigate", page);
  }
</script>

<link
  href="https://fonts.googleapis.com/css2?family=Questrial&display=swap"
  rel="stylesheet"
/>

<div class="navbar">
  <img src="logo.svg" alt="logo" class="logo" />
  <div class="middle">
    <NavButton
      activeicon="trends-icon.svg"
      icon="trends-icon.svg"
      text="Trends"
      color="#ff0037"
      activecolor="#ff0037"
      width="8rem"
      leftmargin="0rem"
      active={false}
      activation={() => {}}
    />
    <NavButton
      activeicon="home-active.svg"
      icon="home-inactive.svg"
      text="Home"
      color="#BCB8B8"
      activecolor="#ffffff"
      width="1rem"
      leftmargin="1rem"
      active={active_page === "home"}
      activation={() => setActivePage("home")}
    />
    <NavButton
      activeicon="post-active.svg"
      icon="post-inactive.svg"
      text="Post"
      color="#BCB8B8"
      activecolor="#ffffff"
      width="1rem"
      leftmargin="1rem"
      active={active_page === "post"}
      activation={() => setActivePage("post")}
    />
    <SearchBar
      activeicon="search-active.svg"
      icon="search-inactive.svg"
      text="Search"
      color="#BCB8B8"
      activecolor="#ffffff"
      width="1rem"
      leftmargin="1rem"
      active={active_page === "search"}
      activation={() => setActivePage("search")}
    />
  </div>
  <div class="right">
    <Icon
      activeicon="settings-active.svg"
      icon="settings-inactive.svg"
      width="0.3rem"
      leftmargin="1rem"
    />
    <NavButton
      activeicon="profile-active.svg"
      icon="profile-inactive.svg"
      text="Profile"
      color="#BCB8B8"
      activecolor="#ffffff"
      width="8rem"
      leftmargin="1rem"
      active={false}
      activation={() => {}}
    />
  </div>
</div>

<style>
  .navbar {
    display: flex;
    align-items: center;
    padding: 1rem;
    padding-left: 1.4rem;
    position: fixed;
    top: 0;
    left: 0;
    width: 97.5%;
    z-index: 10;
  }

  :global(body) {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-family: "Questrial", sans-serif;
  }

  .logo {
    width: 145px;
    height: auto;
  }

  .middle {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .right {
    display: flex; /* enables horizontal layout */
    flex-direction: row; /* ensures side-by-side */
    align-items: right;
  }
</style>
