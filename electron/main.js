const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const nextApp = next({ dev, dir: app.getAppPath() });
const handle = nextApp.getRequestHandler();

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
        icon: path.join(__dirname, '../public/favicon.ico') // Adjust if icon exists elsewhere
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
