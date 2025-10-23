<script>
  export let trends = []; 
  export let onHashtagClick = (trend) => {};

  function handleClick(trend) {
    if (onHashtagClick) onHashtagClick(trend);
  }
</script>

<div class="middle trends-wrapper">
  <button class="trends-button">
    <img src="./trends-icon.svg" alt="Trends Icon" class="trends-icon" />
    <span class="trends-text">Trends</span>
  </button>
  <div class="dropdown">
    <div class="content">
      {#each trends as trend}
        <div class="dropdown-item" on:click={() => handleClick(trend)}>
          <span class="trend-text">{trend}</span>
        </div>
      {/each}
    </div>
    <div class="shadow-overlay-top"></div>
    <div class="shadow-overlay-bottom"></div>
  </div>
</div>

<style>
  .trends-wrapper {
    position: relative;
    display: flex;
    justify-content: center;
    width: 97.5%;
    z-index: 1;
  }

  .trends-button {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid #353535;
    border-radius: 14px;
    background-color: #111111;
    color: white;
    font-family: "Geist", sans-serif;
    font-weight: 300;
    font-size: 16px;
    padding: 0.5rem 0.5rem;
    padding-right: 6.6rem;
    z-index: 10000;
    cursor: pointer;
    box-shadow: 0px 0px 32px rgba(0, 0, 0, 1);
    margin-left: -39.8em;
    top: 2.06em;
  }

  .trends-icon {
    width: 18px;
    height: 18px;
    filter: brightness(1000%);

  }

  .trends-text {
    color: white;
  }

  .trends-button:hover {
    color: #00aaff;
  }

  .dropdown {
    position: relative;
    border: 1px solid #353535;
    border-radius: 14px;
    background-color: #111111;
    font-size: 16px;
    width: 10rem;
    margin-top: 2rem;
    margin-left: -38rem;
    max-height: 16rem;
    overflow: hidden;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  }

  .content {
    padding: 3rem 0.5rem 0.5rem 0.5rem;
    max-height: 14rem;
    overflow-y: scroll;
    scrollbar-width: none;
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
    bottom: 0;
    left: 0;
    right: 0;
    height: 30px;
    background: linear-gradient(
      to top,
      rgba(17, 17, 17, 1) 0%,
      rgba(17, 17, 17, 0) 100%
    );
    pointer-events: none;
    z-index: 2;
  }

  .dropdown-item {
    position: relative;
    display: block;
    border: 1px solid #353535;
    border-radius: 14px;
    background-color: #111111;
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    color: #ffffff;
    font-family: "Questrial", sans-serif;
    text-align: left;
    margin-bottom: 0.5rem;
    max-width: 7rem;
    width: fit-content;
    overflow: hidden;
    box-shadow: 0px 0px 16px rgba(0, 0, 0, 0.75);
  }

  .trend-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    max-width: 100%;
  }

  .dropdown-item:hover {
    color: #00aaff;
  }

  .middle {
    display: flex;
    justify-content: center;
    width: 97.5%;
    z-index: 1;
  }
</style>
