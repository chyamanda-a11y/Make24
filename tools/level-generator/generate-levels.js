const fs = require('fs');
const path = require('path');
const {
    GOAL_VALUE,
    analyzeNumbers,
    createNumbersKey,
    getPhaseMatchReasons,
} = require('./level-analysis');

const OUTPUT_DIR = path.resolve(__dirname, '../../assets/resources/config/levels');
const CHAPTER_DEFINITIONS = [
    {
        chapterId: 1,
        chapterName: 'beginner',
        fileName: 'chapter_01.json',
        phases: [
            {
                phaseId: 'novice-a',
                count: 12,
                targetDifficulty: 3,
                targetSteps: 2,
                preferFamilies: ['make-8-then-times-3', 'make-6-then-times-4', 'other'],
                preferTags: ['凑8', '凑6'],
            },
            {
                phaseId: 'novice-b',
                count: 12,
                targetDifficulty: 4,
                targetSteps: 2,
                preferFamilies: ['hidden-anchor', 'other'],
                preferTags: ['隐藏中间值', '中间值训练'],
            },
            {
                phaseId: 'novice-c',
                count: 12,
                targetDifficulty: 5,
                targetSteps: 3,
                preferFamilies: ['hidden-anchor', 'divide-then-combine', 'other'],
                preferTags: ['补差值', '简单整除'],
                preferDivision: true,
            },
        ],
    },
    {
        chapterId: 2,
        chapterName: 'advanced',
        fileName: 'chapter_02.json',
        phases: [
            {
                phaseId: 'advanced-a',
                count: 12,
                targetDifficulty: 5,
                targetSteps: 2,
                preferFamilies: ['hidden-anchor', 'divide-then-combine', 'other'],
                preferTags: ['补差值', '中间值训练'],
            },
            {
                phaseId: 'advanced-b',
                count: 12,
                targetDifficulty: 7,
                targetSteps: 3,
                preferFamilies: ['order-sensitive', 'hidden-anchor'],
                preferTags: ['顺序意识'],
            },
            {
                phaseId: 'advanced-c',
                count: 12,
                targetDifficulty: 7,
                targetSteps: 3,
                preferFamilies: ['hidden-anchor', 'order-sensitive', 'divide-then-combine'],
                preferTags: ['隐藏中间值', '顺序意识'],
            },
        ],
    },
    {
        chapterId: 3,
        chapterName: 'challenge',
        fileName: 'chapter_03.json',
        phases: [
            {
                phaseId: 'challenge-a',
                count: 12,
                targetDifficulty: 6,
                targetSteps: 3,
                preferFamilies: ['hidden-anchor', 'order-sensitive', 'other'],
                preferTags: ['补差值', '中间值训练'],
                forbidFractions: true,
            },
            {
                phaseId: 'challenge-b',
                count: 12,
                targetDifficulty: 8,
                targetSteps: 3,
                preferFamilies: ['order-sensitive', 'fraction-driven', 'divide-then-combine'],
                preferTags: ['顺序意识', '分数驱动'],
                quotas: [
                    {
                        count: 4,
                        predicate: (candidate) => candidate.hasFraction,
                    },
                ],
            },
            {
                phaseId: 'challenge-c',
                count: 12,
                targetDifficulty: 8,
                targetSteps: 3,
                preferFamilies: ['order-sensitive', 'fraction-driven', 'hidden-anchor'],
                preferTags: ['顺序意识', '分数驱动'],
                quotas: [
                    {
                        count: 1,
                        predicate: (candidate) => candidate.hasFraction,
                    },
                ],
            },
        ],
    },
];

const PHASE_DEFINITIONS = CHAPTER_DEFINITIONS.flatMap((chapter) =>
    chapter.phases.map((phase) => ({
        ...phase,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        fileName: chapter.fileName,
    })),
);

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

function getPhaseDefinition(phaseId) {
    return PHASE_DEFINITIONS.find((phase) => phase.phaseId === phaseId) ?? null;
}

