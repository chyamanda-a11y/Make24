const GOAL_VALUE = 24;
const FRIENDLY_VALUES = new Set([1, 2, 3, 4, 6, 8, 12, 18, 21, 24]);

function gcd(left, right) {
    let a = Math.abs(left);
    let b = Math.abs(right);

    while (b !== 0) {
        const remainder = a % b;
        a = b;
        b = remainder;
    }

    return a === 0 ? 1 : a;
}

function createRational(numerator, denominator = 1) {
    if (denominator === 0) {
        return null;
    }

    let nextNumerator = numerator;
    let nextDenominator = denominator;

    if (nextDenominator < 0) {
        nextNumerator *= -1;
        nextDenominator *= -1;
    }

    const divisor = gcd(nextNumerator, nextDenominator);

    return {
        numerator: nextNumerator / divisor,
        denominator: nextDenominator / divisor,
    };
}

function add(left, right) {
    return createRational(
        left.numerator * right.denominator + right.numerator * left.denominator,
        left.denominator * right.denominator,
    );
}

function subtract(left, right) {
    return createRational(
        left.numerator * right.denominator - right.numerator * left.denominator,
        left.denominator * right.denominator,
    );
}

function multiply(left, right) {
    return createRational(
        left.numerator * right.numerator,
        left.denominator * right.denominator,
    );
}

function divide(left, right) {
    if (right.numerator === 0) {
        return null;
    }

    return createRational(
        left.numerator * right.denominator,
        left.denominator * right.numerator,
    );
}

function isInteger(value) {
    return value.denominator === 1;
}

function absValue(value) {
    return Math.abs(value.numerator / value.denominator);
}

function createLeafState(number) {
    return {
        value: createRational(number, 1),
        expr: `${number}`,
        node: {
            type: 'num',
            value: number,
        },
        meta: {
            operations: [],
            fractionCount: 0,
            negativeCount: 0,
            maxAbsIntermediate: Math.abs(number),
            depth: 0,
            imbalance: 0,
            intermediates: [createRational(number, 1)],
        },
    };
}

function createMergedState(left, right, operator, result) {
    return {
        value: result,
        expr: `(${left.expr}${operator}${right.expr})`,
        node: {
            type: 'op',
            op: operator,
            left: left.node,
            right: right.node,
        },
        meta: {
            operations: [...left.meta.operations, ...right.meta.operations, operator],
            fractionCount:
                left.meta.fractionCount +
                right.meta.fractionCount +
                (isInteger(result) ? 0 : 1),
            negativeCount:
                left.meta.negativeCount +
                right.meta.negativeCount +
                (result.numerator < 0 ? 1 : 0),
            maxAbsIntermediate: Math.max(
                left.meta.maxAbsIntermediate,
                right.meta.maxAbsIntermediate,
                absValue(result),
            ),
            depth: Math.max(left.meta.depth, right.meta.depth) + 1,
            imbalance:
                left.meta.imbalance +
                right.meta.imbalance +
                Math.abs(left.meta.depth - right.meta.depth),
            intermediates: [...left.meta.intermediates, ...right.meta.intermediates, result],
        },
    };
}

function buildNextStates(left, right) {
    const nextStates = [];

    nextStates.push(createMergedState(left, right, '+', add(left.value, right.value)));
    nextStates.push(createMergedState(left, right, '*', multiply(left.value, right.value)));
    nextStates.push(createMergedState(left, right, '-', subtract(left.value, right.value)));
    nextStates.push(createMergedState(right, left, '-', subtract(right.value, left.value)));

    const leftDivideRight = divide(left.value, right.value);

    if (leftDivideRight) {
        nextStates.push(createMergedState(left, right, '/', leftDivideRight));
    }

    const rightDivideLeft = divide(right.value, left.value);

    if (rightDivideLeft) {
        nextStates.push(createMergedState(right, left, '/', rightDivideLeft));
    }

    return nextStates;
}

function isGoal(value) {
    return value.numerator === GOAL_VALUE * value.denominator;
}

