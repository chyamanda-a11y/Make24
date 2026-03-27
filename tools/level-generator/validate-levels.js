const fs = require('fs');
const path = require('path');
const { GOAL_VALUE, analyzeLevel, createNumbersKey } = require('./level-analysis');

const CONFIG_DIR = path.resolve(__dirname, '../../assets/resources/config/levels');
const CONFIG_FILES = ['chapter_01.json', 'chapter_02.json', 'chapter_03.json'];
const DOMINANT_VALIDATION_CHAPTER_IDS = new Set([1, 2, 3]);
const STRUCTURED_CHAPTER_RULES = {
    1: {
        requiredLevelCount: 36,
        requiredPhaseCounts: {
            'novice-a': 12,
            'novice-b': 12,
            'novice-c': 12,
        },
        forbidFractions: true,
        forbidDivisionPhases: ['novice-a'],
    },
    2: {
        requiredLevelCount: 36,
        requiredPhaseCounts: {
            'advanced-a': 12,
            'advanced-b': 12,
            'advanced-c': 12,
        },
        forbidFractions: true,
        forbidDivisionPhases: [],
        phaseMinFakeAnchorTrapCounts: {
            'advanced-b': 4,
            'advanced-c': 6,
        },
    },
    3: {
        requiredLevelCount: 36,
        requiredPhaseCounts: {
            'challenge-a': 12,
            'challenge-b': 12,
            'challenge-c': 12,
        },
        forbidDivisionPhases: [],
        forbidFractionsInPhases: ['challenge-a'],
        minFractionCount: 10,
        phaseMinFractionCounts: {
            'challenge-b': 5,
            'challenge-c': 5,
        },
        phaseMaxSolutionCounts: {
            'challenge-b': 4,
            'challenge-c': 2,
        },
    },
};

function parseRequestedChapterIds(rawArgs) {
    const requestedChapterIds = new Set();

    for (let index = 0; index < rawArgs.length; index += 1) {
        if (rawArgs[index] !== '--chapter') {
            continue;
        }

        const rawValue = rawArgs[index + 1] ?? '';

        if (rawValue.trim().length === 0) {
            throw new Error('Missing chapter id after --chapter');
        }

        rawValue.split(',').forEach((rawChapterId) => {
            const chapterId = Number(rawChapterId.trim());

            if (!Number.isInteger(chapterId) || chapterId < 1) {
                throw new Error(`Invalid chapter id "${rawChapterId}"`);
            }

            requestedChapterIds.add(chapterId);
        });
        index += 1;
    }

    if (requestedChapterIds.size === 0) {
        return null;
    }

    return requestedChapterIds;
}

function createRational(numerator, denominator = 1) {
    if (denominator === 0) {
        throw new Error('Division by zero');
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
        throw new Error('Division by zero');
    }

    return createRational(
        left.numerator * right.denominator,
        left.denominator * right.numerator,
    );
}

function tokenize(expression) {
    const tokens = [];
    const pattern = /\s*(\d+|[()+\-*/])\s*/g;
    let match = pattern.exec(expression);

    while (match) {
        tokens.push(match[1]);
        match = pattern.exec(expression);
    }

    if (tokens.join('') !== expression.replace(/\s+/g, '')) {
        throw new Error(`Unsupported token in expression: ${expression}`);
    }

    return tokens;
}

function evaluateExpression(expression) {
    const tokens = tokenize(expression);
    let currentIndex = 0;

    function parseExpression() {
        let value = parseTerm();

        while (tokens[currentIndex] === '+' || tokens[currentIndex] === '-') {
            const operator = tokens[currentIndex];
            currentIndex += 1;
            const rightValue = parseTerm();

            value = operator === '+'
                ? add(value, rightValue)
                : subtract(value, rightValue);
        }

        return value;
    }

    function parseTerm() {
        let value = parseFactor();

        while (tokens[currentIndex] === '*' || tokens[currentIndex] === '/') {
            const operator = tokens[currentIndex];
            currentIndex += 1;
            const rightValue = parseFactor();

            value = operator === '*'
                ? multiply(value, rightValue)
                : divide(value, rightValue);
        }

        return value;
    }

    function parseFactor() {
        const token = tokens[currentIndex];

        if (token === '(') {
            currentIndex += 1;
            const value = parseExpression();

            if (tokens[currentIndex] !== ')') {
                throw new Error(`Missing closing parenthesis in expression: ${expression}`);
            }

            currentIndex += 1;
            return value;
        }

        if (!/^\d+$/.test(token ?? '')) {
            throw new Error(`Expected number in expression: ${expression}`);
        }

        currentIndex += 1;
        return createRational(Number(token), 1);
    }

    const value = parseExpression();

    if (currentIndex !== tokens.length) {
        throw new Error(`Unexpected trailing tokens in expression: ${expression}`);
    }

    return value;
}

