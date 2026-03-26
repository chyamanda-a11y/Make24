import { JsonAsset, resources } from 'cc';

import { LevelModel } from '../model/game/LevelModel';

export interface ChapterLevelConfig {
    readonly chapterId: number;
    readonly chapterName: string;
    readonly levels: readonly LevelModel[];
}

export class LevelService {
    private static readonly configCache: Map<string, ChapterLevelConfig> = new Map();
    private static readonly configTasks: Map<string, Promise<ChapterLevelConfig>> = new Map();

    public async loadChapterConfig(chapterFileName: string): Promise<ChapterLevelConfig> {
        const cachedConfig = LevelService.configCache.get(chapterFileName);

        if (cachedConfig) {
            return cachedConfig;
        }

        const loadingTask = LevelService.configTasks.get(chapterFileName);

        if (loadingTask) {
            return loadingTask;
        }

        const task = new Promise<ChapterLevelConfig>((resolve, reject) => {
            resources.load(`config/levels/${chapterFileName}`, JsonAsset, (error, asset) => {
                if (error) {
                    reject(new Error(`LevelService.loadChapterConfig failed: ${error.message}`));
                    return;
                }

                if (!asset) {
                    reject(new Error('LevelService.loadChapterConfig failed: json asset is missing'));
                    return;
                }

                const config = asset.json as ChapterLevelConfig;

                LevelService.configCache.set(chapterFileName, config);
                resolve(config);
            });
        });

        LevelService.configTasks.set(chapterFileName, task);

        try {
            return await task;
        } finally {
            LevelService.configTasks.delete(chapterFileName);
        }
    }
}
