import { GameModel } from '../../model/game/GameModel';
import { LevelModel } from '../../model/game/LevelModel';
import { OperatorSymbol } from '../../model/game/OperatorSymbol';
import { StepRecordModel } from '../../model/game/StepRecordModel';

const VALID_OPERATORS: readonly OperatorSymbol[] = ['+', '-', '*', '/'];
const GOAL_VALUE = 24;
const EPSILON = 0.000001;

export class GameController {
    private readonly model: GameModel = new GameModel();

    public startLevel(level: LevelModel): void {
        this.model.reset(level);
    }

    public getModel(): GameModel {
        return this.model;
    }

    public getOperators(): readonly OperatorSymbol[] {
        return VALID_OPERATORS;
    }

    public handleNumberTap(index: number): void {
        if (index < 0 || index >= this.model.currentNumbers.length) {
            throw new Error('GameController.handleNumberTap: index is out of range');
        }

        if (this.model.hasCompletedLevel) {
            return;
        }

        if (this.model.currentNumbers[index] === null) {
            return;
        }

        if (this.model.selectedNumberIndices.length === 0) {
            this.model.selectedNumberIndices = [index];
            return;
        }

        const firstIndex = this.model.selectedNumberIndices[0];

        if (index === firstIndex) {
            this.clearSelection();
            return;
        }

        if (!this.model.selectedOperator) {
            this.model.selectedNumberIndices = [index];
            return;
        }

        this.mergeSelectedNumbers(index);
    }

    public handleOperatorTap(operator: OperatorSymbol): void {
        if (!VALID_OPERATORS.includes(operator)) {
            throw new Error(`GameController.handleOperatorTap: invalid operator ${operator}`);
        }

        if (this.model.selectedNumberIndices.length === 0 || this.model.hasCompletedLevel) {
            return;
        }

        if (this.model.selectedOperator === operator) {
            this.model.selectedOperator = null;
            return;
        }

        this.model.selectedOperator = operator;
    }

    public restartLevel(): void {
        if (!this.model.currentLevel) {
            throw new Error('GameController.restartLevel: currentLevel is missing');
        }

        this.model.reset(this.model.currentLevel);
    }

    public revealAnswer(): string {
        if (!this.model.currentLevel) {
            throw new Error('GameController.revealAnswer: currentLevel is missing');
        }

        this.model.hasUsedAnswer = true;
        return this.model.currentLevel.answerExpression;
    }

    public undoLastStep(): boolean {
        const lastRecord = this.popStepRecord();

        if (!lastRecord) {
            return false;
        }

        this.model.currentNumbers = [...lastRecord.numbers];
        this.model.selectedNumberIndices = [...lastRecord.selectedNumberIndices];
        this.model.selectedOperator = lastRecord.selectedOperator;
        this.model.hasCompletedLevel = false;
        return true;
    }

    public pushStepRecord(record: StepRecordModel): void {
        this.model.stepHistory = [...this.model.stepHistory, record];
    }

    public popStepRecord(): StepRecordModel | null {
        const lastRecord = this.model.stepHistory[this.model.stepHistory.length - 1] ?? null;

        if (!lastRecord) {
            return null;
        }

        this.model.stepHistory = this.model.stepHistory.slice(0, -1);
        return lastRecord;
    }

    private mergeSelectedNumbers(secondIndex: number): void {
        const firstIndex = this.model.selectedNumberIndices[0];
        const operator = this.model.selectedOperator;

        if (firstIndex === undefined || !operator) {
            return;
        }

        const leftValue = this.model.currentNumbers[firstIndex];
        const rightValue = this.model.currentNumbers[secondIndex];

        if (leftValue === null || rightValue === null) {
            this.clearSelection();
            return;
        }

        const mergedValue = this.calculateResult(leftValue, rightValue, operator);

        if (mergedValue === null) {
            return;
        }

        this.pushStepRecord(this.createSnapshot());

        const nextNumbers = [...this.model.currentNumbers];

        nextNumbers[firstIndex] = null;
        nextNumbers[secondIndex] = mergedValue;

        this.model.currentNumbers = nextNumbers;
        this.clearSelection();

        const remainingNumbers = nextNumbers.filter((value): value is number => value !== null);

        this.model.hasCompletedLevel =
            remainingNumbers.length === 1 && Math.abs(remainingNumbers[0] - GOAL_VALUE) <= EPSILON;
    }

    private calculateResult(leftValue: number, rightValue: number, operator: OperatorSymbol): number | null {
        switch (operator) {
            case '+':
                return leftValue + rightValue;
            case '-':
                return leftValue - rightValue;
            case '*':
                return leftValue * rightValue;
            case '/':
                if (Math.abs(rightValue) <= EPSILON) {
                    return null;
                }

                return leftValue / rightValue;
            default:
                throw new Error(`GameController.calculateResult: unsupported operator ${operator}`);
        }
    }

    private createSnapshot(): StepRecordModel {
        return {
            numbers: [...this.model.currentNumbers],
            selectedNumberIndices: [...this.model.selectedNumberIndices],
            selectedOperator: this.model.selectedOperator,
        };
    }

    private clearSelection(): void {
        this.model.selectedNumberIndices = [];
        this.model.selectedOperator = null;
    }
}
