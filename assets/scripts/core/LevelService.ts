import { JsonAsset, resources } from 'cc';

import { LevelDifficulty, LevelEstimatedSteps, LevelModel } from '../model/game/LevelModel';

export interface ChapterLevelConfig {
    readonly chapterId: number;
    readonly chapterName: string;
    readonly levels: readonly LevelModel[];
}

interface RawLevelModel {
    readonly id?: unknown;
    readonly chapterId?: unknown;
    readonly numbers?: unknown;
    readonly target?: unknown;
    readonly answerExpression?: unknown;
    readonly intendedSolution?: unknown;
    readonly keyIdea?: unknown;
    readonly difficulty?: unknown;
    readonly allowDivision?: unknown;
    readonly hasFraction?: unknown;
    readonly estimatedSteps?: unknown;
    readonly teachingTag?: unknown;
    readonly teachingTags?: unknown;
    readonly phaseId?: unknown;
}

interface RawChapterLevelConfig {
    readonly chapterId?: unknown;
    readonly chapterName?: unknown;
    readonly levels?: unknown;
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

                const config = this.normalizeChapterConfig(asset.json);

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

    private normalizeChapterConfig(rawConfig: unknown): ChapterLevelConfig {
        if (!rawConfig || typeof rawConfig !== 'object') {
            throw new Error('LevelService.normalizeChapterConfig failed: config must be an object');
        }

        const config = rawConfig as RawChapterLevelConfig;
        const chapterId = this.readPositiveInteger(config.chapterId, 'config.chapterId');

        if (typeof config.chapterName !== 'string' || config.chapterName.trim().length === 0) {
            throw new Error('LevelService.normalizeChapterConfig failed: config.chapterName must be a non-empty string');
        }

        if (!Array.isArray(config.levels)) {
            throw new Error('LevelService.normalizeChapterConfig failed: config.levels must be an array');
        }

        const levelIds = new Set<number>();
        const levels = config.levels.map((rawLevel, levelIndex) => {
            const level = this.normalizeLevel(rawLevel, chapterId, levelIndex);

            if (levelIds.has(level.id)) {
                throw new Error(`LevelService.normalizeChapterConfig failed: duplicate level id ${level.id}`);
            }

            levelIds.add(level.id);
            return level;
        });

        return {
            chapterId,
            chapterName: config.chapterName.trim(),
            levels,
        };
    }

    private normalizeLevel(rawLevel: unknown, chapterId: number, levelIndex: number): LevelModel {
        if (!rawLevel || typeof rawLevel !== 'object') {
            throw new Error(`LevelService.normalizeLevel failed: level[${levelIndex}] must be an object`);
        }

        const level = rawLevel as RawLevelModel;
        const id = this.readPositiveInteger(level.id, `level[${levelIndex}].id`);
        const levelChapterId = this.readPositiveInteger(level.chapterId, `level[${levelIndex}].chapterId`);

        if (levelChapterId !== chapterId) {
            throw new Error(
                `LevelService.normalizeLevel failed: level[${levelIndex}].chapterId ${levelChapterId} does not match config.chapterId ${chapterId}`,
            );
        }

        const numbers = this.normalizeNumbers(level.numbers, levelIndex);
        const answerExpression = this.readString(level.answerExpression, `level[${levelIndex}].answerExpression`);
        const target = level.target === undefined ? 24 : this.readPositiveInteger(level.target, `level[${levelIndex}].target`);

        if (target !== 24) {
            throw new Error(`LevelService.normalizeLevel failed: level[${levelIndex}].target must be 24`);
        }

        const intendedSolution = typeof level.intendedSolution === 'string' && level.intendedSolution.trim().length > 0
            ? level.intendedSolution.trim()
            : answerExpression;
        const teachingTags = this.normalizeTeachingTags(level.teachingTags, level.teachingTag, levelIndex);
        const keyIdea = typeof level.keyIdea === 'string' && level.keyIdea.trim().length > 0
            ? level.keyIdea.trim()
            : teachingTags[0] ?? undefined;
        const difficulty = this.normalizeDifficulty(level.difficulty, levelIndex);
        const estimatedSteps = this.normalizeEstimatedSteps(level.estimatedSteps, levelIndex);
        const allowDivision = typeof level.allowDivision === 'boolean'
            ? level.allowDivision
            : answerExpression.includes('/');
        const hasFraction = typeof level.hasFraction === 'boolean'
            ? level.hasFraction
            : false;
        const phaseId = typeof level.phaseId === 'string' && level.phaseId.trim().length > 0
            ? level.phaseId.trim()
            : undefined;

        return {
            id,
            chapterId: levelChapterId,
            numbers,
            target,
            answerExpression,
            intendedSolution,
            keyIdea,
            difficulty,
            allowDivision,
            hasFraction,
            estimatedSteps,
            teachingTags,
            phaseId,
        };
    }

