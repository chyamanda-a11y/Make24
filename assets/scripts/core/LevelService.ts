import { JsonAsset, resources } from 'cc';

import { LevelModel } from '../model/game/LevelModel';

export interface ChapterLevelConfig {
    readonly chapterId: number;
    readonly chapterName: string;
    readonly levels: readonly LevelModel[];
}

export class LevelService {
    public async loadChapterConfig(chapterFileName: string): Promise<ChapterLevelConfig> {
        return new Promise<ChapterLevelConfig>((resolve, reject) => {
            resources.load(`config/levels/${chapterFileName}`, JsonAsset, (error, asset) => {
                if (error) {
                    reject(new Error(`LevelService.loadChapterConfig failed: ${error.message}`));
                    return;
                }

                if (!asset) {
                    reject(new Error('LevelService.loadChapterConfig failed: json asset is missing'));
                    return;
                }

                resolve(asset.json as ChapterLevelConfig);
            });
        });
    }
}
