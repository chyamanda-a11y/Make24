export interface LevelModel {
    readonly id: number;
    readonly chapterId: number;
    readonly numbers: readonly number[];
    readonly answerExpression: string;
}
