import { PlatformType, ILoginHandler, IPublishHandler, IHeartbeatChecker } from './interfaces';
import { DouyinLoginHandler } from './douyin/login-handler';
import { DouyinPublishHandler } from './douyin/publish-handler';
import { DouyinHeartbeatChecker } from './douyin/heartbeat-handler';
import { KuaishouLoginHandler } from './kuaishou/login-handler';
import { KuaishouPublishHandler } from './kuaishou/publish-handler';
import { KuaishouHeartbeatChecker } from './kuaishou/heartbeat-handler';
import { XiaohongshuLoginHandler } from './xiaohongshu/login-handler';
import { XiaohongshuPublishHandler } from './xiaohongshu/publish-handler';
import { XiaohongshuHeartbeatChecker } from './xiaohongshu/heartbeat-handler';

const loginHandlers: Record<string, ILoginHandler> = {
    douyin: new DouyinLoginHandler(),
    kuaishou: new KuaishouLoginHandler(),
    xiaohongshu: new XiaohongshuLoginHandler()
};

const publishHandlers: Record<string, IPublishHandler> = {
    douyin: new DouyinPublishHandler(),
    kuaishou: new KuaishouPublishHandler(),
    xiaohongshu: new XiaohongshuPublishHandler()
};

const heartbeatCheckers: Record<string, IHeartbeatChecker> = {
    douyin: new DouyinHeartbeatChecker(),
    kuaishou: new KuaishouHeartbeatChecker(),
    xiaohongshu: new XiaohongshuHeartbeatChecker()
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