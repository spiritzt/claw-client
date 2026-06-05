import { app, BrowserWindow, ipcMain, session, shell, Notification } from 'electron';
import * as path from 'path';
import { AccountManager } from './account-manager';
import { PublishEngine } from './publish-engine';
import { CookieKeeper } from './cookie-keeper';
import { registerDomInspector } from './dom-inspector';

const SYSTEM_URL = 'https://www.kindpo.com';

let mainWindow: BrowserWindow | null = null;
const accountManager = new AccountManager();
const publishEngine = new PublishEngine(accountManager);
const cookieKeeper = new CookieKeeper(accountManager);

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        title: '肯登攀',
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadURL(SYSTEM_URL);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    // 启动时加载已保存的账号
    accountManager.loadAccounts();

    createMainWindow();

    // 启动时检查所有账号登录态
    const results = await accountManager.checkAllLoginStatus();
    const expired = results.filter(r => !r.valid);
    if (expired.length > 0) {
        new Notification({
            title: '肯登攀 - 账号提醒',
            body: `${expired.length} 个抖音账号登录已过期，请重新扫码登录`,
        }).show();

        // 通知前端
        mainWindow?.webContents.executeJavaScript(`
      if (window.clawClient && window.clawClient.onAccountsExpired) {
        window.clawClient.onAccountsExpired(${JSON.stringify(expired)});
      }
    `);
    }

    // 启动 Cookie 心跳
    cookieKeeper.start();

    registerDomInspector();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    cookieKeeper.stop();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ========== IPC 通信 ==========

ipcMain.handle('account:init', async (_, accountId: string) => {
    return accountManager.initAccount(accountId);
});

ipcMain.handle('account:list', async () => {
    return accountManager.listAccounts();
});

ipcMain.handle('account:remove', async (_, accountId: string) => {
    return accountManager.removeAccount(accountId);
});

ipcMain.handle('account:checkLogin', async (_, accountId: string) => {
    return accountManager.checkLoginStatus(accountId);
});

ipcMain.handle('account:checkAll', async () => {
    return accountManager.checkAllLoginStatus();
});

ipcMain.handle('publish:video', async (_, params: {
    accountId: string;
    videoUrl: string;
    title: string;
    tags: string[];
    publishTime?: string;
}) => {
    return publishEngine.publishVideo(params);
});

ipcMain.handle('publish:batch', async (_, tasks: Array<{
    accountId: string;
    videoUrl: string;
    title: string;
    tags: string[];
}>) => {
    return publishEngine.batchPublish(tasks);
});