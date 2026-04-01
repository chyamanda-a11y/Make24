import { sys } from 'cc';

import { CURRENT_SAVE_VERSION, DEFAULT_SAVE_MODEL, SaveModel } from '../model/common/SaveModel';

/**
 * 本地存档统一走 {@link sys.localStorage}（Cocos 文档推荐）。
 * 在微信小游戏中由引擎适配底层存储能力（如 wx 存储），勿在业务中直接调 wx.setStorage。
 */

const STORAGE_KEY = 'make24.save';

interface RawSaveModel {
    readonly saveVersion?: unknown;
    readonly currentChapterId?: unknown;
    readonly currentLevelId?: unknown;
    readonly unlockedChapterId?: unknown;
    readonly passedLevelIds?: unknown;
    readonly starsByLevelId?: unknown;
    readonly isMusicEnabled?: unknown;
    readonly isSoundEnabled?: unknown;
}

export class SaveService {
    public load(): SaveModel {
        const rawValue = sys.localStorage.getItem(STORAGE_KEY);

        if (!rawValue) {
            return DEFAULT_SAVE_MODEL;
        }

        try {
            const normalizedSave = this.normalizeSave(JSON.parse(rawValue) as RawSaveModel);

            if (!this.isCurrentSaveVersion(rawValue)) {
                this.save(normalizedSave);
            }

            return normalizedSave;
        } catch {
            return DEFAULT_SAVE_MODEL;
        }
    }

    public save(data: SaveModel): void {
        sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    private normalizeSave(rawSave: RawSaveModel): SaveModel {
        if (!rawSave || typeof rawSave !== 'object') {
            return DEFAULT_SAVE_MODEL;
        }

        const rawSaveVersion = this.readPositiveInteger(rawSave.saveVersion);

        if (rawSaveVersion !== CURRENT_SAVE_VERSION) {
            return DEFAULT_SAVE_MODEL;
        }

        return {
            saveVersion: CURRENT_SAVE_VERSION,
            currentChapterId: this.readPositiveInteger(rawSave.currentChapterId) ?? DEFAULT_SAVE_MODEL.currentChapterId,
            currentLevelId: this.readPositiveInteger(rawSave.currentLevelId) ?? DEFAULT_SAVE_MODEL.currentLevelId,
            unlockedChapterId: this.readPositiveInteger(rawSave.unlockedChapterId) ?? DEFAULT_SAVE_MODEL.unlockedChapterId,
            passedLevelIds: this.normalizePassedLevelIds(rawSave.passedLevelIds),
            starsByLevelId: this.normalizeStarsByLevelId(rawSave.starsByLevelId),
            isMusicEnabled: this.readBooleanValue(rawSave.isMusicEnabled) ?? DEFAULT_SAVE_MODEL.isMusicEnabled,
            isSoundEnabled: this.readBooleanValue(rawSave.isSoundEnabled) ?? DEFAULT_SAVE_MODEL.isSoundEnabled,
        };
    }

    private normalizePassedLevelIds(rawPassedLevelIds: unknown): readonly number[] {
        if (!Array.isArray(rawPassedLevelIds)) {
            return DEFAULT_SAVE_MODEL.passedLevelIds;
        }

        return Array.from(
            new Set(
                rawPassedLevelIds
                    .map((value) => this.readPositiveInteger(value))
                    .filter((value): value is number => value !== null),
            ),
        );
    }

    private normalizeStarsByLevelId(rawStarsByLevelId: unknown): Readonly<Record<string, number>> {
        if (!rawStarsByLevelId || typeof rawStarsByLevelId !== 'object' || Array.isArray(rawStarsByLevelId)) {
            return DEFAULT_SAVE_MODEL.starsByLevelId;
        }

        return Object.entries(rawStarsByLevelId).reduce<Record<string, number>>((result, [levelId, starValue]) => {
            const normalizedStarValue = this.readPositiveInteger(starValue);

            if (normalizedStarValue === null) {
                return result;
            }

            result[levelId] = normalizedStarValue;
            return result;
        }, {});
    }

    private isCurrentSaveVersion(rawValue: string): boolean {
        try {
            const rawSave = JSON.parse(rawValue) as RawSaveModel;

            return this.readPositiveInteger(rawSave.saveVersion) === CURRENT_SAVE_VERSION;
        } catch {
            return false;
        }
    }

    private readPositiveInteger(value: unknown): number | null {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
            return null;
        }

        return value;
    }

    private readBooleanValue(value: unknown): boolean | null {
        if (typeof value !== 'boolean') {
            return null;
        }

        return value;
    }
}
