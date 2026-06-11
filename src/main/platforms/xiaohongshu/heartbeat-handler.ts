import { BrowserWindow } from 'electron';
import { IHeartbeatChecker, PlatformType } from '../interfaces';

export class XiaohongshuHeartbeatChecker implements IHeartbeatChecker {
    platform: PlatformType = 'xiaohongshu';
    checkUrl = 'https://creator.xiaohongshu.com/new/home';

    async checkLoginStatus(win: BrowserWindow): Promise<boolean> {
        await win.loadURL(this.checkUrl);
        await new Promise(resolve => setTimeout(resolve, 3000));

        return await win.webContents.executeJavaScript(`
            (function() {
                const url = window.location.href;
                const onLoginPage = url.includes('login');
                return !onLoginPage;
            })()
        `);
    }
}