import {
    _decorator,
    Color,
    Component,
    Label,
    Node,
    ScrollView,
    Sprite,
    UITransform,
} from 'cc';

import {
    ChapterController,
    ChapterId,
    ChapterLevelDisplayModel,
} from '../../controller/chapter/ChapterController';
import { ChapterLevelConfig, LevelService } from '../../core/LevelService';
import { SaveService } from '../../core/SaveService';
import { LevelItemRenderData, LevelItemView } from './LevelItemView';

const { ccclass, property } = _decorator;

const COLORS = {
    tabSelectedText: new Color(16, 31, 12, 255),
    tabIdleText: new Color(176, 164, 114, 255),
};

interface ChapterTabView {
    readonly chapterId: ChapterId;
    readonly node: Node;
    readonly selectedBackground: Sprite;
    readonly icon: Sprite;
    readonly label: Label;
}

interface VirtualLevelListMetrics {
    readonly anchorX: number;
    readonly anchorY: number;
    readonly columnCount: number;
    readonly columnStep: number;
    readonly itemHeight: number;
    readonly itemWidth: number;
    readonly leftPadding: number;
    readonly pooledRowCount: number;
    readonly rightPadding: number;
    readonly rowStep: number;
    readonly topPadding: number;
    readonly bottomPadding: number;
    readonly viewportHeight: number;
    readonly viewportWidth: number;
}

export interface ChapterLevelSelection {
    readonly chapterId: ChapterId;
    readonly chapterFileName: string;
    readonly levelId: number;
    readonly levelIndex: number;
}

@ccclass('ChapterView')
export class ChapterView extends Component {
    @property({ type: [Node] })
    private readonly tabButtons: Node[] = [];

    @property(Label)
    private readonly progressValueLabel: Label | null = null;

    @property(Label)
    private readonly progressSuffixLabel: Label | null = null;

    @property(ScrollView)
    private readonly levelListScrollView: ScrollView | null = null;

    @property(Node)
    private readonly levelListContent: Node | null = null;

    @property({ type: [Node] })
    private readonly levelItemNodes: Node[] = [];

    public onLevelSelected: ((selection: ChapterLevelSelection) => void) | null = null;

    private readonly controller: ChapterController = new ChapterController();
    private readonly levelService: LevelService = new LevelService();
    private readonly saveService: SaveService = new SaveService();
    private readonly levelSelections: Map<number, ChapterLevelSelection> = new Map();

    private tabViews: ChapterTabView[] = [];
    private levelItemViews: LevelItemView[] = [];
    private currentLevelDisplayModels: readonly ChapterLevelDisplayModel[] = [];
    private selectedChapterId: ChapterId = 1;
    private renderVersion: number = 0;
    private isInitialized: boolean = false;
    private virtualLevelListMetrics: VirtualLevelListMetrics | null = null;
    private renderedStartRow: number = -1;

    protected onLoad(): void {
        this.validateReferences();
        this.resolveTabViews();
        this.resolveLevelItemViews();
        this.captureVirtualLevelListMetrics();
    }

    protected onEnable(): void {
        this.levelListScrollView?.node.on('scrolling', this.handleLevelListScrolling, this);
    }

    protected onDisable(): void {
        this.levelListScrollView?.node.off('scrolling', this.handleLevelListScrolling, this);
        this.renderedStartRow = -1;
    }

    protected start(): void {
        void this.initialize();
    }

    public refresh(): void {
        if (!this.isInitialized) {
            return;
        }

        void this.renderSelectedChapter();
    }

    private async initialize(): Promise<void> {
        const save = this.saveService.load();

        this.selectedChapterId = this.controller.normalizeChapterId(save.currentChapterId);
        this.isInitialized = true;
        void this.renderSelectedChapter();
    }

    private validateReferences(): void {
        const chapterTabs = this.controller.getChapterTabs();

        if (this.tabButtons.length !== chapterTabs.length) {
            throw new Error(`ChapterView: tabButtons must contain exactly ${chapterTabs.length} nodes`);
        }

        if (!this.progressValueLabel || !this.progressSuffixLabel || !this.levelListScrollView || !this.levelListContent) {
            throw new Error('ChapterView: progress labels, levelListScrollView, or levelListContent are not assigned');
        }

        if (this.levelListScrollView.content !== this.levelListContent) {
            throw new Error('ChapterView: levelListScrollView.content must point to levelListContent');
        }

        if (this.levelItemNodes.length === 0) {
            throw new Error('ChapterView: levelItemNodes must contain at least one LevelItem node');
        }

        if (new Set(this.levelItemNodes).size !== this.levelItemNodes.length) {
            throw new Error('ChapterView: levelItemNodes contains duplicated node references');
        }

        const invalidLevelItemNode = this.levelItemNodes.find((levelItemNode) => !this.isDescendantOf(levelItemNode, this.levelListContent));

        if (invalidLevelItemNode) {
            throw new Error(`ChapterView: levelItemNodes contains node "${invalidLevelItemNode.name}" that is not inside levelListContent`);
        }
    }

