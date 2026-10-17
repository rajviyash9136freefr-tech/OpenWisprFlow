import { contextBridge, ipcRenderer, shell, clipboard } from 'electron';

const listeners = new Map<number, { channel: string; fn: (...args: any[]) => void }>();
let listenerIdCounter = 1;

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, listener: (...args: any[]) => void) => {
      const id = listenerIdCounter++;
      const handler = (_event: any, ...args: any[]) => listener(...args);
      listeners.set(id, { channel, fn: handler });
      ipcRenderer.on(channel, handler);
      return id;
    },
    off: (channel: string, listenerId: number) => {
      const entry = listeners.get(listenerId);
      if (entry) {
        ipcRenderer.removeListener(channel, entry.fn);
        listeners.delete(listenerId);
      }
    },
  },
  clipboard: {
    writeText: (text: string) => clipboard.writeText(text),
    readText: () => clipboard.readText(),
  },
  shell: {
    openExternal: (url: string) => shell.openExternal(url),
  },
  platform: {
    os: process.platform,
    isWindows: process.platform === 'win32',
    isMacOS: process.platform === 'darwin',
  },
});

contextBridge.exposeInMainWorld('zubridge', {
  getState: (slice?: string) => ipcRenderer.invoke('zubridge:get-state', slice),
  dispatch: (action: string | { type: string; payload?: any }, payload?: any) =>
    ipcRenderer.invoke('zubridge:dispatch', action, payload),
});
