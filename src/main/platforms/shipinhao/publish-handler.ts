import { BrowserWindow } from 'electron';
import { IPublishHandler, PublishTask, PublishResult, PlatformType } from '../interfaces';

function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

const SELECTORS = {
    videoFileInput: 'input.upload-input',
    coverFileInput: 'input[type="file"][accept*="image"]',
    titleInput: 'input[placeholder*="标题"]',
    descriptionEditor: 'div[contenteditable="true"]',
};

export class ShipinhaoPublishHandler implements IPublishHandler {
    platform: PlatformType = 'shipinhao';
    publishUrl = 'https://channels.weixin.qq.com/platform/post/create';

    async publishVideo(accountId: string, win: BrowserWindow, task: PublishTask): Promise<PublishResult> {
        const { videoUrl, title, description, tags, coverUrl } = task;

        try {
            // ===== 1. 打开发布页 =====
            await win.loadURL(this.publishUrl);
            await randomDelay(3000, 5000);

            const currentUrl = win.webContents.getURL();
            if (currentUrl.includes('login') || currentUrl.includes('passport')) {
                return { accountId, success: false, message: '登录已过期，请重新扫码登录' };
            }

            // ===== 2. 上传视频 =====
            console.log(`[${accountId}] Start uploading video: ${videoUrl}`);
            const uploadResult = await win.webContents.executeJavaScript(`
                (async function() {
                    try {
                        const response = await fetch(${JSON.stringify(videoUrl)});
                        if (!response.ok) return { success: false, message: '视频下载失败: ' + response.status };
                        const blob = await response.blob();
                        const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
 
                        const fileInput = document.querySelector(${JSON.stringify(SELECTORS.videoFileInput)});
                        if (!fileInput) return { success: false, message: '未找到视频上传控件' };
 
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        fileInput.files = dataTransfer.files;
                        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
 
                        return { success: true, message: '视频上传中' };
                    } catch (e) {
                        return { success: false, message: e.message };
                    }
                })()
            `);

            if (!uploadResult.success) {
                return { accountId, success: false, message: uploadResult.message };
            }

            // ===== 3. 等待视频上传完成 =====
            console.log(`[${accountId}] Waiting for upload complete...`);
            await this.waitForUploadComplete(win);
            console.log(`[${accountId}] Upload complete`);

            // ===== 4. 填写标题 =====
            await randomDelay(1000, 2000);
            if (title) {
                console.log(`[${accountId}] Filling title: ${title}`);
                await win.webContents.executeJavaScript(`
                    (function() {
                        const titleInput = document.querySelector(${JSON.stringify(SELECTORS.titleInput)});
                        if (titleInput) {
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                                window.HTMLInputElement.prototype, 'value'
                            ).set;
                            nativeInputValueSetter.call(titleInput, ${JSON.stringify(title)});
                            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                            titleInput.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                        return false;
                    })()
                `);
            }

            // ===== 5. 填写作品描述 =====
            await randomDelay(1000, 2000);
            const desc = description || '';
            const tagText = (tags && tags.length > 0) ? tags.map(t => '#' + t).join(' ') : '';
            const fullDesc = [desc, tagText].filter(Boolean).join(' ');

            if (fullDesc) {
                console.log(`[${accountId}] Filling description: ${fullDesc}`);
                await win.webContents.executeJavaScript(`
                    (function() {
                        const editor = document.querySelector(${JSON.stringify(SELECTORS.descriptionEditor)});
                        if (editor) {
                            editor.focus();
                            document.execCommand('selectAll', false, null);
                            document.execCommand('insertText', false, ${JSON.stringify(fullDesc)});
                            return true;
                        }
                        return false;
                    })()
                `);
            }

            // ===== 6. 上传封面（可选） =====
            if (coverUrl) {
                await randomDelay(1000, 2000);
                console.log(`[${accountId}] Uploading cover: ${coverUrl}`);
                await win.webContents.executeJavaScript(`
                    (async function() {
                        try {
                            const response = await fetch(${JSON.stringify(coverUrl)});
                            if (!response.ok) return { success: false };
                            const blob = await response.blob();
                            const file = new File([blob], 'cover.jpg', { type: blob.type || 'image/jpeg' });
 
                            const fileInput = document.querySelector(${JSON.stringify(SELECTORS.coverFileInput)});
                            if (!fileInput) return { success: false };
 
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            fileInput.files = dataTransfer.files;
                            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
 
                            return { success: true };
                        } catch (e) {
                            return { success: false, message: e.message };
                        }
                    })()
                `);
            }

            // ===== 7. 点击发布（Electron 原生点击） =====
            await randomDelay(2000, 4000);
            console.log(`[${accountId}] Clicking publish button`);
            const pos = await win.webContents.executeJavaScript(`
                (function() {
                    const btn = document.querySelector('xhs-publish-btn');
                    if (!btn) return null;
                    const rect = btn.getBoundingClientRect();
                    // 两个按钮居中，gap 24px，各 120px 宽
                    // 发布按钮中心 = 条中心 + 72
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    return {
                        x: centerX + 72,
                        y: centerY
                    };
                })()
            `);

            if (!pos) {
                return { accountId, success: false, message: '未找到发布按钮' };
            }

            win.webContents.sendInputEvent({
                type: 'mouseDown',
                x: Math.round(pos.x),
                y: Math.round(pos.y),
                button: 'left',
                clickCount: 1
            });
            await new Promise(r => setTimeout(r, 50));
            win.webContents.sendInputEvent({
                type: 'mouseUp',
                x: Math.round(pos.x),
                y: Math.round(pos.y),
                button: 'left',
                clickCount: 1
            });

            // ===== 7.5 检测短信验证码 =====
            await randomDelay(1500, 2000);
            const needVerify = await win.webContents.executeJavaScript(`
                (function() {
                    const bodyText = document.body.innerText;
                    return bodyText.includes('验证码') || 
                           bodyText.includes('短信验证') || 
                           bodyText.includes('确认本人操作');
                })()
            `);

            if (needVerify) {
                console.log(`[${accountId}] Need SMS verification, showing window...`);
                win.show();
                win.focus();

                await new Promise<void>((resolve) => {
                    const checkInterval = setInterval(async () => {
                        const stillNeed = await win.webContents.executeJavaScript(`
                            (function() {
                                const bodyText = document.body.innerText;
                                return bodyText.includes('验证码') || 
                                       bodyText.includes('短信验证') || 
                                       bodyText.includes('确认本人操作');
                            })()
                        `);

                        if (!stillNeed) {
                            console.log(`[${accountId}] Verification completed`);
                            win.hide();
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 2000);
                });

                await randomDelay(2000, 3000);
            }

            // ===== 8. 等待发布结果 =====
            let published = false;
            const maxWait = 5000;
            const startTime = Date.now();
            while (Date.now() - startTime < maxWait) {
                const currentUrl = win.webContents.getURL();
                if (currentUrl.includes('success')) {
                    published = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            return {
                accountId,
                success: published,
                message: published ? '发布成功，视频进入审核' : '发布状态未知，请检查创作者中心',
            };

        } catch (error: any) {
            return { accountId, success: false, message: `发布异常: ${error.message}` };
        }
    }

    async waitForUploadComplete(win: BrowserWindow): Promise<void> {
        const maxWaitTime = 5 * 60 * 1000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const isComplete = await win.webContents.executeJavaScript(`
                (function() {
                    const hasReupload = Array.from(document.querySelectorAll('button, span, div')).some(
                        el => el.innerText.trim() === '重新上传' || el.innerText.trim() === '重新选择'
                    );
                    return hasReupload;
                })()
            `);

            if (isComplete) break;
            await randomDelay(3000, 5000);
        }
    }
}