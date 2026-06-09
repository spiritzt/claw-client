import { BrowserWindow } from 'electron';
import { IHeartbeatChecker, PlatformType } from '../interfaces';

export class KuaishouHeartbeatChecker implements IHeartbeatChecker {
    platform: PlatformType = 'kuaishou';
    checkUrl = 'https://cp.kuaishou.com/article';

    async checkLoginStatus(win: BrowserWindow): Promise<boolean> {
        await win.loadURL(this.checkUrl);
        await new Promise(resolve => setTimeout(resolve, 5000));

        return await win.webContents.executeJavaScript(`
            (function() {
                const currentUrl = window.location.href;
                if (currentUrl.includes('passport') || currentUrl.includes('login')) {
                    return false;
                }
                const hasLoginBtn = !!document.querySelector('[class*="login"]');
                const hasLoginText = document.body.innerText.includes('登录') &&
                                     !document.body.innerText.includes('登录过期');
                return !(hasLoginBtn || hasLoginText);
            })()
        `);
    }
}