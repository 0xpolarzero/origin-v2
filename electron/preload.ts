import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("originShell", {
  platform: process.platform,
});