function search(states, solutions, seenExpressions, numbers) {
    if (states.length === 1) {
        if (!isGoal(states[0].value)) {
            return;
        }

        if (seenExpressions.has(states[0].expr)) {
            return;
        }

        seenExpressions.add(states[0].expr);
        solutions.push(decorateSolution(numbers, states[0]));
        return;
    }

    for (let i = 0; i < states.length; i += 1) {
        for (let j = i + 1; j < states.length; j += 1) {
            const restStates = [];

            for (let index = 0; index < states.length; index += 1) {
                if (index !== i && index !== j) {
                    restStates.push(states[index]);
                }
            }

            const left = states[i];
            const right = states[j];
            const nextStates = buildNextStates(left, right);

            nextStates.forEach((nextState) => {
                restStates.push(nextState);
                search(restStates, solutions, seenExpressions, numbers);
                restStates.pop();
            });
        }
    }
}

function getNodeResult(node) {
    if (node.type === 'num') {
        return createRational(node.value, 1);
    }

    const left = getNodeResult(node.left);
    const right = getNodeResult(node.right);

    switch (node.op) {
    case '+':
        return add(left, right);
    case '-':
        return subtract(left, right);
    case '*':
        return multiply(left, right);
    case '/':
        return divide(left, right);
    default:
        throw new Error(`Unsupported operator: ${node.op}`);
    }
}

function areNodesEquivalent(left, right) {
    if (left.type !== right.type) {
        return false;
    }

    if (left.type === 'num' && right.type === 'num') {
        return left.value === right.value;
    }

    if (left.op !== right.op) {
        return false;
    }

    return areNodesEquivalent(left.left, right.left) && areNodesEquivalent(left.right, right.right);
}

function hasTrivialIdentityPattern(node) {
    if (node.type === 'num') {
        return false;
    }

    const leftValue = getNodeResult(node.left);
    const rightValue = getNodeResult(node.right);
    const hasSelfCancel = node.op === '-' && areNodesEquivalent(node.left, node.right);
    const hasSelfDivide = node.op === '/' && areNodesEquivalent(node.left, node.right);
    const hasMultiplyByOne =
        node.op === '*' &&
        ((isInteger(leftValue) && leftValue.numerator === 1) || (isInteger(rightValue) && rightValue.numerator === 1));
    const hasDivideByOne = node.op === '/' && isInteger(rightValue) && rightValue.numerator === 1;

    return hasSelfCancel
        || hasSelfDivide
        || hasMultiplyByOne
        || hasDivideByOne
        || hasTrivialIdentityPattern(node.left)
        || hasTrivialIdentityPattern(node.right);
}

function hasCounterIntuitiveDivision(node) {
    if (node.type === 'num') {
        return false;
    }

    if (node.op === '/') {
        const rightIsNested = node.right.type === 'op';
        const leftIsSubtractive = node.left.type === 'op' && node.left.op === '-';
        const rightIsSubtractive = node.right.type === 'op' && node.right.op === '-';

        if (rightIsNested || leftIsSubtractive || rightIsSubtractive) {
            return true;
        }
    }

    return hasCounterIntuitiveDivision(node.left) || hasCounterIntuitiveDivision(node.right);
}

function countFriendlyAnchors(intermediates) {
    const uniqueValues = new Set(
        intermediates
            .filter((value) => isInteger(value))
            .map((value) => Math.abs(value.numerator)),
    );

    return [...uniqueValues].filter((value) => FRIENDLY_VALUES.has(value)).length;
}

function hasIntermediateValue(intermediates, target) {
    return intermediates.some((value) => isInteger(value) && value.numerator === target);
}

function getTopOperator(node) {
    return node.type === 'op' ? node.op : null;
}

function isSimplePairNode(node) {
    return node.type === 'op'
        && node.left.type === 'num'
        && node.right.type === 'num';
}

function hasNestedSubtractiveBranch(node) {
    if (node.type === 'num') {
        return false;
    }

    const currentNodeIsNestedSubtraction =
        node.op === '-'
        && (node.left.type === 'op' || node.right.type === 'op');

    return currentNodeIsNestedSubtraction
        || hasNestedSubtractiveBranch(node.left)
        || hasNestedSubtractiveBranch(node.right);
}

