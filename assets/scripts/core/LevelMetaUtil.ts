import { LevelModel } from '../model/game/LevelModel';

const PHASE_LABEL_BY_ID: Readonly<Record<string, string>> = {
    'novice-a': 'Basics',
    'novice-b': 'Build 6/8/12',
    'novice-c': 'Order Ready',
    'advanced-a': 'Two-Step',
    'advanced-b': 'Order Matters',
    'advanced-c': 'Hidden Path',
    'challenge-a': 'Structure',
    'challenge-b': 'Fraction Twist',
    'challenge-c': 'Final Test',
};

export function getLevelPhaseLabel(phaseId?: string): string | null {
    if (!phaseId) {
        return null;
    }

    return PHASE_LABEL_BY_ID[phaseId] ?? null;
}

export function getLevelDifficultyLabel(level: Pick<LevelModel, 'difficulty'> | null | undefined): string | null {
    if (!level?.difficulty) {
        return null;
    }

    return `D${level.difficulty}`;
}

export function getCompactLevelMetaLabel(
    level: Pick<LevelModel, 'phaseId' | 'difficulty'> | null | undefined,
): string | null {
    const parts = [
        getLevelPhaseLabel(level?.phaseId),
        getLevelDifficultyLabel(level),
    ].filter((value): value is string => value !== null);

    return parts.length > 0 ? parts.join(' · ') : null;
}
