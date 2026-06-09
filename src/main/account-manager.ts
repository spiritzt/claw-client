import { BrowserWindow, session, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface AccountInfo {
    id: string;
    name: string;
    plateNumber: string;
    nickname: string;
    typename: string;
    avatar: string;
    platform: string;
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
    async initAccount(accountId: string, typeName: string, nickName: string): Promise<{ success: boolean; message: string }> {
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
                    this.handleLoginSuccess(accountId, partition, loginWin, typeName, nickName, resolve);
                }
            });

            // 新增：SPA 内部路由跳转
            loginWin.webContents.on('did-navigate-in-page', (_event, url) => {
                if (url.includes('creator-micro/home') || url.includes('creator-micro/content')) {
                    this.handleLoginSuccess(accountId, partition, loginWin, typeName, nickName, resolve);
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

    // createHiddenWindow(accountId: string): BrowserWindow | null {
    //     const account = accounts.get(accountId);
    //     if (!account) return null;
    //
    //     return new BrowserWindow({
    //         show: true,        // ← 改成 true，临时调试
    //         width: 1200,
    //         height: 900,
    //         webPreferences: {
    //             partition: account.partition,
    //             contextIsolation: true,
    //             nodeIntegration: false,
    //         },
    //     });
    // }

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

            // 等待 SPA 路由跳转完成
            await new Promise(resolve => setTimeout(resolve, 3000));

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

    private async handleLoginSuccess(
        accountId: string,
        partition: string,
        win: BrowserWindow,
        typeName: string,
        nickName: string,
        resolve: (value: { success: boolean; message: string }) => void
    ) {
        if (accounts.has(accountId)) return; // 防止重复触发

        await win.webContents.executeJavaScript(`
            new Promise((resolve) => {
                const check = () => {
                    const name = document.querySelector('[class*="name"]')?.innerText?.trim();
                    if (name) {
                        resolve();
                    } else {
                        setTimeout(check, 500);
                    }
                };
                check();
            })
        `);

        const userInfo = await win.webContents.executeJavaScript(`
            (function() {
                const avatar = document.querySelector('[class*="avatar"] img')?.src || '';
                const name = document.querySelector('[class*="name"]')?.innerText?.trim() || '';
                const rawId = document.querySelector('[class*="unique_id"]')?.innerText?.trim() || '';
                const douyinId = rawId.replace('抖音号：', '');
                return { name, avatar, douyinId };
            })()
        `);

        // 检查抖音号是否已存在
        const existingAccount = Array.from(accounts.values()).find(
            acc => acc.plateNumber === userInfo.douyinId
        );

        if (existingAccount) {
            // 清除刚登录的 Session，等于退出登录
            const ses = session.fromPartition(partition);
            await ses.clearStorageData();
            win.close();
            resolve({ success: false, message: `抖音号 ${userInfo.douyinId} 已存在（账号：${existingAccount.id}），请勿重复添加` });
            return;
        }

        accounts.set(accountId, {
            id: accountId,
            name: userInfo.name,
            plateNumber: userInfo.douyinId,
            nickname: nickName,
            typename: typeName,
            avatar: userInfo.avatar,
            partition,
            platform: "douyin",
            loginValid: true,
            lastChecked: Date.now(),
        });

        this.saveAccounts();
        win.close();
        resolve({ success: true, message: '登录成功' });
    }
}