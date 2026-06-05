import { BrowserWindow, session, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface AccountInfo {
    id: string;
    name: string;
    avatar: string;
    partition: string;
    loginValid: boolean;
    lastChecked: number;
}

const accounts = new Map<string, AccountInfo>();

// 持久化文件路径
const ACCOUNTS_FILE = path.join(app.getPath('userData'), 'accounts.json');

export class AccountManager {

    /**
     * 启动时加载已保存的账号
     */
    loadAccounts(): void {
        try {
            if (fs.existsSync(ACCOUNTS_FILE)) {
                const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
                for (const account of data) {
                    accounts.set(account.id, account);
                }
                console.log(`已加载 ${accounts.size} 个账号`);
            }
        } catch (e) {
            console.error('加载账号数据失败:', e);
        }
    }

    /**
     * 保存账号数据到磁盘
     */
    private saveAccounts(): void {
        try {
            const data = Array.from(accounts.values());
            fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
        } catch (e) {
            console.error('保存账号数据失败:', e);
        }
    }

    /**
     * 初始化账号 - 弹出扫码登录窗口
     */
    async initAccount(accountId: string): Promise<{ success: boolean; message: string }> {
        if (accounts.has(accountId)) {
            return { success: false, message: '账号已存在' };
        }

        const partition = `persist:dy_${accountId}`;

        const loginWin = new BrowserWindow({
            width: 1060,
            height: 840,
            title: '扫码登录抖音创作者中心',
            resizable: true,
            webPreferences: {
                partition,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        await loginWin.loadURL('https://creator.douyin.com');

        return new Promise((resolve) => {
            loginWin.webContents.on('did-navigate', (_event, url) => {
                if (url.includes('creator-micro/home') || url.includes('creator-micro/content')) {
                    this.handleLoginSuccess(accountId, partition, loginWin, resolve);
                }
            });

            // 新增：SPA 内部路由跳转
            loginWin.webContents.on('did-navigate-in-page', (_event, url) => {
                if (url.includes('creator-micro/home') || url.includes('creator-micro/content')) {
                    this.handleLoginSuccess(accountId, partition, loginWin, resolve);
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
     * 创建隐藏窗口用于自动化操作
     */
    createHiddenWindow(accountId: string): BrowserWindow | null {
        const account = accounts.get(accountId);
        if (!account) return null;

        return new BrowserWindow({
            show: false,
            webPreferences: {
                partition: account.partition,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
    }

    /**
     * 获取账号的 session
     */
    getSession(accountId: string): Electron.Session | null {
        const account = accounts.get(accountId);
        if (!account) return null;
        return session.fromPartition(account.partition);
    }

    /**
     * 检查账号登录态
     */
    async checkLoginStatus(accountId: string): Promise<boolean> {
        const account = accounts.get(accountId);
        if (!account) return false;

        const win = this.createHiddenWindow(accountId);
        if (!win) return false;

        try {
            await win.loadURL('https://creator.douyin.com/creator-micro/home');
            const currentUrl = win.webContents.getURL();

            const isValid = !currentUrl.includes('login');
            account.loginValid = isValid;
            account.lastChecked = Date.now();
            this.saveAccounts();
            return isValid;
        } finally {
            if (!win.isDestroyed()) win.close();
        }
    }

    /**
     * 批量检查所有账号登录态
     */
    async checkAllLoginStatus(): Promise<Array<{ id: string; valid: boolean }>> {
        const results = [];
        for (const [id] of accounts) {
            const valid = await this.checkLoginStatus(id);
            results.push({ id, valid });
        }
        return results;
    }

    /**
     * 获取所有账号列表
     */
    listAccounts(): AccountInfo[] {
        return Array.from(accounts.values());
    }

    /**
     * 删除账号（清除 Cookie 和持久化数据）
     */
    async removeAccount(accountId: string): Promise<boolean> {
        const account = accounts.get(accountId);
        if (!account) return false;

        const ses = session.fromPartition(account.partition);
        await ses.clearStorageData();
        accounts.delete(accountId);
        this.saveAccounts();
        return true;
    }

    private handleLoginSuccess(
        accountId: string,
        partition: string,
        win: BrowserWindow,
        resolve: (value: { success: boolean; message: string }) => void
    ) {
        if (accounts.has(accountId)) return; // 防止重复触发

        accounts.set(accountId, {
            id: accountId,
            name: '',
            avatar: '',
            partition,
            loginValid: true,
            lastChecked: Date.now(),
        });

        this.saveAccounts();
        win.close();
        resolve({ success: true, message: '登录成功' });
    }
}