import { BrowserWindow } from 'electron';
import { IHeartbeatChecker, PlatformType } from '../interfaces';

export class ShipinhaoHeartbeatChecker implements IHeartbeatChecker {
    platform: PlatformType = 'shipinhao';
    checkUrl = 'https://channels.weixin.qq.com/platform';

    async checkLoginStatus(win: BrowserWindow): Promise<boolean> {
        await win.loadURL(this.checkUrl);
        await new Promise(resolve => setTimeout(resolve, 7000));

        return await win.webContents.executeJavaScript(`
            (function() {
                const url = window.location.href;
                const onLoginPage = url.includes('login');
                return !onLoginPage;
            })()
        `);
    }
}