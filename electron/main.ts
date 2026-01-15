import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// The built directory structure
//
// ├─┬─ dist
// │ └── index.html
// ├── dist-electron
// │ ├── main.ts
// │ └── preload.ts
//
process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(__dirname, '../public')

let win: BrowserWindow | null

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
    },
  })
  //デバッグ用検証表示コマンド使わないときはコメントアウト
  win?.webContents.openDevTools()

  win.setMenu(null) // Hide default menu

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(join(process.env.DIST!, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()

  // IPC Handlers
  ipcMain.handle('save-file', async (_event, content: string, filePath?: string) => {

    let targetPath = filePath

    // パスが指定されていない場合（＝新規保存、または「名前を付けて保存」）だけダイアログを出す
    if (!targetPath) {
      const { canceled, filePath: newPath } = await dialog.showSaveDialog({
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      if (canceled || !newPath) {
        return { success: false }
      }
      targetPath = newPath
    }

    // ファイル書き込み実行
    try {
      await fs.writeFile(targetPath, content, 'utf-8')
      // 成功したら、保存したパスも一緒に返す（React側で覚えるため）
      return { success: true, filePath: targetPath }
    } catch (error) {
      console.error('Failed to save file:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (canceled || filePaths.length === 0) {
      return { canceled: true }
    }

    try {
      const content = await fs.readFile(filePaths[0], 'utf-8')
      return { canceled: false, content, filePath: filePaths[0] }
    } catch (error) {
      console.error('Failed to open file:', error)
      return { canceled: true, error: String(error) }
    }
  })
})