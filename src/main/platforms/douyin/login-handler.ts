import { BrowserWindow } from 'electron';
import { ILoginHandler, PlatformType } from '../interfaces';

export class DouyinLoginHandler implements ILoginHandler {
    platform: PlatformType = 'douyin';
    loginUrl = 'https://creator.douyin.com';
    loginSuccessPatterns = ['creator-micro/home', 'creator-micro/content'];

    async getUserInfo(win: BrowserWindow): Promise<{ name: string; avatar: string; plateNumber: string }> {
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

        return await win.webContents.executeJavaScript(`
            (function() {
                const avatar = document.querySelector('[class*="avatar"] img')?.src || '';
                const name = document.querySelector('[class*="name"]')?.innerText?.trim() || '';
                const rawId = document.querySelector('[class*="unique_id"]')?.innerText?.trim() || '';
                const plateNumber = rawId.replace('抖音号：', '');
                return { name, avatar, plateNumber };
            })()
        `);
    }
}