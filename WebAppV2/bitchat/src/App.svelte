<script>
  // @ts-nocheck
  import { credentials } from './store.js';
  import { onMount } from 'svelte';
  import { navigate } from "svelte-routing";
  import { Router, Route, Link } from "svelte-routing";
  import Main from "./routes/Main.svelte";
  import Impressum from "./routes/Impressum.svelte";

  let public_key = null;
  let private_key = null;
  let username = "";

  credentials.subscribe(value => {
      public_key = value.public_key;
      private_key = value.private_key;
      username = value.username;
  });

</script>

<Router>
  <Route path="/" let:component>
    <svelte:component this={component || Main} />
  </Route>

  <Route path="/impressum" let:component>
    <svelte:component this={component || Impressum} />
  </Route>
</Router>