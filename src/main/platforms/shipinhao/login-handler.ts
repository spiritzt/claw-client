import { BrowserWindow } from 'electron';
import { ILoginHandler, PlatformType } from '../interfaces';

export class ShipinhaoLoginHandler implements ILoginHandler {
    platform: PlatformType = 'shipinhao';
    loginUrl = 'https://channels.weixin.qq.com/login.html';
    loginSuccessPatterns = ['https://channels.weixin.qq.com/platform', 'https://channels.weixin.qq.com/platform/post/create'];

    async getUserInfo(win: BrowserWindow): Promise<{ name: string; avatar: string; plateNumber: string }> {
        await win.webContents.executeJavaScript(`
            new Promise((resolve) => {
                const check = () => {
                    const name = document.querySelector('[class*="finder-nickname"]')?.innerText?.trim();
                    if (name) {
                        resolve();
                    } else {
                        setTimeout(check, 500);
                    }
                };
                check();
            })
        `);

        return await win.webContents.executeJavaScript(`
            (function() {
                const name = document.querySelector('[class*="finder-nickname"]')?.innerText?.trim() || '';
                const plateNumber = document.querySelector('[class*="finder-uniq-id"]')?.innerText?.trim() || '';
                const avatar = document.querySelector('[class*="avatar"]')?.src || '';
                return { name, avatar, plateNumber };
            })()
        `);
    }
}