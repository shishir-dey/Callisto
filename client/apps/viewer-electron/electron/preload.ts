import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Server management
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  restartServer: () => ipcRenderer.invoke('restart-server'),
  restartServerWithDevice: (deviceType: 'mock' | 'real') => ipcRenderer.invoke('restart-server-with-device', deviceType),
  getAvailableDevices: () => ipcRenderer.invoke('get-available-devices'),
  
  // File dialogs
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  
  // Platform info
  platform: process.platform,
  
  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
})

// Type definitions for the exposed API
export interface ElectronAPI {
  getServerStatus: () => Promise<{ running: boolean; pid?: number }>
  restartServer: () => Promise<{ success: boolean; error?: string }>
  restartServerWithDevice: (deviceType: 'mock' | 'real') => Promise<{ success: boolean; error?: string }>
  getAvailableDevices: () => Promise<{ success: boolean; devices: Array<{ id: string; name: string; type: 'mock' | 'real' }> }>
  showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>
  showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths?: string[] }>
  platform: string
  versions: {
    node: string
    chrome: string
    electron: string
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}