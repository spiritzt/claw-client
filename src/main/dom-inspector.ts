import {BrowserWindow, ipcMain, shell} from 'electron';

/**
 * DOM 探测工具 - 用于分析创作者中心页面结构
 * 后续可以删掉
 */
export function registerDomInspector(): void {
    ipcMain.handle('debug:openCreator', async (_, accountId: string = 'test', platform: string = 'douyin') => {
        const urls: Record<string, string> = {
            douyin: 'https://creator.douyin.com/creator-micro/content/publish',
            kuaishou: 'https://cp.kuaishou.com/profile',
        };

        const prefixes: Record<string, string> = {
            douyin: 'dy',
            kuaishou: 'ks',
        };

        const win = new BrowserWindow({
            width: 1200,
            height: 900,
            title: '调试',
            webPreferences: {
                partition: `persist:${prefixes[platform] || 'dy'}_${accountId}`,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        // win.webContents.setUserAgent(
        //     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        // );

        await win.loadURL(urls[platform] || urls.douyin);

        win.webContents.openDevTools();

        return true;
    });
}