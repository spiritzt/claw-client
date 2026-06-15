import { BrowserWindow } from 'electron';
import { IPublishHandler, PublishTask, PublishResult, PlatformType } from '../interfaces';

function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

// 微信用 wujie 微前端，所有元素在 Shadow DOM 里
const SHADOW_SELECTOR = `document.querySelector('wujie-app')?.shadowRoot`;

export class ShipinhaoPublishHandler implements IPublishHandler {
    platform: PlatformType = 'shipinhao';
    publishUrl = 'https://channels.weixin.qq.com/platform/post/create';

    async publishVideo(accountId: string, win: BrowserWindow, task: PublishTask): Promise<PublishResult> {
        const { videoUrl, title, description, tags } = task;

        try {
            // ===== 1. 打开发布页 =====
            await win.loadURL(this.publishUrl);
            await randomDelay(6000, 7000);

            const currentUrl = win.webContents.getURL();
            if (currentUrl.includes('login')) {
                return { accountId, success: false, message: '登录已过期，请重新扫码登录' };
            }

            // ===== 2. 上传视频 =====
            console.log(`[${accountId}] Start uploading video: ${videoUrl}`);
            const uploadResult = await win.webContents.executeJavaScript(`
                (async function() {
                    try {
                        const shadow = ${SHADOW_SELECTOR};
                        if (!shadow) return { success: false, message: 'Shadow DOM 未就绪' };
 
                        const response = await fetch(${JSON.stringify(videoUrl)});
                        if (!response.ok) return { success: false, message: '视频下载失败: ' + response.status };
                        const blob = await response.blob();
                        const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
 
                        const fileInput = shadow.querySelector('input[type="file"][accept*="video"]');
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

            function cleanTitle(title: string): string {
                // 去掉所有标点符号，用空格替代
                return title.replace(/[^\w\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
            }

            // ===== 4. 填写短标题 =====
            await randomDelay(1000, 2000);
            if (title) {
                const shortTitle = cleanTitle(title);
                console.log(`[${accountId}] Filling short title: ${shortTitle}`);
                await win.webContents.executeJavaScript(`
                    (async function() {
                        const shadow = ${SHADOW_SELECTOR};
                        const titleInput = shadow?.querySelector('input[placeholder*="填写短标题有机会获得更多流量"]');
                        if (!titleInput) return false;
                        titleInput.click();
                        titleInput.focus();
                        await new Promise(r => setTimeout(r, 300));
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        nativeSetter.call(titleInput, ${JSON.stringify(shortTitle)});
                        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    })()
                `);
            }

            // ===== 5. 填写作品描述（标题 + 话题） =====
            await randomDelay(1000, 2000);
            const tagText = (tags && tags.length > 0) ? tags.map(t => '#' + t).join(' ') : '';
            const fullDesc = [title || '', tagText].filter(Boolean).join(' ');

            if (fullDesc) {
                console.log(`[${accountId}] Filling description: ${fullDesc}`);
                await win.webContents.executeJavaScript(`
                    (async function() {
                        const shadow = ${SHADOW_SELECTOR};
                        const editor = shadow?.querySelector('.post-desc-box .input-editor');
                        if (!editor) return false;
                        editor.click();
                        editor.focus();
                        await new Promise(r => setTimeout(r, 500));
                        document.execCommand('selectAll', false, null);
                        document.execCommand('insertText', false, ${JSON.stringify(fullDesc)});
                        return true;
                    })()
                `);
            }

            // ===== 6. 点击发表 =====
            await randomDelay(2000, 4000);
            console.log(`[${accountId}] Clicking publish button`);
            const clickResult = await win.webContents.executeJavaScript(`
                (function() {
                    const shadow = document.querySelector('wujie-app')?.shadowRoot;
                    if (!shadow) return { clicked: null, text: 'shadow not found' };
                    const buttons = shadow.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.innerText.trim() === '发表') {
                            if (btn.classList.contains('weui-desktop-btn_disabled')) {
                                return { clicked: null, text: 'disabled' };
                            }
                            btn.click();
                            return { clicked: 'publish', text: '发表' };
                        }
                    }
                    return { clicked: null, text: 'not found' };
                })()
            `);

            // ===== 7. 等待发布结果 =====
            await randomDelay(5000, 8000);
            const pageText = await win.webContents.executeJavaScript(`
                (function() {
                    const shadow = ${SHADOW_SELECTOR};
                    return (shadow?.body?.innerText || document.body.innerText).substring(0, 1000);
                })()
            `);

            const published = pageText.includes('已发表') || pageText.includes('发表成功') || pageText.includes('审核中') || pageText.includes('已提交');

            return {
                accountId,
                success: published,
                message: published ? '发布成功，视频进入审核' : '发布状态未知，请检查视频号管理平台',
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
                    const shadow = document.querySelector('wujie-app')?.shadowRoot;
                    if (!shadow) return false;
                    const hasDelete = Array.from(shadow.querySelectorAll('div, button, span')).some(
                        el => el.innerText.trim() === '删除'
                    );
                    return hasDelete;
                })()
            `);

            if (isComplete) break;
            await randomDelay(3000, 5000);
        }
    }
}