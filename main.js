const { app, BrowserWindow, ipcMain, globalShortcut, screen, dialog } = require('electron');
const fs = require('fs');
let win;

function create() {
  const b = screen.getPrimaryDisplay().bounds;
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, resizable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: false, title: 'Rafex Overlay',
    webPreferences: { preload: __dirname + '/preload.js', contextIsolation: true }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(false);
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  create();
  // F8 — переключить «Рисую» / «Редактирую», F9 — спрятать/показать, F10 — выход
  globalShortcut.register('F8', () => win && win.webContents.send('toggle-edit'));
  globalShortcut.register('F9', () => win && (win.isVisible() ? win.hide() : win.showInactive()));
  globalShortcut.register('F10', () => app.quit());
});

ipcMain.on('set-ignore', (_e, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});
ipcMain.on('quit', () => app.quit());

// Загрузка по ссылке из main-процесса: нет CORS, подставляем User-Agent
ipcMain.handle('fetch-image', async (_e, url) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8'
      }
    });
    if (!r.ok) return { error: 'HTTP ' + r.status };
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = sniff(buf);
    if (!mime) return { error: 'NOT_IMAGE' };
    return { dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'TIMEOUT' : 'FAIL' };
  } finally { clearTimeout(t); }
});

ipcMain.handle('open-file', async () => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const buf = fs.readFileSync(r.filePaths[0]);
  const mime = sniff(buf);
  return mime ? `data:${mime};base64,${buf.toString('base64')}` : null;
});

function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  return null;
}

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
