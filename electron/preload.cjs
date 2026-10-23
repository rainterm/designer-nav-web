const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('navDesktop', {
  isElectron: true,
  showView: (payload) => ipcRenderer.invoke('browser-view:show', payload),
  showPanes: (payload) => ipcRenderer.invoke('browser-view:show-panes', payload),
  setBounds: (bounds) => ipcRenderer.invoke('browser-view:set-bounds', bounds),
  hideView: () => ipcRenderer.invoke('browser-view:hide'),
  unloadView: () => ipcRenderer.invoke('browser-view:unload'),
  destroyViews: (payload) => ipcRenderer.invoke('browser-view:destroy', payload || {}),
  reload: () => ipcRenderer.invoke('browser-view:reload'),
  openExternal: (url) => ipcRenderer.invoke('browser-view:open-external', url),
  getCurrentPage: (payload) => ipcRenderer.invoke('browser-view:get-current', payload || {}),
  resolveFavicon: (payload) => ipcRenderer.invoke('favicon:resolve', payload),
  getZoom: () => ipcRenderer.invoke('browser-view:get-zoom'),
  setZoom: (factor) => ipcRenderer.invoke('browser-view:set-zoom', factor),
  zoomStep: (direction) => ipcRenderer.invoke('browser-view:zoom-step', direction),
  zoomReset: () => ipcRenderer.invoke('browser-view:zoom-reset'),
  onZoomChanged: (handler) => {
    const listener = (_event, factor) => handler(factor)
    ipcRenderer.on('browser-view:zoom-changed', listener)
    return () => ipcRenderer.removeListener('browser-view:zoom-changed', listener)
  }
})
