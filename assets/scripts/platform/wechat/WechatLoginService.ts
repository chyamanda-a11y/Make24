import { sys } from 'cc';

/**
 * 微信小游戏登录：`wx.login` 仅返回短期有效的 `code`。
 * OpenID / session_key 必须由服务端使用 `code` 请求 `jscode2session` 换取（appsecret 绝不能写进游戏包）。
 * 文档：https://developers.weixin.qq.com/minigame/dev/api/open-api/login/wx.login.html
 *
 * 单机阶段：可只调 `requestLoginCode` 做流程占位；待有服务端或云函数后，把 code POST 上去，
 * 换回 openid 再调用 `persistOpenIdFromServer`，便于与本地存档逻辑关联（或迁移存档键）。
 */

const OPENID_STORAGE_KEY = 'make24.wechat.openid';

interface WxLoginSuccess {
    readonly code?: string;
    readonly anonymousCode?: string;
    readonly errMsg?: string;
}

interface WxWithLogin {
    login?: (options: {
        timeout?: number;
        success?: (res: WxLoginSuccess) => void;
        fail?: (err: { errMsg: string }) => void;
    }) => void;
}

declare const wx: WxWithLogin | undefined;

export class WechatLoginService {
    private static lastCode: string | null = null;

    /**
     * 非微信环境返回 null。成功返回 `code`，供发往自有服务端或云开发换取 openid。
     */
    public static async requestLoginCode(): Promise<string | null> {
        if (typeof wx === 'undefined' || typeof wx.login !== 'function') {
            return null;
        }

        return new Promise((resolve) => {
            wx.login!({
                timeout: 10000,
                success: (res) => {
                    const code = typeof res.code === 'string' && res.code.length > 0 ? res.code : null;
                    WechatLoginService.lastCode = code;
                    if (!code) {
                        console.warn('[WechatLogin] wx.login ok but missing code', res);
                    }
                    resolve(code);
                },
                fail: (err) => {
                    console.warn('[WechatLogin] wx.login failed', err);
                    WechatLoginService.lastCode = null;
                    resolve(null);
                },
            });
        });
    }

    /**
     * 最近一次 `requestLoginCode` 的结果（仅内存，且 code 很快过期，不要作为长期依据）。
     */
    public static peekLastCode(): string | null {
        return WechatLoginService.lastCode;
    }

    /**
     * 服务端用 code 换票成功后写入的 openid，用于与进度绑定或后续云端同步。
     */
    public static getPersistedOpenId(): string | null {
        const raw = sys.localStorage.getItem(OPENID_STORAGE_KEY);
        return raw !== null && raw.length > 0 ? raw : null;
    }

    /**
     * 仅在拿到服务端返回的合法 openid 后调用；勿在客户端伪造。
     */
    public static persistOpenIdFromServer(openId: string): void {
        const trimmed = openId.trim();
        if (trimmed.length === 0) {
            return;
        }
        sys.localStorage.setItem(OPENID_STORAGE_KEY, trimmed);
    }

    public static clearPersistedOpenId(): void {
        sys.localStorage.removeItem(OPENID_STORAGE_KEY);
    }
}
