<script>
  let { activeicon, icon, width, leftmargin } = $props();
  let isHovered = $state(false);
</script>

<link
  href="https://fonts.googleapis.com/css2?family=Questrial&display=swap"
  rel="stylesheet"
/>
<button
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  style="padding-right: {width}; margin-left: {leftmargin};"
  class="button-class"
  tabindex="0"
>
  <img
    src={isHovered ? activeicon : icon}
    alt="trends-icon"
    class="button-icon"
  />
</button>

<style>
  :global(html, body, button) {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-family: "Questrial", sans-serif;
  }

  .button-class {
    display: flex; /* enables horizontal layout */
    flex-direction: row; /* ensures side-by-side */
    align-items: center;

    color: var(--color);
    border: 1px solid #353535;
    border-radius: 14px;
    background-color: #111111;
    padding: 0.6rem;
    font-size: 16px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  }

  .button-icon {
    width: 20px;
    height: 20px;
    margin-top: -0.1rem;
    margin-right: 0.3rem;
  }
</style>
