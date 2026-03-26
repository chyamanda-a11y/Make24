export type LevelDifficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type LevelEstimatedSteps = 1 | 2 | 3;

export interface LevelModel {
    readonly id: number;
    readonly chapterId: number;
    readonly numbers: readonly number[];
    readonly target?: number;
    readonly answerExpression: string;
    readonly intendedSolution?: string;
    readonly keyIdea?: string;
    readonly difficulty?: LevelDifficulty;
    readonly allowDivision?: boolean;
    readonly hasFraction?: boolean;
    readonly estimatedSteps?: LevelEstimatedSteps;
    readonly teachingTags?: readonly string[];
    readonly phaseId?: string;
}
