import path from "node:path";

const RENDERER_URL_ENV_KEY = "ORIGIN_RENDERER_URL";

export const resolveRendererUrl = (
  env: NodeJS.ProcessEnv = process.env,
): string | null => {
  const url = env[RENDERER_URL_ENV_KEY]?.trim();
  return url && url.length > 0 ? url : null;
};

export const resolveRendererEntry = (
  cwd: string = process.cwd(),
  rendererDir: string = path.join("dist", "renderer"),
): string => path.resolve(cwd, rendererDir, "index.html");

export const isMacPlatform = (platform: NodeJS.Platform = process.platform): boolean =>
  platform === "darwin";

export const shellBootstrap = {
  resolveRendererEntry,
  resolveRendererUrl,
  isMacPlatform,
};
