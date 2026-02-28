import { spawn } from "node:child_process";

// Build Electron first
console.log("Building Electron...");
await Bun.$`bun run build:electron`;

// Start Vite dev server
console.log("Starting Vite dev server...");
const vite = spawn("bun", ["node_modules/vite/bin/vite.js"], {
  stdio: "inherit",
  env: { ...process.env },
});

// Wait for server to be ready
await new Promise((resolve) => setTimeout(resolve, 2000));

// Start Electron
console.log("Starting Electron...");
const electron = spawn(
  "bun",
  ["node_modules/electron/cli.js", "."],
  {
    stdio: "inherit",
    env: { ...process.env, ORIGIN_RENDERER_URL: "http://localhost:5173" },
  }
);

// Cleanup on exit
process.on("SIGINT", () => {
  vite.kill();
  electron.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  vite.kill();
  electron.kill();
  process.exit(0);
});
