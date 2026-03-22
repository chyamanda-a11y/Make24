import { OperatorSymbol } from './OperatorSymbol';

export interface StepRecordModel {
    readonly numbers: readonly number[];
    readonly selectedNumberIndices: readonly number[];
    readonly selectedOperator: OperatorSymbol | null;
}
