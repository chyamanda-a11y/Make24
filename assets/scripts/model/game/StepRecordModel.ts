import { OperatorSymbol } from './OperatorSymbol';

export interface StepRecordModel {
    readonly numbers: readonly (number | null)[];
    readonly selectedNumberIndices: readonly number[];
    readonly selectedOperator: OperatorSymbol | null;
}
