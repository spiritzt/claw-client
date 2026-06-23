import { BrowserWindow } from 'electron';
import { IHeartbeatChecker, PlatformType } from '../interfaces';

export class DouyinHeartbeatChecker implements IHeartbeatChecker {
    platform: PlatformType = 'douyin';
    checkUrl = 'https://creator.douyin.com/creator-micro/home';

    async checkLoginStatus(win: BrowserWindow): Promise<boolean> {
        await win.loadURL(this.checkUrl);
        await new Promise(resolve => setTimeout(resolve, 3500));

        return await win.webContents.executeJavaScript(`
            (function() {
                const hasLoginText = document.body.innerText.includes('扫码登录')
                return !hasLoginText;
            })()
        `);
    }
}