    private normalizeNumbers(rawNumbers: unknown, levelIndex: number): readonly number[] {
        if (!Array.isArray(rawNumbers) || rawNumbers.length !== 4) {
            throw new Error(`LevelService.normalizeNumbers failed: level[${levelIndex}].numbers must contain exactly 4 entries`);
        }

        return rawNumbers.map((value, numberIndex) => {
            const normalizedValue = this.readPositiveInteger(value, `level[${levelIndex}].numbers[${numberIndex}]`);

            if (normalizedValue > 13) {
                throw new Error(
                    `LevelService.normalizeNumbers failed: level[${levelIndex}].numbers[${numberIndex}] exceeds supported max value 13`,
                );
            }

            return normalizedValue;
        });
    }

    private normalizeTeachingTags(
        rawTeachingTags: unknown,
        rawTeachingTag: unknown,
        levelIndex: number,
    ): readonly string[] | undefined {
        if (Array.isArray(rawTeachingTags)) {
            const teachingTags = rawTeachingTags
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.trim())
                .filter((value) => value.length > 0);

            if (teachingTags.length === 0) {
                return undefined;
            }

            return teachingTags;
        }

        if (typeof rawTeachingTag === 'string' && rawTeachingTag.trim().length > 0) {
            return [rawTeachingTag.trim()];
        }

        if (rawTeachingTags !== undefined) {
            throw new Error(`LevelService.normalizeTeachingTags failed: level[${levelIndex}].teachingTags must be a string array`);
        }

        return undefined;
    }

    private normalizeDifficulty(rawDifficulty: unknown, levelIndex: number): LevelDifficulty | undefined {
        if (rawDifficulty === undefined) {
            return undefined;
        }

        const difficulty = this.readPositiveInteger(rawDifficulty, `level[${levelIndex}].difficulty`);

        if (difficulty < 1 || difficulty > 9) {
            throw new Error(`LevelService.normalizeDifficulty failed: level[${levelIndex}].difficulty must be between 1 and 9`);
        }

        return difficulty as LevelDifficulty;
    }

    private normalizeEstimatedSteps(rawEstimatedSteps: unknown, levelIndex: number): LevelEstimatedSteps | undefined {
        if (rawEstimatedSteps === undefined) {
            return undefined;
        }

        const estimatedSteps = this.readPositiveInteger(rawEstimatedSteps, `level[${levelIndex}].estimatedSteps`);

        if (estimatedSteps < 1 || estimatedSteps > 3) {
            throw new Error(`LevelService.normalizeEstimatedSteps failed: level[${levelIndex}].estimatedSteps must be between 1 and 3`);
        }

        return estimatedSteps as LevelEstimatedSteps;
    }

    private readPositiveInteger(value: unknown, fieldName: string): number {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
            throw new Error(`LevelService.readPositiveInteger failed: ${fieldName} must be a positive integer`);
        }

        return value;
    }

    private readString(value: unknown, fieldName: string): string {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`LevelService.readString failed: ${fieldName} must be a non-empty string`);
        }

        return value.trim();
    }
}