function compareNumbersInExpression(level) {
    const expressionNumbers = (level.answerExpression.match(/\d+/g) ?? []).map(Number).sort((left, right) => left - right);
    const levelNumbers = [...level.numbers].sort((left, right) => left - right);

    return expressionNumbers.length === levelNumbers.length
        && expressionNumbers.every((value, index) => value === levelNumbers[index]);
}

function validateLevel(level, config, levelIndex, errors) {
    if (!Number.isInteger(level.id) || level.id < 1) {
        errors.push(`${config.chapterName} level[${levelIndex}] id must be a positive integer`);
    }

    if (level.chapterId !== config.chapterId) {
        errors.push(`${config.chapterName} level[${levelIndex}] chapterId does not match config chapterId`);
    }

    if (!Array.isArray(level.numbers) || level.numbers.length !== 4 || level.numbers.some((value) => !Number.isInteger(value) || value < 1)) {
        errors.push(`${config.chapterName} level[${levelIndex}] numbers must contain 4 positive integers`);
    }

    if (typeof level.answerExpression !== 'string' || level.answerExpression.trim().length === 0) {
        errors.push(`${config.chapterName} level[${levelIndex}] answerExpression must be a non-empty string`);
        return;
    }

    try {
        const result = evaluateExpression(level.answerExpression);

        if (result.numerator !== GOAL_VALUE * result.denominator) {
            errors.push(`${config.chapterName} level[${levelIndex}] answerExpression does not equal 24`);
        }
    } catch (error) {
        errors.push(`${config.chapterName} level[${levelIndex}] expression error: ${error.message}`);
    }

    if (!compareNumbersInExpression(level)) {
        errors.push(`${config.chapterName} level[${levelIndex}] answerExpression does not use exactly the configured numbers`);
    }

    if (!STRUCTURED_CHAPTER_RULES[config.chapterId]) {
        return;
    }

    validateStructuredMetadata(level, config.chapterId, levelIndex, errors);
    validateDominantSolution(level, config.chapterId, levelIndex, errors);
}

function validateStructuredMetadata(level, chapterId, levelIndex, errors) {
    const requiredFields = [
        'target',
        'intendedSolution',
        'keyIdea',
        'difficulty',
        'allowDivision',
        'hasFraction',
        'estimatedSteps',
        'teachingTags',
        'phaseId',
    ];

    requiredFields.forEach((fieldName) => {
        if (level[fieldName] === undefined) {
            errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] missing required field ${fieldName}`);
        }
    });

    if (level.target !== GOAL_VALUE) {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] target must be 24`);
    }

    if (typeof level.intendedSolution !== 'string' || level.intendedSolution.trim().length === 0) {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] intendedSolution must be a non-empty string`);
    }

    if (typeof level.keyIdea !== 'string' || level.keyIdea.trim().length === 0) {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] keyIdea must be a non-empty string`);
    }

    if (!Number.isInteger(level.difficulty) || level.difficulty < 1 || level.difficulty > 9) {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] difficulty must be an integer between 1 and 9`);
    }

    if (typeof level.allowDivision !== 'boolean') {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] allowDivision must be a boolean`);
    }

    if (typeof level.hasFraction !== 'boolean') {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] hasFraction must be a boolean`);
    }

    if (!Number.isInteger(level.estimatedSteps) || level.estimatedSteps < 1 || level.estimatedSteps > 3) {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] estimatedSteps must be an integer between 1 and 3`);
    }

    if (!Array.isArray(level.teachingTags) || level.teachingTags.length === 0 || level.teachingTags.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] teachingTags must be a non-empty string array`);
    }

    const chapterRules = STRUCTURED_CHAPTER_RULES[chapterId];
    const requiredPhaseCounts = chapterRules.requiredPhaseCounts;

    if (!Object.prototype.hasOwnProperty.call(requiredPhaseCounts, level.phaseId)) {
        errors.push(
            `chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] phaseId must be one of ${Object.keys(requiredPhaseCounts).join(', ')}`,
        );
    }

    if (level.answerExpression.includes('/') && level.allowDivision !== true) {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] uses division in answerExpression but allowDivision is false`);
    }
}

