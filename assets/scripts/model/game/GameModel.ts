import { LevelModel } from './LevelModel';
import { OperatorSymbol } from './OperatorSymbol';
import { StepRecordModel } from './StepRecordModel';

export class GameModel {
    public currentLevel: LevelModel | null = null;
    public currentNumbers: Array<number | null> = [];
    public selectedNumberIndices: number[] = [];
    public selectedOperator: OperatorSymbol | null = null;
    public stepHistory: StepRecordModel[] = [];
    public hasUsedAnswer: boolean = false;
    public hasCompletedLevel: boolean = false;

    public reset(level: LevelModel): void {
        this.currentLevel = level;
        this.currentNumbers = level.numbers.slice();
        this.selectedNumberIndices = [];
        this.selectedOperator = null;
        this.stepHistory = [];
        this.hasUsedAnswer = false;
        this.hasCompletedLevel = false;
    }

    public getActiveNumberCount(): number {
        return this.currentNumbers.reduce((count, value) => count + (value === null ? 0 : 1), 0);
    }

    public getFirstActiveNumberIndex(): number {
        return this.currentNumbers.findIndex((value) => value !== null);
    }
}
