import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  toggleFullscreen: (): Promise<boolean> =>
    ipcRenderer.invoke('toggle-fullscreen'),
  isFullscreen: (): Promise<boolean> => ipcRenderer.invoke('is-fullscreen'),
  platform: process.platform,
});