function isOrderSensitive(solution) {
    return solution.usesSubtraction && hasNestedSubtractiveBranch(solution.node);
}

function classifyStructureFamily(solution) {
    const root = solution.node;

    if (solution.fractionCount > 0) {
        return 'fraction-driven';
    }

    if (isOrderSensitive(solution)) {
        return 'order-sensitive';
    }

    if (
        root.type === 'op'
        && root.op === '*'
        && root.left.type === 'op'
        && root.right.type === 'op'
        && (root.left.op === '-' || root.right.op === '-' || hasIntermediateValue(solution.intermediates, 18) || hasIntermediateValue(solution.intermediates, 21))
    ) {
        return 'hidden-anchor';
    }

    if (hasIntermediateValue(solution.intermediates, 18) || hasIntermediateValue(solution.intermediates, 21)) {
        return 'hidden-anchor';
    }

    if (root.type === 'op' && root.op === '+' && hasIntermediateValue(solution.intermediates, 12)) {
        const leftValue = getNodeResult(root.left);
        const rightValue = getNodeResult(root.right);

        if (isInteger(leftValue) && leftValue.numerator === 12 && isInteger(rightValue) && rightValue.numerator === 12) {
            return areNodesEquivalent(root.left, root.right) ? 'double-same-merge' : 'make-12-then-double';
        }
    }

    if (root.type === 'op' && root.op === '*') {
        const leftValue = getNodeResult(root.left);
        const rightValue = getNodeResult(root.right);
        const factors = [leftValue, rightValue]
            .filter((value) => value && isInteger(value))
            .map((value) => Math.abs(value.numerator))
            .sort((left, right) => left - right);

        if (factors.length === 2 && factors[0] === 3 && factors[1] === 8) {
            return 'make-8-then-times-3';
        }

        if (factors.length === 2 && factors[0] === 4 && factors[1] === 6) {
            return 'make-6-then-times-4';
        }

        if (factors.includes(1)) {
            return 'make-1-then-scale';
        }
    }

    if (solution.usesDivision) {
        return 'divide-then-combine';
    }

    return 'other';
}

function inferDifficulty(solution) {
    let difficulty = 2;

    difficulty += Math.max(solution.estimatedSteps - 1, 0);
    difficulty += solution.usesSubtraction ? 1 : 0;
    difficulty += solution.usesDivision ? 1 : 0;
    difficulty += solution.fractionCount > 0 ? 2 : 0;
    difficulty += solution.negativeCount > 0 ? 1 : 0;
    difficulty += solution.hasCounterIntuitiveDivision ? 1 : 0;
    difficulty += solution.maxAbsIntermediate > 24 ? 1 : 0;
    difficulty += solution.imbalance >= 2 ? 1 : 0;
    difficulty += solution.structureFamily === 'order-sensitive' ? 1 : 0;
    difficulty += solution.structureFamily === 'hidden-anchor' ? 1 : 0;
    difficulty += solution.structureFamily === 'fraction-driven' ? 1 : 0;

    return Math.max(1, Math.min(difficulty, 9));
}

function inferKeyIdea(solution) {
    if (solution.structureFamily === 'make-12-then-double' || solution.structureFamily === 'double-same-merge') {
        return '先凑两个12，再合成24';
    }

    if (solution.structureFamily === 'make-8-then-times-3') {
        return '先凑8，再乘3';
    }

    if (solution.structureFamily === 'make-6-then-times-4') {
        return '先凑6，再乘4';
    }

    if (solution.structureFamily === 'make-1-then-scale') {
        return '先做1，再放大整体';
    }

    if (solution.structureFamily === 'divide-then-combine') {
        if (hasIntermediateValue(solution.intermediates, 2)) {
            return '先除出2，再整合另一边';
        }

        if (hasIntermediateValue(solution.intermediates, 3)) {
            return '先除出3，再整合另一边';
        }

        if (hasIntermediateValue(solution.intermediates, 4)) {
            return '先除出4，再整合另一边';
        }

        return '先做整除，再合成24';
    }

    if (solution.structureFamily === 'order-sensitive') {
        return '顺序关键：先处理括号里的局部';
    }

    if (hasIntermediateValue(solution.intermediates, 21)) {
        return '先做21，再补3';
    }

    if (hasIntermediateValue(solution.intermediates, 18)) {
        return '先做18，再补差值';
    }

    if (hasIntermediateValue(solution.intermediates, 12)) {
        return '先凑12，再补齐24';
    }

    if (hasIntermediateValue(solution.intermediates, 8)) {
        return '先找8，再整合另一边';
    }

    return '先找中间值，再合成24';
}

