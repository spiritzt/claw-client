import { BrowserWindow } from 'electron';
import { ILoginHandler, PlatformType } from '../interfaces';

export class XiaohongshuLoginHandler implements ILoginHandler {
    platform: PlatformType = 'xiaohongshu';
    loginUrl = 'https://creator.xiaohongshu.com';
    loginSuccessPatterns = ['creator.xiaohongshu.com/publish', 'https://creator.xiaohongshu.com/new/home'];

    async getUserInfo(win: BrowserWindow): Promise<{ name: string; avatar: string; plateNumber: string }> {
        await win.webContents.executeJavaScript(`
            new Promise((resolve) => {
                const check = () => {
                    const name = document.querySelector('[class*="user-info"]')?.innerText?.trim();
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
                const avatar = document.querySelector('[class*="user_avatar"]')?.src || '';
                const descTexts = document.querySelectorAll('.description-text');
                const othersDesc = Array.from(descTexts).find(el => el.classList.contains('others'));
                const idDiv = Array.from(othersDesc?.children || []).find(div => div.innerText.includes('小红书账号'));
                const rawId = idDiv?.innerText?.trim() || '';
                const plateNumber = rawId.replace('小红书账号:', '').replace('小红书账号：', '').trim();
                return { name, avatar, plateNumber };
            })()
        `);
    }
}