function validateStructuredChapter(config, errors) {
    const chapterRules = STRUCTURED_CHAPTER_RULES[config.chapterId];

    if (!chapterRules) {
        return;
    }

    if (config.levels.length !== chapterRules.requiredLevelCount) {
        errors.push(`chapter_${String(config.chapterId).padStart(2, '0')} must contain exactly ${chapterRules.requiredLevelCount} levels, got ${config.levels.length}`);
    }

    const phaseCounts = config.levels.reduce((result, level) => {
        if (typeof level.phaseId === 'string') {
            result[level.phaseId] = (result[level.phaseId] ?? 0) + 1;
        }

        return result;
    }, {});

    Object.entries(chapterRules.requiredPhaseCounts).forEach(([phaseId, expectedCount]) => {
        const actualCount = phaseCounts[phaseId] ?? 0;

        if (actualCount !== expectedCount) {
            errors.push(`chapter_${String(config.chapterId).padStart(2, '0')} phase ${phaseId} expected ${expectedCount} levels, got ${actualCount}`);
        }
    });

    const analyzedLevels = config.levels.map((level) => ({
        level,
        analysis: analyzeLevel(level),
    }));

    chapterRules.forbidDivisionPhases.forEach((phaseId) => {
        const phaseLevels = config.levels.filter((level) => level.phaseId === phaseId);

        if (phaseLevels.some((level) => level.allowDivision)) {
            errors.push(`chapter_${String(config.chapterId).padStart(2, '0')} ${phaseId} should not allow division`);
        }
    });

    if (chapterRules.forbidFractions && config.levels.some((level) => level.hasFraction)) {
        errors.push(`chapter_${String(config.chapterId).padStart(2, '0')} should not contain fraction-tagged levels`);
    }

    const fractionLevels = config.levels.filter((level) => level.hasFraction);

    if (Array.isArray(chapterRules.forbidFractionsInPhases)) {
        chapterRules.forbidFractionsInPhases.forEach((phaseId) => {
            const phaseFractionCount = config.levels.filter((level) => level.phaseId === phaseId && level.hasFraction).length;

            if (phaseFractionCount > 0) {
                errors.push(`chapter_${String(config.chapterId).padStart(2, '0')} ${phaseId} should not contain fraction-tagged levels`);
            }
        });
    }

    if (typeof chapterRules.minFractionCount === 'number' && fractionLevels.length < chapterRules.minFractionCount) {
        errors.push(
            `chapter_${String(config.chapterId).padStart(2, '0')} should contain at least ${chapterRules.minFractionCount} fraction-tagged levels, got ${fractionLevels.length}`,
        );
    }

    if (chapterRules.phaseMinFractionCounts) {
        Object.entries(chapterRules.phaseMinFractionCounts).forEach(([phaseId, expectedCount]) => {
            const phaseFractionCount = config.levels.filter((level) => level.phaseId === phaseId && level.hasFraction).length;

            if (phaseFractionCount < expectedCount) {
                errors.push(
                    `chapter_${String(config.chapterId).padStart(2, '0')} ${phaseId} should contain at least ${expectedCount} fraction-tagged levels, got ${phaseFractionCount}`,
                );
            }
        });
    }

    if (typeof chapterRules.maxFractionCount === 'number' && fractionLevels.length > chapterRules.maxFractionCount) {
        errors.push(
            `chapter_${String(config.chapterId).padStart(2, '0')} should contain at most ${chapterRules.maxFractionCount} fraction-tagged levels, got ${fractionLevels.length}`,
        );
    }

    if (chapterRules.forbidConsecutiveFractions) {
        for (let index = 1; index < config.levels.length; index += 1) {
            if (config.levels[index].hasFraction && config.levels[index - 1].hasFraction) {
                errors.push(`chapter_${String(config.chapterId).padStart(2, '0')} should not contain consecutive fraction-tagged levels`);
                break;
            }
        }
    }

    if (typeof chapterRules.fractionWindowSize === 'number' && typeof chapterRules.maxFractionsPerWindow === 'number') {
        for (let startIndex = 0; startIndex <= config.levels.length - chapterRules.fractionWindowSize; startIndex += 1) {
            const windowLevels = config.levels.slice(startIndex, startIndex + chapterRules.fractionWindowSize);
            const windowFractionCount = windowLevels.filter((level) => level.hasFraction).length;

            if (windowFractionCount > chapterRules.maxFractionsPerWindow) {
                errors.push(
                    `chapter_${String(config.chapterId).padStart(2, '0')} has ${windowFractionCount} fraction-tagged levels within levels ${startIndex + 1}-${startIndex + chapterRules.fractionWindowSize}`,
                );
                break;
            }
        }
    }

    if (chapterRules.phaseMinFakeAnchorTrapCounts) {
        Object.entries(chapterRules.phaseMinFakeAnchorTrapCounts).forEach(([phaseId, expectedCount]) => {
            const fakeAnchorTrapCount = analyzedLevels.filter(({ level, analysis }) =>
                level.phaseId === phaseId
                && analysis.dominantSolution
                && analysis.dominantSolution.isFakeAnchorTrap,
            ).length;

            if (fakeAnchorTrapCount < expectedCount) {
                errors.push(
                    `chapter_${String(config.chapterId).padStart(2, '0')} ${phaseId} should contain at least ${expectedCount} fake-anchor levels, got ${fakeAnchorTrapCount}`,
                );
            }
        });
    }

    if (chapterRules.phaseMaxSolutionCounts) {
        Object.entries(chapterRules.phaseMaxSolutionCounts).forEach(([phaseId, maxSolutionCount]) => {
            const offendingLevel = analyzedLevels.find(({ level, analysis }) =>
                level.phaseId === phaseId && analysis.allSolutionCount > maxSolutionCount,
            );

            if (offendingLevel) {
                errors.push(
                    `chapter_${String(config.chapterId).padStart(2, '0')} ${phaseId} should keep allSolutionCount <= ${maxSolutionCount}, found ${offendingLevel.analysis.allSolutionCount} on level id ${offendingLevel.level.id}`,
                );
            }
        });
    }

    let sameIdeaRunLength = 1;

    for (let index = 1; index < config.levels.length; index += 1) {
        if (config.levels[index].keyIdea === config.levels[index - 1].keyIdea) {
            sameIdeaRunLength += 1;

            if (sameIdeaRunLength > 2) {
                errors.push(`chapter_${String(config.chapterId).padStart(2, '0')} repeats keyIdea more than twice in a row near level ${index + 1}`);
                break;
            }
        } else {
            sameIdeaRunLength = 1;
        }
    }
}

