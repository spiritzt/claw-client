import { PlatformType, ILoginHandler, IPublishHandler, IHeartbeatChecker } from './interfaces';
import { DouyinLoginHandler } from './douyin/login-handler';
import { DouyinPublishHandler } from './douyin/publish-handler';
import { DouyinHeartbeatChecker } from './douyin/heartbeat-handler';

const loginHandlers: Record<string, ILoginHandler> = {
    douyin: new DouyinLoginHandler(),
};

const publishHandlers: Record<string, IPublishHandler> = {
    douyin: new DouyinPublishHandler(),
};

const heartbeatCheckers: Record<string, IHeartbeatChecker> = {
    douyin: new DouyinHeartbeatChecker(),
};

const partitionPrefixes: Record<PlatformType, string> = {
    douyin: 'dy',
    kuaishou: 'ks',
    xiaohongshu: 'xhs'
};

export function getLoginHandler(platform: PlatformType): ILoginHandler {
    return loginHandlers[platform];
}

export function getPublishHandler(platform: PlatformType): IPublishHandler {
    return publishHandlers[platform];
}

export function getHeartbeatChecker(platform: PlatformType): IHeartbeatChecker {
    return heartbeatCheckers[platform];
}

export function getPartitionPrefix(platform: PlatformType): string {
    return partitionPrefixes[platform];
}