    private resolveTabViews(): void {
        const chapterTabs = this.controller.getChapterTabs();

        this.tabViews = chapterTabs.map((chapterTab, index) => {
            const tabNode = this.tabButtons[index] ?? null;

            if (!tabNode) {
                throw new Error(`ChapterView.resolveTabViews: tabButtons[${index}] is missing`);
            }

            const selectedBackground = tabNode.getChildByName('SelectedBackground')?.getComponent(Sprite) ?? null;
            const icon = tabNode.getChildByName('Icon')?.getComponent(Sprite) ?? null;
            const label = tabNode.getChildByName('Label')?.getComponent(Label) ?? null;
            const chapterId = chapterTab.chapterId;

            if (!selectedBackground || !icon || !label) {
                throw new Error(`ChapterView.resolveTabViews: Tab_${chapterId} is missing icon, label, or selected background`);
            }

            tabNode.on(Node.EventType.TOUCH_END, () => {
                this.handleTabSelected(chapterId);
            });

            return {
                chapterId,
                node: tabNode,
                selectedBackground,
                icon,
                label,
            };
        });
    }

    private resolveLevelItemViews(): void {
        this.levelItemViews = this.levelItemNodes.map((levelItemNode, index) => {
            const levelItemView = levelItemNode.getComponent(LevelItemView);

            if (!levelItemView) {
                throw new Error(`ChapterView.resolveLevelItemViews: levelItemNodes[${index}] (${levelItemNode.name}) is missing LevelItemView`);
            }

            return levelItemView;
        }).sort((leftView, rightView) => {
            const yDelta = rightView.node.position.y - leftView.node.position.y;

            if (Math.abs(yDelta) > 0.1) {
                return yDelta;
            }

            return leftView.node.position.x - rightView.node.position.x;
        });
    }

    private captureVirtualLevelListMetrics(): void {
        const contentTransform = this.getLevelListContentTransform();
        const viewportTransform = this.getLevelListViewportTransform();
        const firstItemTransform = this.levelItemViews[0]?.node.getComponent(UITransform) ?? null;

        if (!firstItemTransform) {
            throw new Error('ChapterView.captureVirtualLevelListMetrics: first level item is missing UITransform');
        }

        const rowPositions = this.collectUniqueAxisPositions(this.levelItemViews.map((levelItemView) => levelItemView.node.position.y), true);
        const columnPositions = this.collectUniqueAxisPositions(this.levelItemViews.map((levelItemView) => levelItemView.node.position.x), false);
        const columnCount = columnPositions.length;

        if (columnCount === 0) {
            throw new Error('ChapterView.captureVirtualLevelListMetrics: failed to resolve column count');
        }

        if (this.levelItemViews.length % columnCount !== 0) {
            throw new Error('ChapterView.captureVirtualLevelListMetrics: levelItemNodes must fill complete rows for virtual reuse');
        }

        const pooledRowCount = this.levelItemViews.length / columnCount;

        if (rowPositions.length !== pooledRowCount) {
            throw new Error('ChapterView.captureVirtualLevelListMetrics: levelItemNodes rows are not aligned consistently');
        }

        const rowStep = rowPositions.length > 1
            ? Math.abs(rowPositions[0] - rowPositions[1])
            : firstItemTransform.contentSize.height;
        const columnStep = columnPositions.length > 1
            ? Math.abs(columnPositions[1] - columnPositions[0])
            : firstItemTransform.contentSize.width;

        if (rowStep <= 0 || columnStep <= 0) {
            throw new Error('ChapterView.captureVirtualLevelListMetrics: invalid rowStep or columnStep');
        }

        const horizontalCoverage = firstItemTransform.contentSize.width + (columnCount - 1) * columnStep;
        const verticalCoverage = firstItemTransform.contentSize.height + (pooledRowCount - 1) * rowStep;

        if (horizontalCoverage + 0.1 < viewportTransform.contentSize.width) {
            throw new Error('ChapterView.captureVirtualLevelListMetrics: pooled level items do not cover the ScrollView width');
        }

        if (verticalCoverage + 0.1 < viewportTransform.contentSize.height) {
            throw new Error('ChapterView.captureVirtualLevelListMetrics: pooled level items do not cover the ScrollView height');
        }

        const topBoundary = (1 - contentTransform.anchorPoint.y) * contentTransform.contentSize.height;
        const bottomBoundary = -contentTransform.anchorPoint.y * contentTransform.contentSize.height;
        const leftBoundary = -contentTransform.anchorPoint.x * contentTransform.contentSize.width;
        const rightBoundary = (1 - contentTransform.anchorPoint.x) * contentTransform.contentSize.width;

        this.virtualLevelListMetrics = {
            anchorX: contentTransform.anchorPoint.x,
            anchorY: contentTransform.anchorPoint.y,
            columnCount,
            columnStep,
            itemHeight: firstItemTransform.contentSize.height,
            itemWidth: firstItemTransform.contentSize.width,
            leftPadding: columnPositions[0] - leftBoundary,
            pooledRowCount,
            rightPadding: rightBoundary - columnPositions[columnPositions.length - 1],
            rowStep,
            topPadding: topBoundary - rowPositions[0],
            bottomPadding: rowPositions[rowPositions.length - 1] - bottomBoundary,
            viewportHeight: viewportTransform.contentSize.height,
            viewportWidth: viewportTransform.contentSize.width,
        };
    }

