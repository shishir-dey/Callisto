import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'

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
    mainWindow.webContents.openDevTools({ mode: 'detach', activate: false })
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

async function checkServerRunning(): Promise<boolean> {
  try {
    // Try to connect to the WebSocket endpoint
    const response = await fetch('http://127.0.0.1:9229/ws', {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    // WebSocket endpoints typically return 426 (Upgrade Required) or 400 (Bad Request)
    console.log('Server check response status:', response.status)
    return response.status === 426 || response.status === 400 || response.ok
  } catch (error) {
    console.log('Server check failed:', error instanceof Error ? error.message : String(error))
    return false
  }
}

function startServer(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // In development mode, check if server is already running
    if (isDev) {
      console.log('Development mode detected, checking if server is already running...')
      const serverRunning = await checkServerRunning()
      if (serverRunning) {
        console.log('Server already running, skipping server startup')
        resolve()
        return
      }
      console.log('No server detected, starting our own...')
    }

    // Always check for dev server first, then fall back to production
    let serverPath: string

    // Check if dev server exists first
    const appRoot = join(__dirname, '../../../..')
    const devServerPath = join(appRoot, 'server/target/debug/callisto')

    if (existsSync(devServerPath)) {
      serverPath = devServerPath
      console.log('Using development server binary')
    } else {
      // In production, server should be bundled in app resources
      serverPath = join(process.resourcesPath, 'server/callisto')
      console.log('Using production server binary')
    }

    console.log('Starting server at:', serverPath)
    console.log('__dirname:', __dirname)
    console.log('isDev:', isDev)
    console.log('process.resourcesPath:', process.resourcesPath)

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
    return { success: false, error: error instanceof Error ? error.message : String(error) }
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