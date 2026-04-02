import { Asset, assetManager, AssetManager, resources } from 'cc';

export type BundleName = 'resources' | 'chapter' | 'game' | 'levels';

export interface BundleAssetLocation {
    readonly bundleName: BundleName;
    readonly assetPath: string;
}

interface AssetType<T extends Asset> {
    new (...args: never[]): T;
}

export class BundleService {
    private static readonly bundleCache: Map<BundleName, AssetManager.Bundle> = new Map();
    private static readonly bundleTasks: Map<BundleName, Promise<AssetManager.Bundle>> = new Map();
    private static readonly assetTasks: Map<string, Promise<Asset>> = new Map();

    public static async loadBundle(bundleName: BundleName): Promise<AssetManager.Bundle> {
        if (bundleName === 'resources') {
            return resources as AssetManager.Bundle;
        }

        const cachedBundle = this.bundleCache.get(bundleName) ?? assetManager.getBundle(bundleName);

        if (cachedBundle) {
            this.bundleCache.set(bundleName, cachedBundle);
            return cachedBundle;
        }

        const loadingTask = this.bundleTasks.get(bundleName);

        if (loadingTask) {
            return loadingTask;
        }

        const task = new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle(bundleName, (error, bundle) => {
                if (error) {
                    reject(new Error(`BundleService.loadBundle failed for ${bundleName}: ${error.message}`));
                    return;
                }

                if (!bundle) {
                    reject(new Error(`BundleService.loadBundle failed for ${bundleName}: bundle is missing`));
                    return;
                }

                this.bundleCache.set(bundleName, bundle);
                resolve(bundle);
            });
        });

        this.bundleTasks.set(bundleName, task);

        try {
            return await task;
        } finally {
            this.bundleTasks.delete(bundleName);
        }
    }

    public static async loadAsset<T extends Asset>(location: BundleAssetLocation, assetType: AssetType<T>): Promise<T> {
        const taskKey = `${location.bundleName}:${location.assetPath}:${assetType.name}`;
        const loadingTask = this.assetTasks.get(taskKey) as Promise<T> | undefined;

        if (loadingTask) {
            return loadingTask;
        }

        const task = this.loadAssetInternal(location, assetType);

        this.assetTasks.set(taskKey, task as Promise<Asset>);

        try {
            return await task;
        } finally {
            this.assetTasks.delete(taskKey);
        }
    }

    private static async loadAssetInternal<T extends Asset>(
        location: BundleAssetLocation,
        assetType: AssetType<T>,
    ): Promise<T> {
        const bundle = await this.loadBundle(location.bundleName);

        return await new Promise<T>((resolve, reject) => {
            bundle.load(location.assetPath, assetType, (error, asset) => {
                if (error) {
                    reject(
                        new Error(
                            `BundleService.loadAsset failed for ${location.bundleName}/${location.assetPath}: ${error.message}`,
                        ),
                    );
                    return;
                }

                if (!asset) {
                    reject(
                        new Error(
                            `BundleService.loadAsset failed for ${location.bundleName}/${location.assetPath}: asset is missing`,
                        ),
                    );
                    return;
                }

                resolve(asset);
            });
        });
    }
}