function inferTags(solution) {
    const tags = [];

    switch (solution.structureFamily) {
    case 'make-12-then-double':
    case 'double-same-merge':
        tags.push('凑12');
        break;
    case 'make-8-then-times-3':
        tags.push('凑8');
        break;
    case 'make-6-then-times-4':
        tags.push('凑6');
        break;
    case 'make-1-then-scale':
        tags.push('先做1');
        break;
    case 'divide-then-combine':
        tags.push('简单整除');
        break;
    case 'order-sensitive':
        tags.push('顺序意识');
        break;
    case 'hidden-anchor':
        tags.push('隐藏中间值');
        break;
    case 'fraction-driven':
        tags.push('分数驱动');
        break;
    default:
        break;
    }

    if (solution.usesDivision && !tags.includes('简单整除')) {
        tags.push('简单整除');
    }

    if (solution.usesSubtraction && !tags.includes('补差值') && solution.structureFamily !== 'order-sensitive') {
        tags.push('补差值');
    }

    if (solution.anchorHits >= 3 && !tags.includes('中间值训练')) {
        tags.push('中间值训练');
    }

    return tags.slice(0, 2);
}

function compareDominance(left, right) {
    const comparisons = [
        left.fractionCount - right.fractionCount,
        left.negativeCount - right.negativeCount,
        Number(left.usesDivision) - Number(right.usesDivision),
        Number(left.hasCounterIntuitiveDivision) - Number(right.hasCounterIntuitiveDivision),
        Number(left.hasTrivialIdentityPattern) - Number(right.hasTrivialIdentityPattern),
        left.maxAbsIntermediate - right.maxAbsIntermediate,
        left.imbalance - right.imbalance,
        right.anchorHits - left.anchorHits,
        left.estimatedSteps - right.estimatedSteps,
        left.answerExpression.length - right.answerExpression.length,
    ];

    for (const gap of comparisons) {
        if (gap !== 0) {
            return gap;
        }
    }

    return left.answerExpression.localeCompare(right.answerExpression);
}

function inferEstimatedSteps(solution) {
    const root = solution.node;

    if (solution.hasCounterIntuitiveDivision || isOrderSensitive(solution)) {
        return 3;
    }

    if (root.type === 'op' && isSimplePairNode(root.left) && isSimplePairNode(root.right)) {
        return 2;
    }

    if (
        root.type === 'op'
        && (
            (root.left.type === 'num' && isSimplePairNode(root.right))
            || (root.right.type === 'num' && isSimplePairNode(root.left))
        )
    ) {
        return 2;
    }

    return solution.structureDepth >= 3 ? 3 : 2;
}

