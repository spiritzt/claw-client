import { BrowserWindow, Notification } from 'electron';
import { AccountManager } from './account-manager';

export class CookieKeeper {
    private accountManager: AccountManager;
    private timer: NodeJS.Timeout | null = null;
    private static readonly INTERVAL = 4 * 60 * 60 * 1000;

    constructor(accountManager: AccountManager) {
        this.accountManager = accountManager;
    }

    start() {
        this.timer = setInterval(() => this.heartbeat(), CookieKeeper.INTERVAL);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async heartbeat() {
        const accounts = this.accountManager.listAccounts();
        const expiredIds: string[] = [];

        for (const account of accounts) {
            try {
                const win = new BrowserWindow({
                    show: false,
                    webPreferences: {
                        partition: account.partition,
                        contextIsolation: true,
                        nodeIntegration: false,
                    },
                });

                await win.loadURL('https://creator.douyin.com/creator-micro/home');
                await new Promise(resolve => setTimeout(resolve, 3000));

                const currentUrl = win.webContents.getURL();
                account.loginValid = !currentUrl.includes('login');
                account.lastChecked = Date.now();

                if (!account.loginValid) {
                    expiredIds.push(account.id);
                }

                if (!win.isDestroyed()) win.close();
            } catch (e) {
                console.error(`心跳检查账号 ${account.id} 失败:`, e);
            }
        }

        // 有过期账号，通知用户
        if (expiredIds.length > 0) {
            new Notification({
                title: '肯登攀 - 登录过期',
                body: `${expiredIds.length} 个账号需要重新扫码登录`,
            }).show();

            // 通知前端
            const allWindows = BrowserWindow.getAllWindows();
            for (const win of allWindows) {
                win.webContents.executeJavaScript(`
          if (window.clawClient && window.clawClient.onAccountsExpired) {
            window.clawClient.onAccountsExpired(${JSON.stringify(expiredIds)});
          }
        `);
            }
        }
    }
}