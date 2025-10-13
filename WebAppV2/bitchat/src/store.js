// store.js
import { writable } from 'svelte/store';

export const credentials = writable({
  username: null,
  public_key: null,
  private_key: null
});

export const logs = writable([]);

export const connected_with_network = writable(false);

export const hash_table = Array.from({ length: 16 }, () => []);