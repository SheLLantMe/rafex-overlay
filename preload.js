const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  setIgnore: v => ipcRenderer.send('set-ignore', v),
  fetchImage: url => ipcRenderer.invoke('fetch-image', url),
  openFile: () => ipcRenderer.invoke('open-file'),
  quit: () => ipcRenderer.send('quit'),
  onToggleEdit: cb => ipcRenderer.on('toggle-edit', cb)
});
