import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";
import { shellBootstrap } from "../src/app/shell-bootstrap.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(currentDir, "preload.js");

const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0e1726",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServerUrl = shellBootstrap.resolveRendererUrl();
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(shellBootstrap.resolveRendererEntry());
  }

  return window;
};

const bootstrap = (): void => {
  app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (!shellBootstrap.isMacPlatform()) {
      app.quit();
    }
  });
};

bootstrap();
