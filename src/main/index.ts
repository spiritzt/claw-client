import { app, BrowserWindow, ipcMain, session, shell, Notification, Tray, Menu, nativeImage, protocol } from 'electron';
import * as path from 'path';
import { AccountManager } from './account-manager';
import { PublishEngine } from './publish-engine';
import { CookieKeeper } from './cookie-keeper';
import { registerDomInspector } from './dom-inspector';
import {exitIconBase64} from "./exitIcon";
import { autoUpdater } from "electron-updater";

const SYSTEM_URL = 'http://localhost/kenClaw';

let mainWindow: BrowserWindow | null = null;
let tray;
let isQuitting = false;
const accountManager = new AccountManager();
const publishEngine = new PublishEngine(accountManager);
const cookieKeeper = new CookieKeeper(accountManager);

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        show: false,
        autoHideMenuBar: true,
        title: '肯龙虾',
        icon: path.join(__dirname, '..', 'assets', 'icon', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.maximize();
    mainWindow.show();

    // mainWindow.webContents.on('did-finish-load', () => {
    //     // @ts-ignore
    //     mainWindow.setTitle("肯龙虾");
    // });

    mainWindow.loadURL(SYSTEM_URL);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('close', (event) => {
        // 如果标志位为 false，说明只是点了右上角的 X，阻止关闭并隐藏
        if (!isQuitting) {
            event.preventDefault();
            // @ts-ignore
            mainWindow.hide();
        }
        // 如果标志位为 true，说明是触发了真正的退出流程，放行关闭
    });
    setupAutoUpdater();
}

function setupAutoUpdater() {
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('update-available', () => {
        console.log('检测到新版本，正在后台下载...');
    });
    autoUpdater.on('update-downloaded', () => {
        console.log('更新下载完成，准备安装');
        autoUpdater.quitAndInstall();
    });
}

function createTray() {
    const iconBase64: any = exitIconBase64;
    const icon = nativeImage.createFromDataURL(`data:image/png;base64,${iconBase64}`);
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
        { label: '显示窗口', click: () => {
            // @ts-ignore
            mainWindow.show()
            }
        },
        { type: 'separator' },
        // 👇 3. 在托盘菜单中点击退出时，先修改标志位，再调用 quit
        { label: '退出', click: () => {
                isQuitting = true;
                app.quit();
            }}
    ]);
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow) {
            // 如果窗口被隐藏了，就显示它并让它获得焦点
            mainWindow.show();
        }
    });
}

app.whenReady().then(async () => {
    // 启动时加载已保存的账号
    accountManager.loadAccounts();

    createMainWindow();
    createTray();

    registerDomInspector();

    // 启动时检查所有账号登录态
    const results = await accountManager.checkAllLoginStatus();
    const expired = results.filter(r => !r.valid);
    if (expired.length > 0) {
        new Notification({
            title: '肯龙虾 - 账号提醒',
            body: `${expired.length} 个抖音账号登录已过期，请重新扫码登录`,
        }).show();

        mainWindow?.webContents.send('accounts:expired', expired.map(r => r.id));

        // 通知前端
        // mainWindow?.webContents.executeJavaScript(`
        //   if (window.clawClient && window.clawClient.onAccountsExpired) {
        //     window.clawClient.onAccountsExpired(${JSON.stringify(expired)});
        //   }
        // `);
    }

    // 启动 Cookie 心跳
    cookieKeeper.start();

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

app.on('before-quit', () => {
    isQuitting = true;
});

// ========== IPC 通信 ==========

ipcMain.handle('account:init', async (_, accountId: string, typeName: string, nickName: string, platform: string) => {
    return accountManager.initAccount(accountId, typeName, nickName, platform as any);
});

ipcMain.handle('account:reLogin', async (_, accountId: string, typeName: string, nickName: string) => {
    return accountManager.reLogin(accountId, typeName, nickName);
});

ipcMain.handle('account:reload', async () => {
    accountManager.reloadAccounts();
    return accountManager.listAccounts();
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