function isExtraPhaseCompatible(phaseId, candidate) {
    if (phaseId.startsWith('novice-') || phaseId.startsWith('advanced-')) {
        return candidate.hasFraction === false;
    }

    if (phaseId === 'challenge-a') {
        return candidate.hasFraction === false;
    }

    return true;
}

function scoreCandidateForPhase(phaseId, candidate) {
    const phase = getPhaseDefinition(phaseId);

    if (!phase) {
        return Number.MAX_SAFE_INTEGER;
    }

    let score =
        Math.abs(candidate.difficulty - phase.targetDifficulty) * 12 +
        Math.abs(candidate.estimatedSteps - phase.targetSteps) * 5 +
        candidate.answerExpression.length / 1000;

    if (Array.isArray(phase.preferFamilies) && phase.preferFamilies.includes(candidate.structureFamily)) {
        score -= 4;
    }

    if (Array.isArray(phase.preferTags)) {
        score -= candidate.teachingTags.filter((tag) => phase.preferTags.includes(tag)).length * 2;
    }

    if (phase.preferDivision && !candidate.allowDivision) {
        score += 6;
    }

    if (!phase.preferDivision && candidate.allowDivision) {
        score += 2;
    }

    if (phase.forbidFractions && candidate.hasFraction) {
        score += 20;
    }

    if (phase.phaseId === 'challenge-b' && candidate.hasFraction) {
        score -= 6;
    }

    if (phase.phaseId === 'challenge-c' && candidate.hasFraction) {
        score -= 3;
    }

    return score;
}

function createCandidate(numbers, phaseId, analysis) {
    const dominantSolution = analysis.dominantSolution;

    if (!dominantSolution) {
        return null;
    }

    const teachingTags = dominantSolution.dominantTags.length > 0
        ? dominantSolution.dominantTags
        : ['中间值训练'];

    const candidate = {
        key: createNumbersKey(numbers),
        numbers,
        phaseId,
        answerExpression: dominantSolution.answerExpression,
        intendedSolution: dominantSolution.answerExpression,
        keyIdea: dominantSolution.dominantKeyIdea,
        difficulty: dominantSolution.dominantDifficulty,
        allowDivision: dominantSolution.usesDivision,
        hasFraction: dominantSolution.fractionCount > 0,
        estimatedSteps: dominantSolution.estimatedSteps,
        teachingTags,
        structureFamily: dominantSolution.structureFamily,
        solution: dominantSolution,
        allSolutionCount: analysis.allSolutionCount,
    };

    candidate.score = scoreCandidateForPhase(phaseId, candidate);
    return candidate;
}

function analyzeCandidates() {
    const tuples = generateSortedTuples(1, 13, 4);
    const phaseCandidates = new Map(PHASE_DEFINITIONS.map((phase) => [phase.phaseId, []]));

    for (const numbers of tuples) {
        const analysis = analyzeNumbers(numbers);

        if (!analysis.dominantSolution) {
            continue;
        }

        for (const phase of PHASE_DEFINITIONS) {
            const phaseMismatchReasons = getPhaseMatchReasons(phase.phaseId, analysis.dominantSolution);

            if (phaseMismatchReasons.length > 0) {
                continue;
            }

            const candidate = createCandidate(numbers, phase.phaseId, analysis);

            if (!candidate || !isExtraPhaseCompatible(phase.phaseId, candidate)) {
                continue;
            }

            phaseCandidates.get(phase.phaseId).push(candidate);
        }
    }

    for (const candidates of phaseCandidates.values()) {
        candidates.sort((left, right) => {
            const scoreGap = left.score - right.score;

            if (scoreGap !== 0) {
                return scoreGap;
            }

            return left.key.localeCompare(right.key);
        });
    }

    return phaseCandidates;
}

function buildPhaseCandidateIndex(phaseCandidates) {
    const phaseIndex = new Map();

    for (const [phaseId, candidates] of phaseCandidates.entries()) {
        phaseIndex.set(
            phaseId,
            new Map(candidates.map((candidate) => [candidate.key, candidate])),
        );
    }

    return phaseIndex;
}

