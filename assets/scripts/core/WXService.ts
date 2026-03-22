declare const wx:
    | {
          getSystemInfoSync?: () => unknown;
      }
    | undefined;

export class WXService {
    public isWechat(): boolean {
        return typeof wx !== 'undefined';
    }

    public getSystemInfo(): unknown | null {
        if (!this.isWechat() || !wx?.getSystemInfoSync) {
            return null;
        }

        return wx.getSystemInfoSync();
    }
}