function decorateSolution(numbers, state) {
    const operationSet = new Set(state.meta.operations);
    const uniqueNumbers = new Set(numbers);
    const solution = {
        answerExpression: state.expr,
        numbers,
        node: state.node,
        intermediates: state.meta.intermediates,
        operations: state.meta.operations,
        operationCount: state.meta.operations.length,
        distinctOpCount: operationSet.size,
        usesDivision: operationSet.has('/'),
        usesSubtraction: operationSet.has('-'),
        fractionCount: state.meta.fractionCount,
        negativeCount: state.meta.negativeCount,
        maxAbsIntermediate: state.meta.maxAbsIntermediate,
        imbalance: state.meta.imbalance,
        maxNumber: numbers[numbers.length - 1],
        minNumber: numbers[0],
        numberSum: numbers.reduce((sum, value) => sum + value, 0),
        uniqueNumberCount: uniqueNumbers.size,
        structureDepth: state.meta.depth,
    };

    solution.topOperator = getTopOperator(solution.node);
    solution.anchorHits = countFriendlyAnchors(solution.intermediates);
    solution.hasTrivialIdentityPattern = hasTrivialIdentityPattern(solution.node);
    solution.hasCounterIntuitiveDivision = hasCounterIntuitiveDivision(solution.node);
    solution.structureFamily = classifyStructureFamily(solution);
    solution.estimatedSteps = inferEstimatedSteps(solution);
    solution.dominantDifficulty = inferDifficulty(solution);
    solution.dominantKeyIdea = inferKeyIdea(solution);
    solution.dominantTags = inferTags(solution);

    return solution;
}

function solveAll(numbers) {
    const solutions = [];
    const seenExpressions = new Set();
    const states = numbers.map((number) => createLeafState(number));

    search(states, solutions, seenExpressions, numbers);

    return solutions.sort(compareDominance);
}

function createNumbersKey(numbers) {
    return [...numbers].sort((left, right) => left - right).join(',');
}

function getPhaseRule(phaseId) {
    const chapterRules = {
        'novice-a': {
            minDifficulty: 1,
            maxDifficulty: 4,
            maxEstimatedSteps: 2,
            allowDivision: false,
            forbidFamilies: new Set(['order-sensitive', 'fraction-driven']),
        },
        'novice-b': {
            minDifficulty: 2,
            maxDifficulty: 5,
            maxEstimatedSteps: 2,
            allowDivision: false,
            allowedFamilies: new Set(['make-12-then-double', 'double-same-merge', 'make-8-then-times-3', 'make-6-then-times-4', 'other', 'hidden-anchor']),
        },
        'novice-c': {
            minDifficulty: 3,
            maxDifficulty: 6,
            maxEstimatedSteps: 3,
            forbidFamilies: new Set(['double-same-merge', 'make-12-then-double']),
        },
        'advanced-a': {
            minDifficulty: 4,
            maxDifficulty: 6,
            maxEstimatedSteps: 3,
            requireOneOf: ['usesDivision', 'usesSubtraction', 'hidden-anchor', 'make-1-then-scale'],
        },
        'advanced-b': {
            minDifficulty: 5,
            maxDifficulty: 7,
            maxEstimatedSteps: 3,
            requireOneOf: ['usesSubtraction', 'order-sensitive'],
        },
        'advanced-c': {
            minDifficulty: 5,
            maxDifficulty: 8,
            maxEstimatedSteps: 3,
            requireOneOf: ['hidden-anchor', 'order-sensitive', 'make-1-then-scale'],
        },
        'challenge-a': {
            minDifficulty: 4,
            maxDifficulty: 8,
            maxEstimatedSteps: 3,
        },
        'challenge-b': {
            minDifficulty: 5,
            maxDifficulty: 9,
            maxEstimatedSteps: 3,
        },
        'challenge-c': {
            minDifficulty: 5,
            maxDifficulty: 9,
            maxEstimatedSteps: 3,
        },
    };

    return chapterRules[phaseId] ?? null;
}

