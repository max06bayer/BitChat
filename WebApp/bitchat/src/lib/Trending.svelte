<script>
  let trends = [
    "#Nasdaq",
    "#S&P500",
    "#DowJones",
    "#Crypto",
    "#AI",
    "#ML",
    "#Web3",
    "#BlockchainWeb3Appslol",
  ];
</script>

<div class="middle">
  <div class="dropdown">
    <div class="content">
      {#each trends as trend}
        <div class="dropdown-item">
          <span class="trend-text">{trend}</span>
        </div>
      {/each}
    </div>
    <div class="shadow-overlay-top"></div>
    <div class="shadow-overlay-bottom"></div>
  </div>
</div>

<style>
  .dropdown {
    position: relative;
    border: 1px solid #353535;
    border-radius: 14px;
    background-color: #111111;
    font-size: 16px;
    width: 12rem;
    margin-top: 2rem;
    margin-left: -38rem;
    max-height: 16rem;
    overflow: hidden;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  }

  .content {
    padding: 2rem 0.5rem 0.5rem 0.5rem;
    max-height: 14rem;
    overflow-y: scroll;
    scrollbar-width: none; /* Firefox */
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
    max-width: 9rem;
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
    color: #ff0037;
  }

  .middle {
    display: flex;
    justify-content: center;
    width: 97.5%;
    z-index: 1;
  }
</style>
