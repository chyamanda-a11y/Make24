import {
    _decorator,
    Color,
    Component,
    instantiate,
    Label,
    Node,
    ScrollView,
    Sprite,
    UITransform,
    Vec3,
} from 'cc';

import {
    ChapterController,
    ChapterId,
    ChapterLevelDisplayModel,
} from '../../controller/chapter/ChapterController';
import { AudioUtil } from '../../core/AudioUtil';
import { ChapterLevelConfig, LevelService } from '../../core/LevelService';
import { SaveService } from '../../core/SaveService';
import { SaveModel } from '../../model/common/SaveModel';
import { LevelModel } from '../../model/game/LevelModel';
import { LevelItemRenderData, LevelItemView } from './LevelItemView';

const { ccclass, property } = _decorator;

const COLORS = {
    tabSelectedText: new Color(16, 31, 12, 255),
    tabIdleText: new Color(176, 164, 114, 255),
};

const GRID_COLUMN_COUNT = 4;

interface ChapterTabView {
    readonly chapterId: ChapterId;
    readonly node: Node;
    readonly selectedBackground: Sprite;
    readonly icon: Sprite;
    readonly label: Label;
}

interface LevelGridLayoutMetrics {
    readonly columnCount: number;
    readonly columnStep: number;
    readonly rowStep: number;
    readonly firstItemPosition: Vec3;
    readonly topPadding: number;
    readonly bottomPadding: number;
    readonly viewportHeight: number;
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

    @property(Node)
    private readonly levelItemTemplateNode: Node | null = null;

    public onLevelSelected: ((selection: ChapterLevelSelection) => void) | null = null;

    private readonly controller: ChapterController = new ChapterController();
    private readonly levelService: LevelService = new LevelService();
    private readonly saveService: SaveService = new SaveService();
    private readonly levelSelections: Map<number, ChapterLevelSelection> = new Map();

    private tabViews: ChapterTabView[] = [];
    private runtimeLevelItemViews: LevelItemView[] = [];
    private currentLevelDisplayModels: readonly ChapterLevelDisplayModel[] = [];
    private selectedChapterId: ChapterId = 1;
    private renderVersion: number = 0;
    private isInitialized: boolean = false;
    private hasResolvedStaticReferences: boolean = false;
    private initialContentPosition: Vec3 | null = null;
    private preparedProgressValueText: string = '';
    private preparedProgressSuffixText: string = '';
    private isPreparedRenderScheduled: boolean = false;
    private levelGridLayoutMetrics: LevelGridLayoutMetrics | null = null;
    private levelItemTemplateView: LevelItemView | null = null;

    protected onLoad(): void {
        this.resolveStaticReferencesIfNeeded();
    }

    protected onEnable(): void {
        this.scheduleRenderPreparedContent();
    }

    protected onDisable(): void {
        this.unschedule(this.runScheduledPreparedRender);
        this.isPreparedRenderScheduled = false;
    }

    protected start(): void {
        if (this.isInitialized) {
            return;
        }

        void this.prepareForOpen();
    }

    public async prepareForOpen(chapterId?: ChapterId): Promise<void> {
        await this.prepareDataForOpen(chapterId);
        this.scheduleRenderPreparedContent();
    }

    public async prepareDataForOpen(chapterId?: ChapterId): Promise<void> {
        this.resolveStaticReferencesIfNeeded();
        const save = this.saveService.load();

        this.selectedChapterId = this.controller.normalizeChapterId(chapterId ?? save.currentChapterId);
        await this.prepareSelectedChapterData();
        this.ensureRuntimeLevelItemCapacity(this.currentLevelDisplayModels.length);
        this.isInitialized = true;
    }

    public renderPreparedContent(): void {
        if (!this.node.activeInHierarchy || this.currentLevelDisplayModels.length === 0) {
            return;
        }

        this.resolveStaticReferencesIfNeeded();
        this.hideTemplateNode();
        this.renderTabs();
        this.progressValueLabel!.string = this.preparedProgressValueText;
        this.progressSuffixLabel!.string = this.preparedProgressSuffixText;
        this.updateLevelListContentSize(this.currentLevelDisplayModels.length);
        this.restoreInitialContentPosition();
        this.levelListScrollView!.stopAutoScroll();
        this.levelListScrollView!.scrollToTop(0);
        this.renderRuntimeLevelItems();
    }

    public scheduleRenderPreparedContent(): void {
        if (this.isPreparedRenderScheduled) {
            return;
        }

        this.isPreparedRenderScheduled = true;
        this.scheduleOnce(this.runScheduledPreparedRender, 0);
    }

    public refresh(): void {
        if (!this.isInitialized) {
            return;
        }

        void this.prepareForOpen(this.selectedChapterId);
    }

