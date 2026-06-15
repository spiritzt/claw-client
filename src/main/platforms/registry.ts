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
import { ShipinhaoLoginHandler } from './shipinhao/login-handler';
import { ShipinhaoPublishHandler } from './shipinhao/publish-handler';
import { ShipinhaoHeartbeatChecker } from './shipinhao/heartbeat-handler';

const loginHandlers: Record<string, ILoginHandler> = {
    douyin: new DouyinLoginHandler(),
    kuaishou: new KuaishouLoginHandler(),
    xiaohongshu: new XiaohongshuLoginHandler(),
    shipinhao: new ShipinhaoLoginHandler()
};

const publishHandlers: Record<string, IPublishHandler> = {
    douyin: new DouyinPublishHandler(),
    kuaishou: new KuaishouPublishHandler(),
    xiaohongshu: new XiaohongshuPublishHandler(),
    shipinhao: new ShipinhaoPublishHandler()
};

const heartbeatCheckers: Record<string, IHeartbeatChecker> = {
    douyin: new DouyinHeartbeatChecker(),
    kuaishou: new KuaishouHeartbeatChecker(),
    xiaohongshu: new XiaohongshuHeartbeatChecker(),
    shipinhao: new ShipinhaoHeartbeatChecker()
};

const partitionPrefixes: Record<PlatformType, string> = {
    douyin: 'dy',
    kuaishou: 'ks',
    xiaohongshu: 'xhs',
    shipinhao: 'sph'
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