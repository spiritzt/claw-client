import { BrowserWindow, Notification } from 'electron';
import { AccountManager } from './account-manager';
import { getHeartbeatChecker } from './platforms/registry';

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
            const checker = getHeartbeatChecker(account.platform);
            if (!checker) continue;

            try {
                const win = new BrowserWindow({
                    show: false,
                    width: 1200,
                    height: 900,
                    webPreferences: {
                        partition: account.partition,
                        contextIsolation: true,
                        nodeIntegration: false,
                    },
                });

                // 伪装 User-Agent
                // 只有快手需要伪装
                if (account.platform === 'kuaishou') {
                    win.webContents.setUserAgent(
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    );
                }
                const isValid = await checker.checkLoginStatus(win);
                account.loginValid = isValid;
                account.lastChecked = Date.now();

                if (!account.loginValid) {
                    expiredIds.push(account.id);
                }

                if (!win.isDestroyed()) win.close();
            } catch (e) {
                console.error(`Heartbeat check account ${account.id} failed:`, e);
            }
        }

        if (expiredIds.length > 0) {
            new Notification({
                title: '登录过期',
                body: `${expiredIds.length} 个账号需要重新扫码登录`,
            }).show();

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