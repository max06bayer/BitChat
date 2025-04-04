<script>
  let {
    activeicon,
    icon,
    text,
    color,
    activecolor,
    width,
    leftmargin,
    active,
    activation,
  } = $props();
  let isHovered = $state(false);
</script>

<link
  href="https://fonts.googleapis.com/css2?family=Questrial&display=swap"
  rel="stylesheet"
/>
<button
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  style="--color: {color}; --active-color: {activecolor}; padding-right: {width}; margin-left: {leftmargin};"
  onclick={activation}
  class="button-class"
  tabindex="0"
  class:active
>
  <img
    src={active || isHovered ? activeicon : icon}
    alt="trends-icon"
    class="button-icon"
  />
  {text}
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

  .button-class:hover {
    color: var(--active-color);
  }

  .button-icon {
    width: 16px;
    height: auto;
    margin-left: 0.1rem;
    margin-top: -0.1rem;
    margin-right: 0.3rem;
  }

  .active {
    background-color: #171717;
    color: var(--active-color);
  }
</style>
