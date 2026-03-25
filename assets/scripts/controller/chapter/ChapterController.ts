import { ChapterLevelConfig } from '../../core/LevelService';
import { SaveModel } from '../../model/common/SaveModel';

export type ChapterId = 1 | 2 | 3;
export type ChapterLevelStatus = 'passed' | 'current' | 'locked';

export interface ChapterTabDefinition {
    readonly chapterId: ChapterId;
    readonly title: string;
    readonly iconPath: string;
}

export interface ChapterLevelDisplayModel {
    readonly levelId: number;
    readonly levelIndex: number;
    readonly displayNumber: string;
    readonly status: ChapterLevelStatus;
    readonly isPlayable: boolean;
}

const CHAPTER_TABS: readonly ChapterTabDefinition[] = [
    { chapterId: 1, title: 'Junior', iconPath: 'sprites/levelChoose/tab_icon_1' },
    { chapterId: 2, title: 'Middle', iconPath: 'sprites/levelChoose/tab_icon_2' },
    { chapterId: 3, title: 'Senior', iconPath: 'sprites/levelChoose/tab_icon_3' },
];

export class ChapterController {
    public getChapterTabs(): readonly ChapterTabDefinition[] {
        return CHAPTER_TABS;
    }

    public getMaxChapterId(): ChapterId {
        return CHAPTER_TABS[CHAPTER_TABS.length - 1].chapterId;
    }

    public normalizeChapterId(chapterId: number): ChapterId {
        const safeChapterId = Math.min(Math.max(chapterId, 1), this.getMaxChapterId());

        return safeChapterId as ChapterId;
    }

    public getChapterFileName(chapterId: number): string {
        return `chapter_${this.formatTwoDigits(chapterId)}`;
    }

    public getProgressCount(config: ChapterLevelConfig, save: SaveModel): number {
        const passedLevelIds = new Set(save.passedLevelIds);

        return config.levels.reduce((count, level) => count + (passedLevelIds.has(level.id) ? 1 : 0), 0);
    }

    public isChapterUnlocked(chapterId: number, save: SaveModel): boolean {
        return chapterId <= Math.max(save.unlockedChapterId, 1);
    }

    public resolveCurrentPlayableLevelIndex(config: ChapterLevelConfig, save: SaveModel): number | null {
        const passedLevelIds = new Set(save.passedLevelIds);

        if (!this.isChapterUnlocked(config.chapterId, save)) {
            return null;
        }

        const currentLevelId = this.resolveCurrentLevelId(config, save, passedLevelIds);

        if (currentLevelId === null) {
            return null;
        }

        return this.resolveLevelIndexById(config, currentLevelId);
    }

    public resolveSavedLevelIndex(config: ChapterLevelConfig, save: SaveModel): number | null {
        const savedLevelId = this.resolveSavedCurrentLevelId(config, save);

        if (savedLevelId === null) {
            return null;
        }

        return this.resolveLevelIndexById(config, savedLevelId);
    }

    public buildLevelDisplayModels(config: ChapterLevelConfig, save: SaveModel): readonly ChapterLevelDisplayModel[] {
        const passedLevelIds = new Set(save.passedLevelIds);
        const currentLevelIndex = this.resolveCurrentPlayableLevelIndex(config, save);
        const currentLevelId = currentLevelIndex === null ? null : config.levels[currentLevelIndex]?.id ?? null;

        return config.levels.map((level, levelIndex) => {
            const isPassed = passedLevelIds.has(level.id);
            const isCurrent = !isPassed && currentLevelId === level.id;

            return {
                levelId: level.id,
                levelIndex,
                displayNumber: this.formatTwoDigits(levelIndex + 1),
                status: isPassed ? 'passed' : isCurrent ? 'current' : 'locked',
                isPlayable: isPassed || isCurrent,
            };
        });
    }

    private formatTwoDigits(value: number): string {
        return value < 10 ? `0${value}` : `${value}`;
    }

    private resolveCurrentLevelId(
        config: ChapterLevelConfig,
        save: SaveModel,
        passedLevelIds: ReadonlySet<number>,
    ): number | null {
        const nextUnpassedLevel = config.levels.find((level) => !passedLevelIds.has(level.id)) ?? null;

        if (!nextUnpassedLevel) {
            return null;
        }

        const savedCurrentLevelId = this.resolveSavedCurrentLevelId(config, save);

        if (savedCurrentLevelId && !passedLevelIds.has(savedCurrentLevelId)) {
            return savedCurrentLevelId;
        }

        return nextUnpassedLevel.id;
    }

    private resolveSavedCurrentLevelId(config: ChapterLevelConfig, save: SaveModel): number | null {
        if (save.currentChapterId !== config.chapterId) {
            return null;
        }

        if (config.levels.some((level) => level.id === save.currentLevelId)) {
            return save.currentLevelId;
        }

        if (save.currentLevelId >= 1 && save.currentLevelId <= config.levels.length) {
            return config.levels[save.currentLevelId - 1]?.id ?? null;
        }

        return null;
    }

    private resolveLevelIndexById(config: ChapterLevelConfig, levelId: number): number | null {
        const levelIndex = config.levels.findIndex((level) => level.id === levelId);

        return levelIndex >= 0 ? levelIndex : null;
    }
}
