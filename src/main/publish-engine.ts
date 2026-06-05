import { BrowserWindow } from 'electron';
import { AccountManager } from './account-manager';

interface PublishTask {
    accountId: string;
    videoUrl: string;
    title: string;
    description?: string;
    tags?: string[];
    coverUrl?: string;
}

interface PublishResult {
    accountId: string;
    success: boolean;
    message: string;
}

function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

// 选择器配置（创作者中心改版时只需改这里）
const SELECTORS = {
    titleInput: 'input[placeholder*="填写作品标题"]',
    videoFileInput: 'input[type="file"][accept*="video"]',
    coverFileInput: 'input[type="file"][accept*="image"]',
    descriptionEditor: 'div[contenteditable="true"][class*="editor-comp-publish"]',
    uploadArea: 'div[class*="upload-btn"]',
};

export class PublishEngine {
    private accountManager: AccountManager;

    constructor(accountManager: AccountManager) {
        this.accountManager = accountManager;
    }

    /**
     * 单账号发布视频
     */
    async publishVideo(task: PublishTask): Promise<PublishResult> {
        const { accountId, videoUrl, title, description, tags, coverUrl } = task;
        const win = this.accountManager.createHiddenWindow(accountId);

        if (!win) {
            return { accountId, success: false, message: '账号不存在或未登录' };
        }

        try {
            // ===== 1. 打开发布页 =====
            await win.loadURL('https://creator.douyin.com/creator-micro/content/publish');
            await randomDelay(3000, 5000);

            // 检查是否被重定向到登录页
            const currentUrl = win.webContents.getURL();
            if (currentUrl.includes('login')) {
                return { accountId, success: false, message: '登录已过期，请重新扫码登录' };
            }

            // ===== 2. 上传视频 =====
            console.log(`[${accountId}] 开始上传视频: ${videoUrl}`);
            const uploadResult = await win.webContents.executeJavaScript(`
        (async function() {
          try {
            // 下载视频
            const response = await fetch(${JSON.stringify(videoUrl)});
            if (!response.ok) return { success: false, message: '视频下载失败: ' + response.status };
            const blob = await response.blob();
            const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
 
            // 找到视频上传 input
            const fileInput = document.querySelector(${JSON.stringify(SELECTORS.videoFileInput)});
            if (!fileInput) return { success: false, message: '未找到视频上传控件' };
 
            // 注入文件
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
            console.log(`[${accountId}] 等待视频上传完成...`);
            await this.waitForUploadComplete(win);
            console.log(`[${accountId}] 视频上传完成`);

            // ===== 4. 填写标题 =====
            await randomDelay(1000, 2000);
            console.log(`[${accountId}] 填写标题: ${title}`);
            await win.webContents.executeJavaScript(`
        (function() {
          const titleInput = document.querySelector(${JSON.stringify(SELECTORS.titleInput)});
          if (titleInput) {
            // semi-input 需要模拟原生事件才能触发 React 状态更新
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

            // ===== 5. 填写作品描述（标签写在描述里） =====
            await randomDelay(1000, 2000);
            const desc = description || '';
            const tagText = (tags && tags.length > 0) ? tags.map(t => '#' + t).join(' ') : '';
            const fullDesc = [desc, tagText].filter(Boolean).join(' ');

            if (fullDesc) {
                console.log(`[${accountId}] 填写描述: ${fullDesc}`);
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
                console.log(`[${accountId}] 上传封面: ${coverUrl}`);
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
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            const text = btn.innerText.trim();
            if (text === '发布') {
                btn.click();
                return { clicked: 'publish', text: text };
            }
        }
        return { clicked: null, text: '' };
    })()
`);

            if (!clickResult.clicked) {
                return { accountId, success: false, message: '未找到发布按钮' };
            }

            // ===== 8. 等待发布结果 =====
            await randomDelay(5000, 8000);
            const pageText = await win.webContents.executeJavaScript(`
        document.body.innerText.substring(0, 1000)
      `);

            const published = pageText.includes('发布成功') || pageText.includes('审核中') || pageText.includes('已提交');

            return {
                accountId,
                success: published,
                message: published ? '发布成功，视频进入审核' : '发布状态未知，请检查创作者中心',
            };

        } catch (error: any) {
            return { accountId, success: false, message: `发布异常: ${error.message}` };
        } finally {
            if (!win.isDestroyed()) {
                win.close();
            }
        }
    }

    /**
     * 批量发布（逐个执行，避免风控）
     */
    async batchPublish(tasks: PublishTask[]): Promise<PublishResult[]> {
        const results: PublishResult[] = [];

        for (let i = 0; i < tasks.length; i++) {
            console.log(`批量发布进度: ${i + 1}/${tasks.length}`);
            const result = await this.publishVideo(tasks[i]);
            results.push(result);

            // 账号间随机间隔 30-60 秒
            if (i < tasks.length - 1) {
                const delay = Math.floor(Math.random() * 30000) + 30000;
                console.log(`等待 ${Math.round(delay / 1000)} 秒后发布下一个...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return results;
    }

    /**
     * 等待视频上传完成
     */
    private async waitForUploadComplete(win: BrowserWindow): Promise<void> {
        const maxWaitTime = 5 * 60 * 1000; // 最长等5分钟
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const isUploading = await win.webContents.executeJavaScript(`
        (function() {
          // 检查上传进度相关元素
          const progress = document.querySelector('[class*="progress"]');
          const uploading = document.querySelector('[class*="uploading"]');
          const uploadingText = document.body.innerText.includes('上传中');
          const processingText = document.body.innerText.includes('处理中');
          return !!(progress || uploading || uploadingText || processingText);
        })()
      `);

            if (!isUploading) break;
            await randomDelay(3000, 5000);
        }
    }
}