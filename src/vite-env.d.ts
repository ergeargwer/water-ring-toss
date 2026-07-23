/// <reference types="vite/client" />

interface ElectronAPI {
  toggleFullscreen: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  platform: string;
}

interface Window {
  electronAPI?: ElectronAPI;
}