function validateDominantSolution(level, chapterId, levelIndex, errors) {
    if (!DOMINANT_VALIDATION_CHAPTER_IDS.has(chapterId)) {
        return;
    }

    const analysis = analyzeLevel(level);

    if (analysis.rejectReasons.includes('NO_LEGAL_SOLUTION')) {
        errors.push(`chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] has no legal solution`);
        return;
    }

    if (analysis.rejectReasons.includes('NON_DOMINANT_ANSWER_EXPRESSION')) {
        errors.push(
            `chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] answerExpression is not dominantSolution: ${analysis.dominantSolution.answerExpression}`,
        );
    }

    if (analysis.rejectReasons.includes('NON_DOMINANT_INTENDED_SOLUTION')) {
        errors.push(
            `chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] intendedSolution is not dominantSolution: ${analysis.dominantSolution.answerExpression}`,
        );
    }

    if (analysis.alternativeIssue) {
        errors.push(
            `chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] has simpler alternative family ${analysis.runnerUpSolution?.structureFamily ?? 'unknown'} competing with dominantSolution`,
        );
    }

    if (analysis.phaseMismatchReasons.length > 0) {
        errors.push(
            `chapter_${String(chapterId).padStart(2, '0')} level[${levelIndex}] dominantSolution ${analysis.dominantSolution.answerExpression} mismatches phase ${level.phaseId}: ${analysis.phaseMismatchReasons.join('; ')}`,
        );
    }
}

