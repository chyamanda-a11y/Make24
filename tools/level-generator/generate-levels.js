const fs = require('fs');
const path = require('path');

const GOAL_VALUE = 24;
const OUTPUT_DIR = path.resolve(__dirname, '../../assets/resources/config/levels');

function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);

    while (y !== 0) {
        const next = x % y;
        x = y;
        y = next;
    }

    return x === 0 ? 1 : x;
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

function isGoal(value) {
    return value.numerator === GOAL_VALUE * value.denominator;
}

function absValue(value) {
    return Math.abs(value.numerator / value.denominator);
}

function createLeafState(number) {
    return {
        value: createRational(number, 1),
        expr: `${number}`,
        meta: {
            operations: [],
            fractionCount: 0,
            negativeCount: 0,
            maxAbsIntermediate: Math.abs(number),
            depth: 0,
            imbalance: 0,
        },
    };
}

function createMergedState(left, right, operator, result) {
    return {
        value: result,
        expr: `(${left.expr}${operator}${right.expr})`,
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

function decorateSolution(numbers, state) {
    const operationSet = new Set(state.meta.operations);
    const uniqueNumbers = new Set(numbers);

    return {
        answerExpression: state.expr,
        numbers,
        operations: state.meta.operations,
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
    };
}

function solveAll(numbers) {
    const solutions = [];
    const seenExpressions = new Set();
    const states = numbers.map((number) => createLeafState(number));

    search(states, solutions, seenExpressions, numbers);
    return solutions;
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

            for (const nextState of nextStates) {
                restStates.push(nextState);
                search(restStates, solutions, seenExpressions, numbers);
                restStates.pop();
            }
        }
    }
}

function generateSortedTuples(min, max, length, start = min, prefix = [], result = []) {
    if (prefix.length === length) {
        result.push([...prefix]);
        return result;
    }

    for (let value = start; value <= max; value += 1) {
        prefix.push(value);
        generateSortedTuples(min, max, length, value, prefix, result);
        prefix.pop();
    }

    return result;
}

function getBaseDifficulty(solution) {
    const spread = solution.maxNumber - solution.minNumber;

    return (
        solution.maxNumber * 2 +
        solution.numberSum +
        solution.distinctOpCount * 5 +
        (solution.usesDivision ? 6 : 0) +
        (solution.usesSubtraction ? 3 : 0) +
        solution.fractionCount * 10 +
        solution.negativeCount * 8 +
        solution.imbalance * 2 +
        (solution.maxAbsIntermediate > 24 ? 4 : 0) +
        (solution.maxAbsIntermediate > 48 ? 4 : 0) +
        spread
    );
}

function hasTrivialIdentityExpression(expression) {
    return (
        /\((\d+)\/\1\)/.test(expression) ||
        /\((\d+)-\1\)/.test(expression) ||
        expression.includes('(1*') ||
        expression.includes('*1)') ||
        expression.includes('/1)')
    );
}

function beginnerCompatible(solution) {
    return (
        solution.maxNumber <= 9 &&
        solution.fractionCount === 0 &&
        solution.negativeCount === 0 &&
        solution.maxAbsIntermediate <= 36 &&
        solution.distinctOpCount <= 2 &&
        solution.imbalance <= 1
    );
}

function beginnerScore(solution) {
    return (
        getBaseDifficulty(solution) +
        (solution.usesDivision ? 5 : 0) +
        (solution.usesSubtraction ? 2 : 0) +
        solution.maxAbsIntermediate / 10
    );
}

function advancedCompatible(solution) {
    return (
        solution.maxNumber <= 10 &&
        solution.fractionCount === 0 &&
        solution.negativeCount === 0 &&
        solution.maxAbsIntermediate <= 72 &&
        solution.distinctOpCount >= 2 &&
        (solution.usesDivision || solution.usesSubtraction || solution.imbalance >= 2) &&
        !hasTrivialIdentityExpression(solution.answerExpression)
    );
}

function advancedScore(solution) {
    return Math.abs(getBaseDifficulty(solution) - 40) - (solution.usesDivision ? 4 : 0);
}