    private async renderSelectedChapter(): Promise<void> {
        const renderVersion = ++this.renderVersion;
        const save = this.saveService.load();
        const config = await this.loadChapterConfig(this.selectedChapterId);

        if (renderVersion !== this.renderVersion) {
            return;
        }

        const levelDisplayModels = this.controller.buildLevelDisplayModels(config, save);
        this.ensureVirtualLevelItemCapacity();

        if (renderVersion !== this.renderVersion) {
            return;
        }

        const clearedCount = this.controller.getProgressCount(config, save);

        this.currentLevelDisplayModels = levelDisplayModels;
        this.progressValueLabel!.string = `${clearedCount}/${config.levels.length}`;
        this.progressSuffixLabel!.string = 'Cleared';
        this.levelSelections.clear();

        levelDisplayModels.forEach((levelDisplayModel) => {
            if (!levelDisplayModel.isPlayable) {
                return;
            }

            this.levelSelections.set(levelDisplayModel.levelId, this.createLevelSelection(config, levelDisplayModel));
        });

        this.renderTabs();
        this.levelListScrollView!.stopAutoScroll();
        this.updateVirtualLevelListContentSize(levelDisplayModels.length);
        this.renderedStartRow = -1;
        this.levelListScrollView!.scrollToTop(0);
        this.refreshVisibleLevelItems();
    }

    private async loadChapterConfig(chapterId: ChapterId): Promise<ChapterLevelConfig> {
        const chapterFileName = this.controller.getChapterFileName(chapterId);

        return this.levelService.loadChapterConfig(chapterFileName);
    }

    private renderTabs(): void {
        this.tabViews.forEach((tabView) => {
            const isSelected = tabView.chapterId === this.selectedChapterId;

            tabView.selectedBackground.node.active = isSelected;
            tabView.label.color = isSelected ? COLORS.tabSelectedText : COLORS.tabIdleText;
            tabView.icon.color = isSelected ? COLORS.tabSelectedText : COLORS.tabIdleText;
        });
    }

    private handleTabSelected(chapterId: ChapterId): void {
        if (chapterId === this.selectedChapterId) {
            return;
        }

        this.selectedChapterId = chapterId;
        this.refresh();
    }

    private readonly handleLevelTap = (levelId: number): void => {
        const selection = this.levelSelections.get(levelId) ?? null;

        if (!selection) {
            return;
        }

        this.onLevelSelected?.(selection);
    };

    private createLevelSelection(
        config: ChapterLevelConfig,
        displayModel: ChapterLevelDisplayModel,
    ): ChapterLevelSelection {
        return {
            chapterId: this.controller.normalizeChapterId(config.chapterId),
            chapterFileName: this.controller.getChapterFileName(config.chapterId),
            levelId: displayModel.levelId,
            levelIndex: displayModel.levelIndex,
        };
    }

    private toLevelItemRenderData(displayModel: ChapterLevelDisplayModel): LevelItemRenderData {
        return {
            levelId: displayModel.levelId,
            displayNumber: displayModel.displayNumber,
            status: displayModel.status,
            isPlayable: displayModel.isPlayable,
        };
    }

    private ensureVirtualLevelItemCapacity(): void {
        const metrics = this.virtualLevelListMetrics;

        if (!metrics) {
            throw new Error('ChapterView.ensureVirtualLevelItemCapacity: virtualLevelListMetrics is missing');
        }

        if (this.levelItemViews.length < metrics.columnCount) {
            throw new Error('ChapterView.ensureVirtualLevelItemCapacity: at least one full row of pooled level items is required');
        }
    }

    private isDescendantOf(node: Node, parentNode: Node): boolean {
        let currentNode: Node | null = node;

        while (currentNode) {
            if (currentNode === parentNode) {
                return true;
            }

            currentNode = currentNode.parent;
        }

        return false;
    }

