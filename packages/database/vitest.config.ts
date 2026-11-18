import { defineConfig } from "vitest/config";

// Neon's free tier pauses idle databases; the first connection after a pause can take several seconds.
export default defineConfig({
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