function getPhaseMatchReasons(phaseId, solution) {
    const reasons = [];
    const rule = getPhaseRule(phaseId);

    if (!rule) {
        return reasons;
    }

    if (solution.dominantDifficulty < rule.minDifficulty || solution.dominantDifficulty > rule.maxDifficulty) {
        reasons.push(`dominantDifficulty ${solution.dominantDifficulty} is outside ${phaseId} range ${rule.minDifficulty}-${rule.maxDifficulty}`);
    }

    if (solution.estimatedSteps > rule.maxEstimatedSteps) {
        reasons.push(`estimatedSteps ${solution.estimatedSteps} exceeds ${phaseId} max ${rule.maxEstimatedSteps}`);
    }

    if (rule.allowDivision === false && solution.usesDivision) {
        reasons.push(`${phaseId} should not rely on division`);
    }

    if (rule.forbidFamilies?.has(solution.structureFamily)) {
        reasons.push(`${phaseId} should not use structureFamily ${solution.structureFamily}`);
    }

    if (rule.allowedFamilies && !rule.allowedFamilies.has(solution.structureFamily)) {
        reasons.push(`${phaseId} dominant structureFamily ${solution.structureFamily} is not in allowed set`);
    }

    if (rule.requiredFamily && solution.structureFamily !== rule.requiredFamily) {
        reasons.push(`${phaseId} requires structureFamily ${rule.requiredFamily}, got ${solution.structureFamily}`);
    }

    if (Array.isArray(rule.requireOneOf)) {
        const matched = rule.requireOneOf.some((item) => {
            if (item === 'usesDivision') {
                return solution.usesDivision;
            }

            if (item === 'usesSubtraction') {
                return solution.usesSubtraction;
            }

            return solution.structureFamily === item;
        });

        if (!matched) {
            reasons.push(`${phaseId} requires one of ${rule.requireOneOf.join(', ')}`);
        }
    }

    return reasons;
}

function getAlternativeDominanceIssue(dominantSolution, runnerUpSolution) {
    if (!runnerUpSolution) {
        return null;
    }

    if (dominantSolution.structureFamily === runnerUpSolution.structureFamily) {
        return null;
    }

    const dominantTuple = [
        dominantSolution.fractionCount,
        dominantSolution.negativeCount,
        Number(dominantSolution.usesDivision),
        Number(dominantSolution.hasCounterIntuitiveDivision),
    ];
    const runnerUpTuple = [
        runnerUpSolution.fractionCount,
        runnerUpSolution.negativeCount,
        Number(runnerUpSolution.usesDivision),
        Number(runnerUpSolution.hasCounterIntuitiveDivision),
    ];

    const runnerUpIsClearlyBetter = runnerUpTuple.every((value, index) => value <= dominantTuple[index])
        && runnerUpTuple.some((value, index) => value < dominantTuple[index]);

    return runnerUpIsClearlyBetter ? 'SIMPLER_ALTERNATIVE_EXISTS' : null;
}

function analyzeNumbers(numbers) {
    const allSolutions = solveAll(numbers);
    const dominantSolution = allSolutions[0] ?? null;
    const runnerUpSolution = allSolutions[1] ?? null;

    return {
        numbersKey: createNumbersKey(numbers),
        allSolutions,
        allSolutionCount: allSolutions.length,
        dominantSolution,
        runnerUpSolution,
        alternativeIssue: dominantSolution ? getAlternativeDominanceIssue(dominantSolution, runnerUpSolution) : null,
    };
}

function analyzeLevel(level) {
    const analysis = analyzeNumbers(level.numbers);

    if (!analysis.dominantSolution) {
        return {
            ...analysis,
            rejectReasons: ['NO_LEGAL_SOLUTION'],
            phaseMismatchReasons: [],
        };
    }

    const phaseMismatchReasons = getPhaseMatchReasons(level.phaseId, analysis.dominantSolution);
    const rejectReasons = [];

    if (analysis.dominantSolution.answerExpression !== level.answerExpression) {
        rejectReasons.push('NON_DOMINANT_ANSWER_EXPRESSION');
    }

    if (analysis.dominantSolution.answerExpression !== level.intendedSolution) {
        rejectReasons.push('NON_DOMINANT_INTENDED_SOLUTION');
    }

    if (analysis.alternativeIssue) {
        rejectReasons.push(analysis.alternativeIssue);
    }

    if (phaseMismatchReasons.length > 0) {
        rejectReasons.push('DOMINANT_SOLUTION_MISMATCH_PHASE');
    }

    return {
        ...analysis,
        phaseMismatchReasons,
        rejectReasons,
    };
}

module.exports = {
    GOAL_VALUE,
    analyzeLevel,
    analyzeNumbers,
    createNumbersKey,
    getPhaseMatchReasons,
};
