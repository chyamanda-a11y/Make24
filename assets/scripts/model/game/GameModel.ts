import { LevelModel } from './LevelModel';
import { OperatorSymbol } from './OperatorSymbol';
import { StepRecordModel } from './StepRecordModel';

export class GameModel {
    public currentLevel: LevelModel | null = null;
    public currentNumbers: number[] = [];
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
}
