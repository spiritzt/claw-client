import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('clawClient', {
    account: {
        init: (accountId: string, typeName: string, nickName: string) => ipcRenderer.invoke('account:init', accountId, typeName, nickName),
        reLogin: (accountId: string, typeName: string, nickName: string) => ipcRenderer.invoke('account:reLogin', accountId, typeName, nickName),
        list: () => ipcRenderer.invoke('account:list'),
        remove: (accountId: string) => ipcRenderer.invoke('account:remove', accountId),
        checkLogin: (accountId: string) => ipcRenderer.invoke('account:checkLogin', accountId),
        checkAll: () => ipcRenderer.invoke('account:checkAll'),
    },

    publish: {
        video: (params: {
            accountId: string;
            videoUrl: string;
            title: string;
            tags: string[];
        }) => ipcRenderer.invoke('publish:video', params),

        batch: (tasks: Array<{
            accountId: string;
            videoUrl: string;
            title: string;
            tags: string[];
        }>) => ipcRenderer.invoke('publish:batch', tasks),
    },

    // 调试用，后续可删
    debug: {
        openCreator: (accountId?: string) => ipcRenderer.invoke('debug:openCreator', accountId),
    },

    isElectron: true,
});