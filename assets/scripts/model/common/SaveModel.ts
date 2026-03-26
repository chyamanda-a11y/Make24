export interface SaveModel {
    readonly saveVersion: number;
    readonly currentChapterId: number;
    readonly currentLevelId: number;
    readonly unlockedChapterId: number;
    readonly passedLevelIds: readonly number[];
    readonly starsByLevelId: Readonly<Record<string, number>>;
}

export const CURRENT_SAVE_VERSION = 2;

export const DEFAULT_SAVE_MODEL: SaveModel = {
    saveVersion: CURRENT_SAVE_VERSION,
    currentChapterId: 1,
    currentLevelId: 1,
    unlockedChapterId: 1,
    passedLevelIds: [],
    starsByLevelId: {},
};
