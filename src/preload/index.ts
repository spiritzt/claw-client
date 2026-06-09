import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('clawClient', {
    account: {
        init: (accountId: string, typeName: string, nickName: string, platform: string = 'douyin') => ipcRenderer.invoke('account:init', accountId, typeName, nickName, platform),
        list: () => ipcRenderer.invoke('account:list'),
        remove: (accountId: string) => ipcRenderer.invoke('account:remove', accountId),
        checkLogin: (accountId: string) => ipcRenderer.invoke('account:checkLogin', accountId),
        checkAll: () => ipcRenderer.invoke('account:checkAll'),
        reLogin: (accountId: string, typeName: string, nickName: string) => ipcRenderer.invoke('account:reLogin', accountId, typeName, nickName),
        reload: () => ipcRenderer.invoke('account:reload'),
    },

    publish: {
        video: (params: any) => ipcRenderer.invoke('publish:video', params),
        batch: (tasks: any[]) => ipcRenderer.invoke('publish:batch', tasks),
    },

    debug: {
        openCreator: (accountId?: string) => ipcRenderer.invoke('debug:openCreator', accountId),
    },

    isElectron: true,
});