function loadChapterConfig(fileName) {
    const fullPath = path.join(OUTPUT_DIR, fileName);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function resolveExistingPhaseSelection(existingLevels, phaseCandidateIndex, chapterName, phaseId) {
    return existingLevels.reduce((selection, level, index) => {
        const key = createNumbersKey(level.numbers);
        const candidate = phaseCandidateIndex.get(key);

        if (!candidate) {
            console.warn(
                `${chapterName} ${phaseId} existing level ${index + 1} with key ${key} is no longer in candidate pool and will be replaced`,
            );
            return selection;
        }

        selection.push(candidate);
        return selection;
    }, []);
}

function seedSelection(initialSelection, usedKeys, chapterName, phaseId) {
    const selection = [];

    for (const candidate of initialSelection) {
        if (usedKeys.has(candidate.key)) {
            console.warn(
                `${chapterName} ${phaseId} locked selection key ${candidate.key} conflicts with another kept level and will be replaced`,
            );
            continue;
        }

        usedKeys.add(candidate.key);
        selection.push(candidate);
    }

    return selection;
}

function wouldRepeatKeyIdea(selection, candidate) {
    return (
        selection.length >= 2 &&
        selection[selection.length - 1].keyIdea === candidate.keyIdea &&
        selection[selection.length - 2].keyIdea === candidate.keyIdea
    );
}

function pickCandidates(candidates, selection, usedKeys, count, predicate = () => true) {
    for (const candidate of candidates) {
        if (selection.length >= count) {
            return;
        }

        if (usedKeys.has(candidate.key) || !predicate(candidate)) {
            continue;
        }

        if (wouldRepeatKeyIdea(selection, candidate)) {
            continue;
        }

        usedKeys.add(candidate.key);
        selection.push(candidate);
    }

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

function rebalanceKeyIdeaRuns(levels, maxRunLength = 2) {
    const reorderedLevels = [...levels];

    for (let index = maxRunLength; index < reorderedLevels.length; index += 1) {
        const repeatedKeyIdea = reorderedLevels[index].keyIdea;

        if (
            repeatedKeyIdea !== reorderedLevels[index - 1].keyIdea
            || repeatedKeyIdea !== reorderedLevels[index - 2].keyIdea
        ) {
            continue;
        }

        const swapIndex = reorderedLevels.findIndex(
            (candidate, candidateIndex) => candidateIndex > index && candidate.keyIdea !== repeatedKeyIdea,
        );

        if (swapIndex < 0) {
            continue;
        }

        const [replacementCandidate] = reorderedLevels.splice(swapIndex, 1);

        reorderedLevels.splice(index, 0, replacementCandidate);
    }

    return reorderedLevels;
}

function selectPhaseLevels(phaseConfig, phaseCandidates, phaseCandidateIndex, usedKeys, existingLevels, chapterName) {
    const initialSelection = resolveExistingPhaseSelection(
        existingLevels,
        phaseCandidateIndex,
        chapterName,
        phaseConfig.phaseId,
    );
    const selection = seedSelection(initialSelection, usedKeys, chapterName, phaseConfig.phaseId);

    if (Array.isArray(phaseConfig.quotas)) {
        for (const quota of phaseConfig.quotas) {
            pickCandidates(phaseCandidates, selection, usedKeys, quota.count, quota.predicate);
        }
    }

    pickCandidates(phaseCandidates, selection, usedKeys, phaseConfig.count);

    if (selection.length !== phaseConfig.count) {
        throw new Error(
            `${chapterName} ${phaseConfig.phaseId} expected ${phaseConfig.count} levels, got ${selection.length}`,
        );
    }

    return rebalanceKeyIdeaRuns(selection);
}

function buildLevelRecord(chapterId, index, candidate) {
    return {
        id: chapterId * 100 + index + 1,
        chapterId,
        numbers: candidate.numbers,
        target: GOAL_VALUE,
        answerExpression: candidate.answerExpression,
        intendedSolution: candidate.intendedSolution,
        keyIdea: candidate.keyIdea,
        difficulty: candidate.difficulty,
        allowDivision: candidate.allowDivision,
        hasFraction: candidate.hasFraction,
        estimatedSteps: candidate.estimatedSteps,
        teachingTags: candidate.teachingTags,
        phaseId: candidate.phaseId,
    };
}

function buildChapterConfig(chapterDefinition, levels) {
    return {
        chapterId: chapterDefinition.chapterId,
        chapterName: chapterDefinition.chapterName,
        levels: levels.map((candidate, index) => buildLevelRecord(chapterDefinition.chapterId, index, candidate)),
    };
}

function writeJson(fileName, payload) {
    const fullPath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function summarizeChapter(chapterDefinition, levels) {
    const divisionCount = levels.filter((level) => level.allowDivision).length;
    const fractionCount = levels.filter((level) => level.hasFraction).length;
    const phaseSummary = levels.reduce((result, level) => {
        result[level.phaseId] = (result[level.phaseId] ?? 0) + 1;
        return result;
    }, {});

    console.log(`${chapterDefinition.fileName}: ${levels.length} levels`);
    console.log(`  division=${divisionCount}, fraction=${fractionCount}`);
    console.log(`  phases=${JSON.stringify(phaseSummary)}`);
}

function seedUsedKeysFromLockedChapters(existingConfigs, selectedChapterIds, usedKeys) {
    if (!selectedChapterIds) {
        return;
    }

    existingConfigs.forEach((config, chapterId) => {
        if (selectedChapterIds.has(chapterId)) {
            return;
        }

        config.levels.forEach((level) => {
            usedKeys.add(createNumbersKey(level.numbers));
        });
    });
}

function run() {
    const requestedChapterIds = parseRequestedChapterIds(process.argv.slice(2));
    const selectedChapterDefinitions = requestedChapterIds
        ? CHAPTER_DEFINITIONS.filter((definition) => requestedChapterIds.has(definition.chapterId))
        : CHAPTER_DEFINITIONS;

    if (requestedChapterIds && selectedChapterDefinitions.length !== requestedChapterIds.size) {
        const knownChapterIds = CHAPTER_DEFINITIONS.map((definition) => definition.chapterId).join(', ');
        throw new Error(`Unknown chapter id in --chapter. Known chapter ids: ${knownChapterIds}`);
    }

    const phaseCandidates = analyzeCandidates();
    const phaseCandidateIndex = buildPhaseCandidateIndex(phaseCandidates);
    const existingConfigs = new Map(
        CHAPTER_DEFINITIONS.map((definition) => [definition.chapterId, loadChapterConfig(definition.fileName)]),
    );
    const usedKeys = new Set();
    const selectedChapterIds = requestedChapterIds ?? null;

    seedUsedKeysFromLockedChapters(existingConfigs, selectedChapterIds, usedKeys);

    for (const chapterDefinition of selectedChapterDefinitions) {
        const existingConfig = existingConfigs.get(chapterDefinition.chapterId);
        const selectedLevels = [];

        for (const phaseConfig of chapterDefinition.phases) {
            const phaseCandidatesForSelection = phaseCandidates.get(phaseConfig.phaseId) ?? [];
            const phaseCandidateMap = phaseCandidateIndex.get(phaseConfig.phaseId) ?? new Map();
            const existingPhaseLevels = existingConfig.levels.filter((level) => level.phaseId === phaseConfig.phaseId);
            const phaseLevels = selectPhaseLevels(
                phaseConfig,
                phaseCandidatesForSelection,
                phaseCandidateMap,
                usedKeys,
                existingPhaseLevels,
                chapterDefinition.chapterName,
            );

            selectedLevels.push(...phaseLevels);
        }

        const nextConfig = buildChapterConfig(chapterDefinition, selectedLevels);
        writeJson(chapterDefinition.fileName, nextConfig);
        summarizeChapter(chapterDefinition, nextConfig.levels);
    }
}

run();
