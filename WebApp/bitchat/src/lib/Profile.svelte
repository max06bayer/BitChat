<script>
  let name = "Maxi";
  let username = "@max06";
  let followers = 12;
  let following = 7;
</script>

<link
  href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
  rel="stylesheet"
/>

<div class="middle">
  <div class="dropdown">
    <img src="profile.png" alt="" class="profile" />
    <div class="names">
      <div class="bigname">{name}</div>
      {username}
      <div class="followinfo">
        <div class="followers">
          <div class="bignumber">{followers}</div>
          followers
        </div>
        <div class="following">
          <div class="bignumber">{following}</div>
          following
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .dropdown {
    position: fixed;
    border: 1px solid #353535;
    border-radius: 14px;
    background-color: #111111;
    font-size: 16px;
    width: 12rem;
    height: 13.5rem;
    margin-top: -16rem;
    margin-right: -1.4rem;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: row;
  }

  .middle {
    display: flex;
    justify-content: right;
    width: 97.5%;
    z-index: 1;
  }

  .names {
    margin-left: 1rem;
    color: white;
    display: flex;
    flex-direction: column;
    margin-top: 3rem;
  }

  .bigname {
    font-family: "Poppins", sans-serif;
    font-size: 1.4rem;
    font-weight: 900;
    color: white;
  }

  .bignumber {
    font-family: "Poppins", sans-serif;
    font-size: 2rem;
    font-weight: 900;
    color: white;
    margin-left: 1rem;
  }

  .profile {
    width: 4rem;
    height: 4rem;
    margin-top: 2.5rem;
    margin-left: 1rem;
    cursor: pointer;
  }

  .followinfo {
    display: flex;
    flex-direction: row;
    margin-top: 1rem;
    width: 100%;
    justify-content: center;
    margin-left: -3rem;
  }

  .followers {
    color: #ffffff;
    margin-top: 0.5rem;
    margin-right: 1rem;
  }
  .following {
    color: #ffffff;
    margin-top: 0.5rem;
  }
</style>