    private resolveStaticReferencesIfNeeded(): void {
        if (this.hasResolvedStaticReferences) {
            return;
        }

        this.validateReferences();
        this.resolveTabViews();
        this.resolveLevelItemTemplateView();
        this.captureLevelGridLayoutMetrics();
        this.hideTemplateNode();
        this.initialContentPosition = this.levelListContent?.position.clone() ?? null;
        this.hasResolvedStaticReferences = true;
    }

    private readonly runScheduledPreparedRender = (): void => {
        this.isPreparedRenderScheduled = false;
        this.renderPreparedContent();
    };

    private validateReferences(): void {
        const chapterTabs = this.controller.getChapterTabs();

        if (this.tabButtons.length !== chapterTabs.length) {
            throw new Error(`ChapterView: tabButtons must contain exactly ${chapterTabs.length} nodes`);
        }

        if (!this.progressValueLabel || !this.progressSuffixLabel || !this.levelListScrollView || !this.levelListContent || !this.levelItemTemplateNode) {
            throw new Error('ChapterView: progress labels, levelListScrollView, levelListContent, or levelItemTemplateNode are not assigned');
        }

        if (this.levelListScrollView.content !== this.levelListContent) {
            throw new Error('ChapterView: levelListScrollView.content must point to levelListContent');
        }

        if (!this.isDescendantOf(this.levelItemTemplateNode, this.levelListContent)) {
            throw new Error('ChapterView: levelItemTemplateNode must be inside levelListContent');
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
                AudioUtil.PlayNormalBtn();
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

    private resolveLevelItemTemplateView(): void {
        const levelItemTemplateNode = this.levelItemTemplateNode;

        if (!levelItemTemplateNode) {
            throw new Error('ChapterView.resolveLevelItemTemplateView: levelItemTemplateNode is missing');
        }

        const levelItemTemplateView = levelItemTemplateNode.getComponent(LevelItemView);

        if (!levelItemTemplateView) {
            throw new Error('ChapterView.resolveLevelItemTemplateView: levelItemTemplateNode is missing LevelItemView');
        }

        this.levelItemTemplateView = levelItemTemplateView;
    }

    private captureLevelGridLayoutMetrics(): void {
        const contentTransform = this.getLevelListContentTransform();
        const viewportTransform = this.getLevelListViewportTransform();
        const levelItemTemplateNode = this.levelItemTemplateNode;
        const levelItemTemplateTransform = levelItemTemplateNode?.getComponent(UITransform) ?? null;

        if (!levelItemTemplateNode || !levelItemTemplateTransform) {
            throw new Error('ChapterView.captureLevelGridLayoutMetrics: level item template transform is missing');
        }

        const rowStep = levelItemTemplateTransform.contentSize.height + 12;
        const columnStep = levelItemTemplateTransform.contentSize.width + 12;
        const topBoundary = (1 - contentTransform.anchorPoint.y) * contentTransform.contentSize.height;
        const bottomBoundary = -contentTransform.anchorPoint.y * contentTransform.contentSize.height;

        this.levelGridLayoutMetrics = {
            columnCount: GRID_COLUMN_COUNT,
            columnStep,
            rowStep,
            firstItemPosition: levelItemTemplateNode.position.clone(),
            topPadding: topBoundary - levelItemTemplateNode.position.y,
            bottomPadding: levelItemTemplateNode.position.y - bottomBoundary,
            viewportHeight: viewportTransform.contentSize.height,
        };
    }

    private hideTemplateNode(): void {
        if (!this.levelItemTemplateNode) {
            return;
        }

        this.levelItemTemplateNode.active = false;

        if (this.levelItemTemplateView) {
            this.levelItemTemplateView.onTap = null;
        }
    }

    private async prepareSelectedChapterData(): Promise<void> {
        const renderVersion = ++this.renderVersion;
        const save = this.saveService.load();
        const config = await this.loadChapterConfig(this.selectedChapterId);

        if (renderVersion !== this.renderVersion) {
            return;
        }

        const levelDisplayModels = this.controller.buildLevelDisplayModels(config, save);

        if (renderVersion !== this.renderVersion) {
            return;
        }

        const clearedCount = this.controller.getProgressCount(config, save);
        const currentPlayableLevelIndex = this.controller.resolveCurrentPlayableLevelIndex(config, save);
        const currentPlayableLevel = currentPlayableLevelIndex === null
            ? null
            : config.levels[currentPlayableLevelIndex] ?? null;

        this.currentLevelDisplayModels = levelDisplayModels;
        this.preparedProgressValueText = `${clearedCount}/${config.levels.length}`;
        this.preparedProgressSuffixText = this.buildProgressSuffixText();
        this.levelSelections.clear();

        levelDisplayModels.forEach((levelDisplayModel) => {
            if (!levelDisplayModel.isPlayable) {
                return;
            }

            this.levelSelections.set(levelDisplayModel.levelId, this.createLevelSelection(config, levelDisplayModel));
        });
    }

    private async loadChapterConfig(chapterId: ChapterId): Promise<ChapterLevelConfig> {
        const chapterFileName = this.controller.getChapterFileName(chapterId);

        return this.levelService.loadChapterConfig(chapterFileName);
    }

    private ensureRuntimeLevelItemCapacity(levelCount: number): void {
        const levelListContent = this.levelListContent;
        const levelItemTemplateNode = this.levelItemTemplateNode;

        if (!levelListContent || !levelItemTemplateNode) {
            throw new Error('ChapterView.ensureRuntimeLevelItemCapacity: levelListContent or levelItemTemplateNode is missing');
        }

        while (this.runtimeLevelItemViews.length < levelCount) {
            const cloneNode = instantiate(levelItemTemplateNode);
            const cloneView = cloneNode.getComponent(LevelItemView);

            if (!cloneView) {
                throw new Error('ChapterView.ensureRuntimeLevelItemCapacity: cloned level item is missing LevelItemView');
            }

            cloneNode.name = this.formatRuntimeLevelItemNodeName(this.runtimeLevelItemViews.length + 1);
            cloneNode.setParent(levelListContent);
            cloneNode.active = false;
            this.runtimeLevelItemViews.push(cloneView);
        }
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

        void this.prepareForOpen(chapterId);
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

    private renderRuntimeLevelItems(): void {
        const layoutMetrics = this.getLevelGridLayoutMetrics();

        this.runtimeLevelItemViews.forEach((levelItemView, levelIndex) => {
            const levelDisplayModel = this.currentLevelDisplayModels[levelIndex] ?? null;

            if (!levelDisplayModel) {
                levelItemView.node.active = false;
                levelItemView.onTap = null;
                return;
            }

            const columnIndex = levelIndex % layoutMetrics.columnCount;
            const rowIndex = Math.floor(levelIndex / layoutMetrics.columnCount);
            const positionX = layoutMetrics.firstItemPosition.x + columnIndex * layoutMetrics.columnStep;
            const positionY = layoutMetrics.firstItemPosition.y - rowIndex * layoutMetrics.rowStep;

            levelItemView.node.active = true;
            levelItemView.node.setPosition(positionX, positionY, layoutMetrics.firstItemPosition.z);
            levelItemView.onTap = levelDisplayModel.isPlayable ? this.handleLevelTap : null;
            levelItemView.render(this.toLevelItemRenderData(levelDisplayModel));
        });
    }

    private updateLevelListContentSize(levelCount: number): void {
        const layoutMetrics = this.getLevelGridLayoutMetrics();
        const totalRows = this.getTotalRowCount(levelCount);
        const contentTransform = this.getLevelListContentTransform();
        const requiredHeight = layoutMetrics.topPadding
            + layoutMetrics.bottomPadding
            + Math.max(0, totalRows - 1) * layoutMetrics.rowStep;
        const nextHeight = Math.max(layoutMetrics.viewportHeight, requiredHeight);

        contentTransform.setContentSize(contentTransform.contentSize.width, nextHeight);
    }

    private restoreInitialContentPosition(): void {
        const initialPosition = this.initialContentPosition;

        if (!initialPosition || !this.levelListContent) {
            throw new Error('ChapterView.restoreInitialContentPosition: initial content position is missing');
        }

        this.levelListContent.setPosition(initialPosition.x, initialPosition.y, initialPosition.z);
    }

    private getTotalRowCount(levelCount: number): number {
        const layoutMetrics = this.getLevelGridLayoutMetrics();

        return Math.max(1, Math.ceil(levelCount / layoutMetrics.columnCount));
    }

    private getLevelListContentTransform(): UITransform {
        const contentTransform = this.levelListContent?.getComponent(UITransform) ?? null;

        if (!contentTransform) {
            throw new Error('ChapterView.getLevelListContentTransform: levelListContent is missing UITransform');
        }

        return contentTransform;
    }

    private getLevelListViewportTransform(): UITransform {
        const viewportNode = this.levelListContent?.parent ?? this.levelListScrollView?.node ?? null;
        const viewportTransform = viewportNode?.getComponent(UITransform) ?? null;

        if (!viewportTransform) {
            throw new Error('ChapterView.getLevelListViewportTransform: viewport node is missing UITransform');
        }

        return viewportTransform;
    }

    private getLevelGridLayoutMetrics(): LevelGridLayoutMetrics {
        const layoutMetrics = this.levelGridLayoutMetrics;

        if (!layoutMetrics) {
            throw new Error('ChapterView.getLevelGridLayoutMetrics: levelGridLayoutMetrics is missing');
        }

        return layoutMetrics;
    }

    private formatRuntimeLevelItemNodeName(itemIndex: number): string {
        return `RuntimeLevelItem_${itemIndex.toString().padStart(2, '0')}`;
    }

    private buildProgressSuffixText(): string {
        return '已通关';
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
}
