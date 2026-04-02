/**
 * 微信小游戏分享/转发封装。业务层不要直接调用 wx.showShareMenu / wx.onShareAppMessage / wx.shareAppMessage。
 * 文档：
 * - https://developers.weixin.qq.com/minigame/dev/api/share/wx.showShareMenu.html
 * - https://developers.weixin.qq.com/minigame/dev/api/share/wx.onShareAppMessage.html
 * - https://developers.weixin.qq.com/minigame/dev/api/share/wx.shareAppMessage.html
 */

export interface WechatShareContent {
    readonly title?: string;
    readonly imageUrl?: string;
    readonly imageUrlId?: string;
    readonly query?: string;
}

type ShareContentProvider = () => WechatShareContent | null;

interface WxShareResult {
    readonly errMsg?: string;
}

interface WxShowShareMenuOptions {
    readonly menus?: readonly string[];
    readonly withShareTicket?: boolean;
    readonly success?: (result: WxShareResult) => void;
    readonly fail?: (error: WxShareResult) => void;
}

interface WxShareApis {
    showShareMenu?: (options?: WxShowShareMenuOptions) => void;
    onShareAppMessage?: (listener: () => WechatShareContent) => void;
    shareAppMessage?: (options: WechatShareContent & {
        success?: (result: WxShareResult) => void;
        fail?: (error: WxShareResult) => void;
        complete?: () => void;
    }) => void;
}

declare const wx: WxShareApis | undefined;

const DEFAULT_SHARE_TITLE = '来试试这款 24 点小游戏，看看你能闯到第几关！';
const SHARE_MENUS = ['shareAppMessage'] as const;

export class WechatShareService {
    private static hasRegisteredShareHandler = false;
    private static shareContentProvider: ShareContentProvider | null = null;

    public static setShareContentProvider(provider: ShareContentProvider | null): void {
        WechatShareService.shareContentProvider = provider;
    }

    public static registerShareMenuIfWechat(): void {
        if (typeof wx === 'undefined') {
            return;
        }

        WechatShareService.ensureShareHandlerRegistered();

        if (typeof wx.showShareMenu !== 'function') {
            return;
        }

        wx.showShareMenu({
            menus: SHARE_MENUS,
            withShareTicket: false,
            fail: (error) => {
                console.warn('[WechatShare] showShareMenu failed', error);
            },
        });
    }

    public static shareAppMessage(content?: WechatShareContent | null): boolean {
        if (typeof wx === 'undefined' || typeof wx.shareAppMessage !== 'function') {
            return false;
        }

        wx.shareAppMessage(WechatShareService.buildShareContent(content));
        return true;
    }

    private static ensureShareHandlerRegistered(): void {
        if (WechatShareService.hasRegisteredShareHandler) {
            return;
        }

        if (typeof wx === 'undefined' || typeof wx.onShareAppMessage !== 'function') {
            return;
        }

        wx.onShareAppMessage(() => WechatShareService.buildShareContent());
        WechatShareService.hasRegisteredShareHandler = true;
    }

    private static buildShareContent(overrideContent?: WechatShareContent | null): WechatShareContent {
        const providerContent = WechatShareService.shareContentProvider?.() ?? null;
        const mergedContent = {
            ...WechatShareService.sanitizeContent(providerContent),
            ...WechatShareService.sanitizeContent(overrideContent),
        };

        return {
            title: mergedContent.title ?? DEFAULT_SHARE_TITLE,
            ...(mergedContent.query ? { query: mergedContent.query } : {}),
            ...(mergedContent.imageUrl ? { imageUrl: mergedContent.imageUrl } : {}),
            ...(mergedContent.imageUrlId ? { imageUrlId: mergedContent.imageUrlId } : {}),
        };
    }

    private static sanitizeContent(content: WechatShareContent | null | undefined): WechatShareContent {
        if (!content) {
            return {};
        }

        const title = WechatShareService.normalizeString(content.title);
        const query = WechatShareService.normalizeString(content.query);
        const imageUrl = WechatShareService.normalizeString(content.imageUrl);
        const imageUrlId = WechatShareService.normalizeString(content.imageUrlId);

        return {
            ...(title ? { title } : {}),
            ...(query ? { query } : {}),
            ...(imageUrl ? { imageUrl } : {}),
            ...(imageUrlId ? { imageUrlId } : {}),
        };
    }

    private static normalizeString(value: string | undefined): string | null {
        if (typeof value !== 'string') {
            return null;
        }

        const trimmedValue = value.trim();
        return trimmedValue.length > 0 ? trimmedValue : null;
    }
}
