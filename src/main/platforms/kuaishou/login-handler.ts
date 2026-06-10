import { BrowserWindow } from 'electron';
import { ILoginHandler, PlatformType } from '../interfaces';

export class KuaishouLoginHandler implements ILoginHandler {
    platform: PlatformType = 'kuaishou';
    loginUrl = 'https://passport.kuaishou.com/pc/account/login/?sid=kuaishou.web.cp.api&callback=https%3A%2F%2Fcp.kuaishou.com%2Frest%2Finfra%2Fsts%3FfollowUrl%3Dhttps%253A%252F%252Fcp.kuaishou.com%252Fprofile%26setRootDomain%3Dtrue';
    loginSuccessPatterns = ['cp.kuaishou.com/profile'];

    async getUserInfo(win: BrowserWindow): Promise<{ name: string; avatar: string; plateNumber: string }> {
        await win.webContents.executeJavaScript(`
            new Promise((resolve) => {
                const check = () => {
                    const name = document.querySelector('[class*="user-info"]')?.innerText?.trim() || '';
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
                const name = document.querySelector('[class*="user-info"]')?.innerText?.trim() || '';
                const avatar = document.querySelector('[class*="user-image"]')?.src || '';
                const plateNumber = '';
                return { name, avatar, plateNumber };
            })()
        `);
    }
}