function challengeCompatible(solution) {
    return (
        solution.maxNumber <= 13 &&
        solution.maxAbsIntermediate <= 144 &&
        (solution.usesDivision ||
            solution.usesSubtraction ||
            solution.fractionCount > 0 ||
            solution.imbalance >= 2) &&
        !hasTrivialIdentityExpression(solution.answerExpression)
    );
}

function challengeScore(solution) {
    return (
        getBaseDifficulty(solution) +
        solution.fractionCount * 4 +
        solution.negativeCount * 3
    );
}

function pickBestSolution(solutions, predicate, scoreFn, mode) {
    const compatibleSolutions = solutions.filter(predicate);

    if (compatibleSolutions.length === 0) {
        return null;
    }

    const sortedSolutions = [...compatibleSolutions].sort((left, right) => {
        const scoreGap = scoreFn(left) - scoreFn(right);

        if (scoreGap !== 0) {
            return scoreGap;
        }

        return left.answerExpression.localeCompare(right.answerExpression);
    });

    if (mode === 'max') {
        return sortedSolutions[sortedSolutions.length - 1];
    }

    return sortedSolutions[0];
}

function analyzeCandidates() {
    const tuples = generateSortedTuples(1, 13, 4);
    const beginnerCandidates = [];
    const advancedCandidates = [];
    const challengeCandidates = [];

    for (const numbers of tuples) {
        const solutions = solveAll(numbers);

        if (solutions.length === 0) {
            continue;
        }

        const beginnerSolution = pickBestSolution(
            solutions,
            beginnerCompatible,
            beginnerScore,
            'min',
        );

        if (beginnerSolution) {
            beginnerCandidates.push({
                key: numbers.join('-'),
                numbers,
                answerExpression: beginnerSolution.answerExpression,
                difficulty: beginnerScore(beginnerSolution),
                solution: beginnerSolution,
            });
        }

        const advancedSolution = pickBestSolution(
            solutions,
            advancedCompatible,
            advancedScore,
            'min',
        );

        if (advancedSolution) {
            advancedCandidates.push({
                key: numbers.join('-'),
                numbers,
                answerExpression: advancedSolution.answerExpression,
                difficulty: getBaseDifficulty(advancedSolution),
                solution: advancedSolution,
            });
        }

        const challengeSolution = pickBestSolution(
            solutions,
            challengeCompatible,
            challengeScore,
            'max',
        );

        if (challengeSolution) {
            challengeCandidates.push({
                key: numbers.join('-'),
                numbers,
                answerExpression: challengeSolution.answerExpression,
                difficulty: challengeScore(challengeSolution),
                solution: challengeSolution,
            });
        }
    }

    return {
        beginnerCandidates: beginnerCandidates.sort(sortByDifficultyAsc),
        advancedCandidates: advancedCandidates.sort(sortByDifficultyAsc),
        challengeCandidates: challengeCandidates.sort(sortByDifficultyDesc),
    };
}

function sortByDifficultyAsc(left, right) {
    const gap = left.difficulty - right.difficulty;

    if (gap !== 0) {
        return gap;
    }

    return left.key.localeCompare(right.key);
}

function sortByDifficultyDesc(left, right) {
    const gap = right.difficulty - left.difficulty;

    if (gap !== 0) {
        return gap;
    }

    return left.key.localeCompare(right.key);
}

function selectByQuota(candidates, selection, usedKeys, count, predicate) {
    for (const candidate of candidates) {
        if (selection.length >= count) {
            return;
        }

        if (usedKeys.has(candidate.key) || !predicate(candidate)) {
            continue;
        }

        usedKeys.add(candidate.key);
        selection.push(candidate);
    }
}

function fillSelection(candidates, selection, usedKeys, count) {
    for (const candidate of candidates) {
        if (selection.length >= count) {
            return;
        }

        if (usedKeys.has(candidate.key)) {
            continue;
        }

        usedKeys.add(candidate.key);
        selection.push(candidate);
    }
}

