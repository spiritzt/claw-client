import { BrowserWindow } from 'electron';
import { IPublishHandler, PublishTask, PublishResult, PlatformType } from '../interfaces';

function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

const SELECTORS = {
    // 快手的选择器，需要实际探测后更新
    videoFileInput: 'input[type="file"][accept*="video"]',
    coverFileInput: 'input[type="file"][accept*="image"]',
    descriptionEditor: 'div#work-description-edit[contenteditable="true"]',
};

export class KuaishouPublishHandler implements IPublishHandler {
    platform: PlatformType = 'kuaishou';
    publishUrl = 'https://cp.kuaishou.com/article/publish/video';

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

            // ===== 5. 填写作品描述（包含 tag）=====
            await randomDelay(1000, 2000);
            const desc = description || '';
            const titleText = title || '';
            const tagText = (tags && tags.length > 0) ? tags.map(t => '#' + t).join(' ') : '';
            const fullDesc = [titleText, desc, tagText].filter(Boolean).join(' ');

            if (fullDesc) {
                console.log(`[${accountId}] Filling description: ${fullDesc}`);
                await win.webContents.executeJavaScript(`
                    (function() {
                        const editor = document.querySelector('div#work-description-edit[contenteditable="true"]');
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

            // ===== 7. 点击发布 =====
            await randomDelay(2000, 4000);
            console.log(`[${accountId}] Clicking publish button`);
            const clickResult = await win.webContents.executeJavaScript(`
                (function() {
                    // 快手发布按钮是 div，不是 button
                    const buttons = document.querySelectorAll('div[class*="_button-primary"]');
                    for (const btn of buttons) {
                        if (btn.innerText.trim() === '发布') {
                            btn.click();
                            return { clicked: 'publish', text: '发布' };
                        }
                    }
                    return { clicked: null, text: '' };
                })()
            `);

            // ===== 7.5 检测短信验证码 =====
            await randomDelay(2000, 3000);
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
            await randomDelay(5000, 8000);
            const pageText = await win.webContents.executeJavaScript(`
                document.body.innerText.substring(0, 1000)
            `);

            const published = pageText.includes('内容发布成功') || pageText.includes('审核中') || pageText.includes('已提交') || pageText.includes('创作首页');

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