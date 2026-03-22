export interface SaveModel {
    readonly currentChapterId: number;
    readonly currentLevelId: number;
    readonly unlockedChapterId: number;
    readonly passedLevelIds: readonly number[];
    readonly starsByLevelId: Readonly<Record<string, number>>;
}

export const DEFAULT_SAVE_MODEL: SaveModel = {
    currentChapterId: 1,
    currentLevelId: 1,
    unlockedChapterId: 1,
    passedLevelIds: [],
    starsByLevelId: {},
};
