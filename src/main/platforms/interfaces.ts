import { BrowserWindow } from 'electron';

// ========== 账号信息 ==========
export type PlatformType = 'douyin' | 'kuaishou' | 'xiaohongshu';

export interface AccountInfo {
    id: string;
    name: string;
    plateNumber: string;
    nickname: string;
    typename: string;
    avatar: string;
    partition: string;
    platform: PlatformType;
    loginValid: boolean;
    lastChecked: number;
}

// ========== 发布任务 ==========
export interface PublishTask {
    accountId: string;
    videoUrl: string;
    title: string;
    description?: string;
    tags?: string[];
    coverUrl?: string;
}

export interface PublishResult {
    accountId: string;
    success: boolean;
    message: string;
}

// ========== 登录处理器接口 ==========
export interface ILoginHandler {
    platform: PlatformType;
    loginUrl: string;
    loginSuccessPatterns: string[];
    getUserInfo(win: BrowserWindow): Promise<{ name: string; avatar: string; plateNumber: string }>;
}

// ========== 发布处理器接口 ==========
export interface IPublishHandler {
    platform: PlatformType;
    publishUrl: string;
    publishVideo(accountId: string, win: BrowserWindow, task: PublishTask): Promise<PublishResult>;
    waitForUploadComplete(win: BrowserWindow): Promise<void>;
}

// ========== 心跳检测器接口 ==========
export interface IHeartbeatChecker {
    platform: PlatformType;
    checkUrl: string;
    checkLoginStatus(win: BrowserWindow): Promise<boolean>;
}