// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  saveFile: (content: string, filePath?: string) => ipcRenderer.invoke('save-file', content, filePath),  // ★この1行を追加
  openFile: () => ipcRenderer.invoke('open-file')
})