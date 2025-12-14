const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { spawn } = require('child_process');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const nextApp = next({ dev, dir: app.getAppPath() });
const handle = nextApp.getRequestHandler();

// Store reference to Ollama process
let ollamaProcess = null;

/**
 * Check if Ollama is running by pinging its API
 */
async function isOllamaRunning(host = 'http://127.0.0.1:11434') {
    try {
        const response = await fetch(`${host}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Wait for Ollama to become available
 */
async function waitForOllama(host = 'http://127.0.0.1:11434', maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        if (await isOllamaRunning(host)) {
            return true;
        }
        // Wait 1 second between attempts
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
}

/**
 * Start Ollama if it's not already running
 */
async function ensureOllamaRunning() {
    console.log('Checking if Ollama is running...');

    if (await isOllamaRunning()) {
        console.log('✓ Ollama is already running');
        return true;
    }

    console.log('Ollama not running, attempting to start...');

    try {
        // Determine the command based on the platform
        const isWin = process.platform === 'win32';
        const command = isWin ? 'ollama.exe' : 'ollama';

        // Spawn Ollama as a detached process
        ollamaProcess = spawn(command, ['serve'], {
            detached: true,
            stdio: 'ignore',
            shell: isWin, // Use shell on Windows to find ollama in PATH
            windowsHide: true // Hide the console window on Windows
        });

        // Unref the process so it doesn't keep our app from exiting
        ollamaProcess.unref();

        ollamaProcess.on('error', (err) => {
            console.error('Failed to start Ollama:', err.message);
            ollamaProcess = null;
        });

        console.log('Waiting for Ollama to become available...');

        // Wait for Ollama to start (up to 30 seconds)
        const isReady = await waitForOllama();

        if (isReady) {
            console.log('✓ Ollama started successfully');
            return true;
        } else {
            console.warn('⚠ Ollama did not start within the timeout period');
            return false;
        }
    } catch (error) {
        console.error('Error starting Ollama:', error.message);
        return false;
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        autoHideMenuBar: true,
        title: "OpenRAG",
        icon: path.join(__dirname, '../public/logo.png')
    });

    const url = `http://${hostname}:${port}`;
    win.loadURL(url);

    // Open external links in the user's default browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

app.whenReady().then(async () => {
    // Try to start Ollama before anything else
    await ensureOllamaRunning();

    if (!app.isPackaged) {
        // Development: Server is already running via 'npm run dev'
        console.log('Development mode: Connecting to external server');
        createWindow();
    } else {
        // Production: Start the Next.js server internally
        try {
            await nextApp.prepare();
            createServer((req, res) => {
                const parsedUrl = parse(req.url, true);
                handle(req, res, parsedUrl);
            }).listen(port, () => {
                console.log(`> Ready on http://${hostname}:${port}`);
                createWindow();
            });
        } catch (err) {
            console.error('Failed to prepare Next.js app:', err);
        }
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
