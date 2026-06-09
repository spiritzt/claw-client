import { BrowserWindow } from 'electron';
import { AccountManager } from './account-manager';
import { PublishTask, PublishResult } from './platforms/interfaces';
import { getPublishHandler } from './platforms/registry';

function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

export class PublishEngine {
    private accountManager: AccountManager;

    constructor(accountManager: AccountManager) {
        this.accountManager = accountManager;
    }

    async publishVideo(task: PublishTask): Promise<PublishResult> {
        const account = this.accountManager.getAccount(task.accountId);
        if (!account) {
            return { accountId: task.accountId, success: false, message: '账号不存在或未登录' };
        }

        const publishHandler = getPublishHandler(account.platform);
        if (!publishHandler) {
            return { accountId: task.accountId, success: false, message: `不支持的平台: ${account.platform}` };
        }

        const win = this.accountManager.createHiddenWindow(task.accountId);
        if (!win) {
            return { accountId: task.accountId, success: false, message: '账号不存在或未登录' };
        }

        try {
            return await publishHandler.publishVideo(task.accountId, win, task);
        } finally {
            if (!win.isDestroyed()) {
                win.close();
            }
        }
    }

    async batchPublish(tasks: PublishTask[]): Promise<PublishResult[]> {
        const results: PublishResult[] = [];

        for (let i = 0; i < tasks.length; i++) {
            console.log(`Batch progress: ${i + 1}/${tasks.length}`);
            const result = await this.publishVideo(tasks[i]);
            results.push(result);

            if (i < tasks.length - 1) {
                const delay = Math.floor(Math.random() * 30000) + 30000;
                console.log(`Waiting ${Math.round(delay / 1000)}s before next...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return results;
    }
}