function selectBeginnerLevels(beginnerCandidates, usedKeys) {
    const selection = [];

    selectByQuota(beginnerCandidates, selection, usedKeys, 6, (candidate) => !candidate.solution.usesDivision);
    selectByQuota(beginnerCandidates, selection, usedKeys, 10, (candidate) => candidate.solution.usesSubtraction);
    selectByQuota(beginnerCandidates, selection, usedKeys, 14, (candidate) => candidate.solution.usesDivision);
    fillSelection(beginnerCandidates, selection, usedKeys, 20);

    return selection.slice(0, 20);
}

function selectAdvancedLevels(advancedCandidates, usedKeys) {
    const selection = [];
    const midRangeCandidates = advancedCandidates.filter(
        (candidate, index) =>
            index >= Math.floor(advancedCandidates.length * 0.12) &&
            index <= Math.floor(advancedCandidates.length * 0.6),
    );

    selectByQuota(midRangeCandidates, selection, usedKeys, 8, (candidate) => candidate.solution.usesDivision);
    selectByQuota(midRangeCandidates, selection, usedKeys, 14, (candidate) => candidate.solution.imbalance >= 2);
    fillSelection(midRangeCandidates, selection, usedKeys, 20);
    fillSelection(advancedCandidates, selection, usedKeys, 20);

    return selection.slice(0, 20);
}

function selectChallengeLevels(challengeCandidates, usedKeys) {
    const selection = [];

    selectByQuota(challengeCandidates, selection, usedKeys, 6, (candidate) => candidate.solution.fractionCount > 0);
    selectByQuota(challengeCandidates, selection, usedKeys, 10, (candidate) => candidate.solution.negativeCount > 0);
    selectByQuota(challengeCandidates, selection, usedKeys, 16, (candidate) => candidate.solution.usesDivision);
    fillSelection(challengeCandidates, selection, usedKeys, 20);

    return selection.slice(0, 20);
}

function buildChapterConfig(chapterId, chapterName, levels) {
    return {
        chapterId,
        chapterName,
        levels: levels.map((candidate, index) => ({
            id: chapterId * 100 + index + 1,
            chapterId,
            numbers: candidate.numbers,
            answerExpression: candidate.answerExpression,
        })),
    };
}

function writeJson(fileName, payload) {
    const fullPath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function summarize(name, levels) {
    const divisionCount = levels.filter((candidate) => candidate.solution.usesDivision).length;
    const subtractionCount = levels.filter((candidate) => candidate.solution.usesSubtraction).length;
    const fractionCount = levels.filter((candidate) => candidate.solution.fractionCount > 0).length;
    const negativeCount = levels.filter((candidate) => candidate.solution.negativeCount > 0).length;

    console.log(`${name}: ${levels.length} levels`);
    console.log(
        `  division=${divisionCount}, subtraction=${subtractionCount}, fraction=${fractionCount}, negative=${negativeCount}`,
    );
    console.log(
        `  sample=${levels
            .slice(0, 3)
            .map((candidate) => `[${candidate.numbers.join(', ')}] ${candidate.answerExpression}`)
            .join(' | ')}`,
    );
}

function assertLevelCount(name, levels, expectedCount) {
    if (levels.length !== expectedCount) {
        throw new Error(`${name} expected ${expectedCount} levels, got ${levels.length}`);
    }
}

function run() {
    const { beginnerCandidates, advancedCandidates, challengeCandidates } = analyzeCandidates();
    const usedKeys = new Set();

    const beginnerLevels = selectBeginnerLevels(beginnerCandidates, usedKeys);
    const advancedLevels = selectAdvancedLevels(advancedCandidates, usedKeys);
    const challengeLevels = selectChallengeLevels(challengeCandidates, usedKeys);

    assertLevelCount('beginner', beginnerLevels, 20);
    assertLevelCount('advanced', advancedLevels, 20);
    assertLevelCount('challenge', challengeLevels, 20);

    writeJson('chapter_01.json', buildChapterConfig(1, 'beginner', beginnerLevels));
    writeJson('chapter_02.json', buildChapterConfig(2, 'advanced', advancedLevels));
    writeJson('chapter_03.json', buildChapterConfig(3, 'challenge', challengeLevels));

    summarize('chapter_01', beginnerLevels);
    summarize('chapter_02', advancedLevels);
    summarize('chapter_03', challengeLevels);
}

run();
