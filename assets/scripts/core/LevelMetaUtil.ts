import { LevelModel } from '../model/game/LevelModel';

const PHASE_LABEL_BY_ID: Readonly<Record<string, string>> = {
    'novice-a': '基础入门',
    'novice-b': '凑 6/8/12',
    'novice-c': '顺序准备',
    'advanced-a': '两步思考',
    'advanced-b': '顺序关键',
    'advanced-c': '隐藏路径',
    'challenge-a': '结构挑战',
    'challenge-b': '分数变化',
    'challenge-c': '最终测试',
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

    return `难度${level.difficulty}`;
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
