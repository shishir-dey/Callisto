import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'

const isDev = process.env.IS_DEV === 'true'

let mainWindow: BrowserWindow | null = null
let serverProcess: ChildProcess | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset', // macOS style
    show: false, // Don't show until ready
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverPath = isDev 
      ? join(__dirname, '../../../server/target/debug/callisto')
      : join(process.resourcesPath, 'server/callisto')

    console.log('Starting server at:', serverPath)

    serverProcess = spawn(serverPath, ['--mock'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    serverProcess.stdout?.on('data', (data) => {
      console.log('Server stdout:', data.toString())
      if (data.toString().includes('Server listening')) {
        resolve()
      }
    })

    serverProcess.stderr?.on('data', (data) => {
      console.error('Server stderr:', data.toString())
    })

    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error)
      reject(error)
    })

    serverProcess.on('exit', (code) => {
      console.log('Server process exited with code:', code)
      serverProcess = null
    })

    // Timeout after 10 seconds
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        resolve() // Assume it started successfully
      }
    }, 10000)
  })
}

function stopServer(): void {
  if (serverProcess && !serverProcess.killed) {
    console.log('Stopping server process')
    serverProcess.kill('SIGTERM')
    serverProcess = null
  }
}

// App event handlers
app.whenReady().then(async () => {
  try {
    await startServer()
    createWindow()
  } catch (error) {
    console.error('Failed to start server:', error)
    dialog.showErrorBox('Server Error', 'Failed to start the Callisto server. Please check the logs.')
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopServer()
})

// IPC handlers
ipcMain.handle('get-server-status', () => {
  return {
    running: serverProcess !== null && !serverProcess.killed,
    pid: serverProcess?.pid,
  }
})

ipcMain.handle('restart-server', async () => {
  stopServer()
  try {
    await startServer()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('show-save-dialog', async (_, options) => {
  if (!mainWindow) return { canceled: true }
  
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result
})

ipcMain.handle('show-open-dialog', async (_, options) => {
  if (!mainWindow) return { canceled: true }
  
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})