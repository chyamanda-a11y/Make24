/**
 * 微信平台隐私授权封装。业务代码不要直接调用 wx.onNeedPrivacyAuthorization。
 * 文档：基础库 ≥ 2.32.3，见 wx.onNeedPrivacyAuthorization（小游戏）
 * https://developers.weixin.qq.com/minigame/dev/api/open-api/privacy/wx.onNeedPrivacyAuthorization.html
 *
 * 须在微信公众平台填写「用户隐私保护指引」，且与实际调用的隐私接口一致。
 * resolve({ event: 'agree' | 'disagree' }) 须在用户点击操作后调用（不可用定时器自动同意）。
 */

type PrivacyResolveEvent = 'exposureAuthorization' | 'agree' | 'disagree';

type WxPrivacyResolve = (result: { event: PrivacyResolveEvent }) => void;

interface WxPrivacyApis {
    onNeedPrivacyAuthorization?: (
        listener: (resolve: WxPrivacyResolve, eventInfo: { referrer: string }) => void,
    ) => void;
    showModal?: (options: {
        title: string;
        content: string;
        confirmText?: string;
        cancelText?: string;
        success?: (res: { confirm: boolean; cancel: boolean }) => void;
        fail?: () => void;
    }) => void;
}

declare const wx: WxPrivacyApis | undefined;

export class WechatPrivacyService {
    private static listenerRegistered = false;

    /**
     * 在任意隐私敏感 API 调用之前注册（建议游戏启动尽早调用一次）。
     * 非微信环境或未实现 API 时无操作。
     * 注册后走自定义弹窗模式，必须在用户点击后调用 resolve。
     */
    public static registerCustomPrivacyIfWechat(): void {
        if (WechatPrivacyService.listenerRegistered) {
            return;
        }

        if (typeof wx === 'undefined' || typeof wx.onNeedPrivacyAuthorization !== 'function') {
            return;
        }

        WechatPrivacyService.listenerRegistered = true;

        wx.onNeedPrivacyAuthorization((resolve, eventInfo) => {
            if (eventInfo?.referrer) {
                console.info(`[WechatPrivacy] need authorization, referrer: ${eventInfo.referrer}`);
            }

            if (typeof wx.showModal !== 'function') {
                resolve({ event: 'disagree' });
                return;
            }

            wx.showModal({
                title: '隐私保护提示',
                content: '为继续游戏，请先阅读并同意《用户隐私保护指引》中的说明。',
                confirmText: '同意',
                cancelText: '拒绝',
                success: (res) => {
                    resolve({ event: res.confirm ? 'agree' : 'disagree' });
                },
                fail: () => {
                    resolve({ event: 'disagree' });
                },
            });
        });
    }
}