    private collectUniqueAxisPositions(axisValues: readonly number[], descending: boolean): number[] {
        const sortedValues = [...axisValues].sort((leftValue, rightValue) => descending ? rightValue - leftValue : leftValue - rightValue);
        const uniqueValues: number[] = [];

        sortedValues.forEach((axisValue) => {
            const lastValue = uniqueValues[uniqueValues.length - 1] ?? null;

            if (lastValue === null || Math.abs(lastValue - axisValue) > 0.1) {
                uniqueValues.push(axisValue);
            }
        });

        return uniqueValues;
    }

    private updateVirtualLevelListContentSize(levelCount: number): void {
        const metrics = this.virtualLevelListMetrics;

        if (!metrics) {
            throw new Error('ChapterView.updateVirtualLevelListContentSize: virtualLevelListMetrics is missing');
        }

        const totalRows = this.getTotalRowCount(levelCount);
        const contentTransform = this.getLevelListContentTransform();
        const requiredHeight = metrics.topPadding
            + metrics.bottomPadding
            + Math.max(0, totalRows - 1) * metrics.rowStep;
        const nextHeight = Math.max(metrics.viewportHeight, requiredHeight);

        contentTransform.setContentSize(contentTransform.contentSize.width, nextHeight);
    }

    private refreshVisibleLevelItems(): void {
        const metrics = this.virtualLevelListMetrics;

        if (!metrics) {
            throw new Error('ChapterView.refreshVisibleLevelItems: virtualLevelListMetrics is missing');
        }

        const totalLevelCount = this.currentLevelDisplayModels.length;
        const totalRowCount = this.getTotalRowCount(totalLevelCount);
        const startRow = Math.min(this.getVisibleStartRow(totalRowCount), Math.max(0, totalRowCount - metrics.pooledRowCount));

        if (startRow === this.renderedStartRow && totalLevelCount > 0) {
            return;
        }

        const contentTransform = this.getLevelListContentTransform();
        const topBoundary = (1 - metrics.anchorY) * contentTransform.contentSize.height;
        const leftBoundary = -metrics.anchorX * contentTransform.contentSize.width;

        this.levelItemViews.forEach((levelItemView, slotIndex) => {
            const slotRowOffset = Math.floor(slotIndex / metrics.columnCount);
            const columnIndex = slotIndex % metrics.columnCount;
            const rowIndex = startRow + slotRowOffset;
            const levelIndex = rowIndex * metrics.columnCount + columnIndex;
            const levelDisplayModel = this.currentLevelDisplayModels[levelIndex] ?? null;

            if (!levelDisplayModel) {
                levelItemView.node.active = false;
                levelItemView.onTap = null;
                return;
            }

            const positionX = leftBoundary + metrics.leftPadding + columnIndex * metrics.columnStep;
            const positionY = topBoundary - metrics.topPadding - rowIndex * metrics.rowStep;

            levelItemView.node.active = true;
            levelItemView.node.setPosition(positionX, positionY, levelItemView.node.position.z);
            levelItemView.onTap = levelDisplayModel.isPlayable ? this.handleLevelTap : null;
            levelItemView.render(this.toLevelItemRenderData(levelDisplayModel));
        });

        this.renderedStartRow = startRow;
    }

    private getVisibleStartRow(totalRowCount: number): number {
        const metrics = this.virtualLevelListMetrics;

        if (!metrics || totalRowCount <= metrics.pooledRowCount) {
            return 0;
        }

        const scrollOffsetY = Math.max(0, this.levelListScrollView?.getScrollOffset().y ?? 0);
        const rawStartRow = Math.floor(scrollOffsetY / metrics.rowStep);

        return Math.max(0, Math.min(rawStartRow, totalRowCount - metrics.pooledRowCount));
    }

    private getTotalRowCount(levelCount: number): number {
        const metrics = this.virtualLevelListMetrics;

        if (!metrics) {
            throw new Error('ChapterView.getTotalRowCount: virtualLevelListMetrics is missing');
        }

        return Math.max(1, Math.ceil(levelCount / metrics.columnCount));
    }

    private getLevelListContentTransform(): UITransform {
        const contentTransform = this.levelListContent?.getComponent(UITransform) ?? null;

        if (!contentTransform) {
            throw new Error('ChapterView.getLevelListContentTransform: levelListContent is missing UITransform');
        }

        return contentTransform;
    }

    private getLevelListViewportTransform(): UITransform {
        const viewportTransform = this.levelListScrollView?.node.getComponent(UITransform) ?? null;

        if (!viewportTransform) {
            throw new Error('ChapterView.getLevelListViewportTransform: levelListScrollView node is missing UITransform');
        }

        return viewportTransform;
    }

    private readonly handleLevelListScrolling = (): void => {
        this.refreshVisibleLevelItems();
    };
}
