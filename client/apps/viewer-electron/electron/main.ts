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
    titleBarStyle: 'default', // Use default title bar to prevent content overlap
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
    // Always check if server is already running first
    console.log('Checking if server is already running...')
    const serverRunning = await checkServerRunning()
    if (serverRunning) {
      console.log('Server already running, using existing server')
      resolve()
      return
    }

    // Only start our own server if none is running
    console.log('No server detected, starting our own...')

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

    // Start server without any device flags initially
    serverProcess = spawn(serverPath, [], {
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
      // If we get "Address already in use", resolve anyway since server is running
      if (data.toString().includes('Address already in use')) {
        console.log('Server already running on port, using existing server')
        resolve()
      }
    })

    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error)
      // Don't reject if server is already running
      if (error.message.includes('EADDRINUSE')) {
        console.log('Server already running, using existing server')
        resolve()
      } else {
        reject(error)
      }
    })

    serverProcess.on('exit', (code) => {
      console.log('Server process exited with code:', code)
      serverProcess = null
    })

    // Timeout after 10 seconds
    setTimeout(() => {
      resolve() // Always resolve after timeout
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

ipcMain.handle('restart-server-with-device', async (_, deviceType: 'mock' | 'real') => {
  console.log(`Switching to device type: ${deviceType}`)
  
  try {
    // Check if external server is running (from just dev)
    const externalServerRunning = await checkServerRunning()
    if (externalServerRunning && !serverProcess) {
      console.log('External server detected, using existing server')
      // For external servers, we can't change device type, so just connect
      return {
        success: true,
        message: 'Using external server. Device type controlled by server startup arguments.'
      }
    }

    // Only stop our own server process
    if (serverProcess && !serverProcess.killed) {
      console.log('Stopping our server process')
      stopServer()
      // Wait for server to stop
      await new Promise(resolve => setTimeout(resolve, 2000))
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

    const args = deviceType === 'mock' ? ['--mock'] : ['--probe']
    console.log('Starting server with args:', args)

    serverProcess = spawn(serverPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    return new Promise((resolve, reject) => {
      let resolved = false

      serverProcess!.stdout?.on('data', (data) => {
        console.log('Server stdout:', data.toString())
        if (data.toString().includes('Server listening') && !resolved) {
          resolved = true
          resolve({ success: true })
        }
      })

      serverProcess!.stderr?.on('data', (data) => {
        console.error('Server stderr:', data.toString())
        if (data.toString().includes('Address already in use') && !resolved) {
          resolved = true
          resolve({ success: false, error: 'Server port is already in use' })
        }
      })

      serverProcess!.on('error', (error) => {
        console.error('Failed to start server:', error)
        if (!resolved) {
          resolved = true
          reject({ success: false, error: error.message })
        }
      })

      serverProcess!.on('exit', (code) => {
        console.log('Server process exited with code:', code)
        serverProcess = null
        if (!resolved) {
          resolved = true
          resolve({ success: false, error: `Server exited with code ${code}` })
        }
      })

      // Timeout after 15 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          if (serverProcess && !serverProcess.killed) {
            resolve({ success: true }) // Assume it started successfully
          } else {
            resolve({ success: false, error: 'Server startup timeout' })
          }
        }
      }, 15000)
    })
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('get-available-devices', async () => {
  try {
    // Try using probe-rs directly first
    return new Promise((resolve, reject) => {
      const probeProcess = spawn('probe-rs', ['list'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      probeProcess.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      probeProcess.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      probeProcess.on('close', (code) => {
        const devices = [
          { id: 'mock', name: 'Mock Device', type: 'mock' }
        ]

        if (code === 0 && stdout.trim()) {
          // Parse probe-rs list output
          const lines = stdout.split('\n').filter(line => line.trim())
          let probeIndex = 0
          
          for (const line of lines) {
            // Look for probe entries (probe-rs list format)
            if (line.includes('VID:PID') || line.includes('Serial') ||
                line.includes('ST-Link') || line.includes('J-Link') ||
                line.includes('CMSIS-DAP')) {
              
              // Extract probe name and serial if available
              let probeName = 'Unknown Probe'
              if (line.includes('ST-Link')) {
                probeName = `ST-Link Probe`
              } else if (line.includes('J-Link')) {
                probeName = `J-Link Probe`
              } else if (line.includes('CMSIS-DAP')) {
                probeName = `CMSIS-DAP Probe`
              }
              
              // Try to extract serial number
              const serialMatch = line.match(/Serial:\s*([A-Za-z0-9]+)/)
              if (serialMatch) {
                probeName += ` (${serialMatch[1]})`
              }

              devices.push({
                id: `probe_${probeIndex}`,
                name: probeName,
                type: 'real'
              })
              probeIndex++
            }
          }
        }

        console.log('Detected devices:', devices)
        resolve({ success: true, devices })
      })

      probeProcess.on('error', (error) => {
        console.log('probe-rs not available, falling back to mock only:', error.message)
        // Return only mock device if probe-rs is not available
        resolve({
          success: true,
          devices: [{ id: 'mock', name: 'Mock Device', type: 'mock' }]
        })
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        probeProcess.kill()
        resolve({
          success: true,
          devices: [{ id: 'mock', name: 'Mock Device', type: 'mock' }]
        })
      }, 5000)
    })
  } catch (error) {
    return {
      success: true,
      devices: [{ id: 'mock', name: 'Mock Device', type: 'mock' }]
    }
  }
})