import { BrowserWindow } from 'electron';
import { IHeartbeatChecker, PlatformType } from '../interfaces';

export class KuaishouHeartbeatChecker implements IHeartbeatChecker {
    platform: PlatformType = 'kuaishou';
    checkUrl = 'https://cp.kuaishou.com/article';

    async checkLoginStatus(win: BrowserWindow): Promise<boolean> {
        await win.loadURL(this.checkUrl);
        await new Promise(resolve => setTimeout(resolve, 3500));

        return await win.webContents.executeJavaScript(`
            (function() {
                return !document.body.innerText.includes('立即登录');
            })()
        `);
    }
}