/**
 * 微信小游戏版本更新管理封装。业务层不要直接调用 wx.getUpdateManager。
 * 文档：https://developers.weixin.qq.com/minigame/dev/api/base/update/wx.getUpdateManager.html
 */
interface WxApplyUpdateInfo {
    readonly errMsg?: string;
}

interface WxUpdateReadyInfo {
    readonly errMsg?: string;
}

interface WxUpdateFailedInfo {
    readonly errMsg?: string;
}

interface WxCheckForUpdateInfo {
    readonly hasUpdate: boolean;
    readonly errMsg?: string;
}

interface WxModalResult {
    readonly confirm: boolean;
    readonly cancel: boolean;
}

interface WxUpdateManager {
    onCheckForUpdate?: (listener: (result: WxCheckForUpdateInfo) => void) => void;
    onUpdateReady?: (listener: (result: WxUpdateReadyInfo) => void) => void;
    onUpdateFailed?: (listener: (result: WxUpdateFailedInfo) => void) => void;
    applyUpdate?: (options?: { success?: (result: WxApplyUpdateInfo) => void; fail?: (error: WxApplyUpdateInfo) => void }) => void;
}

interface WxUpdateApis {
    getUpdateManager?: () => WxUpdateManager;
    showModal?: (options: {
        title: string;
        content: string;
        showCancel?: boolean;
        confirmText?: string;
        cancelText?: string;
        success?: (result: WxModalResult) => void;
        fail?: (error: { errMsg?: string }) => void;
    }) => void;
}

declare const wx: WxUpdateApis | undefined;

export class WechatUpdateService {
    private static hasRegistered = false;

    public static registerUpdateManagerIfWechat(): void {
        if (WechatUpdateService.hasRegistered) {
            return;
        }

        if (typeof wx === 'undefined' || typeof wx.getUpdateManager !== 'function') {
            return;
        }

        const updateManager = wx.getUpdateManager();
        WechatUpdateService.hasRegistered = true;

        updateManager.onCheckForUpdate?.((result) => {
            if (result.hasUpdate) {
                console.info('[WechatUpdate] found a new version');
            }
        });

        updateManager.onUpdateReady?.(() => {
            if (typeof wx.showModal !== 'function') {
                WechatUpdateService.applyUpdate(updateManager);
                return;
            }

            wx.showModal({
                title: '更新提示',
                content: '新版本已准备好，点击“重启”立即更新。',
                showCancel: false,
                confirmText: '重启',
                success: (result) => {
                    if (!result.confirm) {
                        return;
                    }
                    WechatUpdateService.applyUpdate(updateManager);
                },
                fail: () => {
                    WechatUpdateService.applyUpdate(updateManager);
                },
            });
        });

        updateManager.onUpdateFailed?.((error) => {
            console.warn('[WechatUpdate] update download failed', error);
            if (typeof wx.showModal !== 'function') {
                return;
            }

            wx.showModal({
                title: '更新失败',
                content: '新版本下载失败，请稍后重新启动小游戏重试。',
                showCancel: false,
                confirmText: '我知道了',
            });
        });
    }

    private static applyUpdate(updateManager: WxUpdateManager): void {
        if (typeof updateManager.applyUpdate !== 'function') {
            return;
        }

        updateManager.applyUpdate({
            fail: (error) => {
                console.warn('[WechatUpdate] applyUpdate failed', error);
            },
        });
    }
}
