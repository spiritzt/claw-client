import {BrowserWindow, session, app, shell} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AccountInfo, PlatformType } from './platforms/interfaces';
import { getLoginHandler, getPartitionPrefix, getHeartbeatChecker } from './platforms/registry';

const accounts = new Map<string, AccountInfo>();

const ACCOUNTS_FILE = path.join(app.getPath('userData'), 'accounts.json');

export class AccountManager {

    loadAccounts(): void {
        try {
            if (fs.existsSync(ACCOUNTS_FILE)) {
                const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
                for (const account of data) {
                    accounts.set(account.id, account);
                }
                console.log(`Loaded ${accounts.size} account(s)`);
            }
        } catch (e) {
            console.error('Failed to load accounts:', e);
        }
    }

    private saveAccounts(): void {
        try {
            const data = Array.from(accounts.values());
            fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
        } catch (e) {
            console.error('Failed to save accounts:', e);
        }
    }

    /**
     * 初始化账号 - 弹出扫码登录窗口
     */
    async initAccount(accountId: string, typeName: string, nickName: string, platform: PlatformType): Promise<{ success: boolean; message: string }> {
        if (accounts.has(accountId)) {
            return { success: false, message: '账号已存在' };
        }

        const loginHandler = getLoginHandler(platform);
        const prefix = getPartitionPrefix(platform);
        const partition = `persist:${prefix}_${accountId}`;

        const loginWin = new BrowserWindow({
            width: 1360,
            height: 840,
            title: '扫码登录抖',
            resizable: true,
            show: false,
            webPreferences: {
                partition,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        loginWin.maximize();
        loginWin.show();

        // loginWin.webContents.setUserAgent(
        //     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        // );

        await loginWin.loadURL(loginHandler.loginUrl);

        return new Promise((resolve) => {
            const handleLoginSuccess = async () => {
                if (accounts.has(accountId)) return;

                try {
                    const userInfo = await loginHandler.getUserInfo(loginWin);

                    // 检查抖音号是否已存在
                    const existingAccount = Array.from(accounts.values()).find(
                        acc => acc.plateNumber === userInfo.plateNumber && acc.platform === platform
                    );

                    if (existingAccount) {
                        const ses = session.fromPartition(partition);
                        await ses.clearStorageData();
                        loginWin.close();
                        resolve({ success: false, message: `${platform} 账号 ${userInfo.plateNumber} 已存在（账号：${existingAccount.id}），请勿重复添加` });
                        return;
                    }

                    accounts.set(accountId, {
                        id: accountId,
                        name: userInfo.name,
                        plateNumber: userInfo.plateNumber,
                        nickname: nickName,
                        typename: typeName,
                        avatar: userInfo.avatar,
                        partition,
                        platform,
                        loginValid: true,
                        lastChecked: Date.now(),
                    });

                    this.saveAccounts();
                    // loginWin.close();
                    resolve({ success: true, message: '登录成功' });
                } catch (e) {
                    console.error('Failed to get user info:', e);
                    loginWin.close();
                    resolve({ success: false, message: '获取用户信息失败' });
                }
            };

            loginWin.webContents.on('did-navigate', (_event, url) => {
                if (loginHandler.loginSuccessPatterns.some(pattern => url.includes(pattern))) {
                    handleLoginSuccess();
                }
            });

            loginWin.webContents.on('did-navigate-in-page', (_event, url) => {
                if (loginHandler.loginSuccessPatterns.some(pattern => url.includes(pattern))) {
                    handleLoginSuccess();
                }
            });

            loginWin.on('closed', () => {
                if (!accounts.has(accountId)) {
                    resolve({ success: false, message: '用户取消登录' });
                }
            });
        });
    }

    /**
     * 重新登录
     */
    async reLogin(accountId: string, typeName: string, nickName: string): Promise<{ success: boolean; message: string }> {
        const oldAccount = accounts.get(accountId);
        if (!oldAccount) {
            return { success: false, message: '账号不存在' };
        }

        const backup = { ...oldAccount };

        accounts.delete(accountId);
        this.saveAccounts();

        const result = await this.initAccount(accountId, typeName, nickName, backup.platform);

        if (!result.success) {
            accounts.set(accountId, backup);
            this.saveAccounts();
        }

        return result;
    }

    createHiddenWindow(accountId: string): BrowserWindow | null {
        const account = accounts.get(accountId);
        if (!account) return null;

        const win =  new BrowserWindow({
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
        // win.webContents.setUserAgent(
        //     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        // );

        return win;
    }

    showWindow(accountId: string, win: BrowserWindow): void {
        win.show();
        win.focus();
    }

    getSession(accountId: string): Electron.Session | null {
        const account = accounts.get(accountId);
        if (!account) return null;
        return session.fromPartition(account.partition);
    }

    async checkLoginStatus(accountId: string): Promise<boolean> {
        const account = accounts.get(accountId);
        if (!account) return false;

        const win = this.createHiddenWindow(accountId);
        if (!win) return false;

        try {
            const checker = getHeartbeatChecker(account.platform);
            const isValid = await checker.checkLoginStatus(win);

            account.loginValid = isValid;
            account.lastChecked = Date.now();
            this.saveAccounts();
            return isValid;
        } finally {
            if (!win.isDestroyed()) win.close();
        }
    }

    async checkAllLoginStatus(): Promise<Array<{ id: string; valid: boolean }>> {
        const results = [];
        for (const [id] of accounts) {
            const valid = await this.checkLoginStatus(id);
            results.push({ id, valid });
        }
        return results;
    }

    getAccount(accountId: string): AccountInfo | undefined {
        return accounts.get(accountId);
    }

    listAccounts(): AccountInfo[] {
        return Array.from(accounts.values());
    }

    async removeAccount(accountId: string): Promise<boolean> {
        const account = accounts.get(accountId);
        if (!account) return false;

        const ses = session.fromPartition(account.partition);
        await ses.clearStorageData();
        accounts.delete(accountId);
        this.saveAccounts();
        return true;
    }

    reloadAccounts(): void {
        accounts.clear();
        this.loadAccounts();
    }
}