function loadConfig(fileName) {
    const fullPath = path.join(CONFIG_DIR, fileName);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function validateGlobalNumbersUniqueness(configs, errors) {
    const seenNumbersKeys = new Map();

    configs.forEach((config) => {
        config.levels.forEach((level, levelIndex) => {
            if (!Array.isArray(level.numbers) || level.numbers.length !== 4) {
                return;
            }

            const numbersKey = createNumbersKey(level.numbers);
            const existingLevel = seenNumbersKeys.get(numbersKey);

            if (existingLevel) {
                errors.push(
                    `duplicate numbersKey ${numbersKey} at chapter_${String(config.chapterId).padStart(2, '0')} level[${levelIndex}] also seen in chapter_${String(existingLevel.chapterId).padStart(2, '0')} level[${existingLevel.levelIndex}]`,
                );
                return;
            }

            seenNumbersKeys.set(numbersKey, {
                chapterId: config.chapterId,
                levelIndex,
            });
        });
    });
}

function summarizeConfig(config) {
    const divisionCount = config.levels.filter((level) => level.answerExpression.includes('/')).length;
    const fractionCount = config.levels.filter((level) => level.hasFraction === true).length;
    const phaseSummary = config.levels.reduce((result, level) => {
        if (typeof level.phaseId !== 'string') {
            return result;
        }

        result[level.phaseId] = (result[level.phaseId] ?? 0) + 1;
        return result;
    }, {});

    console.log(`${config.chapterName}: ${config.levels.length} levels, division=${divisionCount}, taggedFraction=${fractionCount}`);

    if (Object.keys(phaseSummary).length > 0) {
        console.log(`  phases=${JSON.stringify(phaseSummary)}`);
    }
}

function run() {
    const requestedChapterIds = parseRequestedChapterIds(process.argv.slice(2));
    const errors = [];
    const configs = CONFIG_FILES.map((fileName) => ({
        fileName,
        config: loadConfig(fileName),
    }));
    const selectedConfigs = requestedChapterIds
        ? configs.filter(({ config }) => requestedChapterIds.has(config.chapterId))
        : configs;

    if (requestedChapterIds && selectedConfigs.length !== requestedChapterIds.size) {
        const knownChapterIds = configs.map(({ config }) => config.chapterId).join(', ');
        throw new Error(`Unknown chapter id in --chapter. Known chapter ids: ${knownChapterIds}`);
    }

    selectedConfigs.forEach(({ fileName, config }) => {

        if (!Number.isInteger(config.chapterId) || config.chapterId < 1) {
            errors.push(`${fileName} chapterId must be a positive integer`);
            return;
        }

        if (typeof config.chapterName !== 'string' || config.chapterName.trim().length === 0) {
            errors.push(`${fileName} chapterName must be a non-empty string`);
            return;
        }

        if (!Array.isArray(config.levels)) {
            errors.push(`${fileName} levels must be an array`);
            return;
        }

        const levelIds = new Set();

        config.levels.forEach((level, levelIndex) => {
            if (levelIds.has(level.id)) {
                errors.push(`${fileName} contains duplicate level id ${level.id}`);
            }

            levelIds.add(level.id);
            validateLevel(level, config, levelIndex, errors);
        });

        validateStructuredChapter(config, errors);

        summarizeConfig(config);
    });

    validateGlobalNumbersUniqueness(configs.map(({ config }) => config), errors);

    if (errors.length > 0) {
        console.error('Level validation failed:');
        errors.forEach((message) => {
            console.error(`- ${message}`);
        });
        process.exit(1);
    }

    console.log('Level validation passed.');
}

run();
