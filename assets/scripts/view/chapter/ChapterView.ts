import {
    _decorator,
    Color,
    Component,
    instantiate,
    Label,
    Layout,
    Mask,
    Node,
    Prefab,
    resources,
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
import { ChapterLevelConfig, LevelService } from '../../core/LevelService';
import { SaveService } from '../../core/SaveService';
import { LevelItemRenderData, LevelItemView } from './LevelItemView';

const { ccclass, property } = _decorator;
const LEVEL_ITEM_PREFAB_PATH = 'prefabs/LevelItem';

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

    @property(Node)
    private readonly levelGridRoot: Node | null = null;

    @property({ type: [Node] })
    private readonly levelItemNodes: Node[] = [];

    public onLevelSelected: ((selection: ChapterLevelSelection) => void) | null = null;

    private readonly controller: ChapterController = new ChapterController();
    private readonly levelService: LevelService = new LevelService();
    private readonly saveService: SaveService = new SaveService();
    private readonly levelSelections: Map<number, ChapterLevelSelection> = new Map();

    private tabViews: ChapterTabView[] = [];
    private levelItemViews: LevelItemView[] = [];
    private selectedChapterId: ChapterId = 1;
    private renderVersion: number = 0;
    private isInitialized: boolean = false;
    private levelItemPrefabPromise: Promise<Prefab> | null = null;
    private levelGridScrollView: ScrollView | null = null;
    private hasPreparedLevelGridContent: boolean = false;

    protected onLoad(): void {
        this.validateReferences();
        this.resolveTabViews();
        this.ensureLevelGridScrollView();
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
        if (this.tabButtons.length !== 3) {
            throw new Error('ChapterView: tabButtons must contain exactly 3 nodes');
        }

        if (!this.progressValueLabel || !this.progressSuffixLabel || !this.levelGridRoot) {
            throw new Error('ChapterView: progress labels or levelGridRoot are not assigned');
        }
    }

    private resolveTabViews(): void {
        this.tabViews = this.tabButtons.map((tabNode, index) => {
            const selectedBackground = tabNode.getChildByName('SelectedBackground')?.getComponent(Sprite) ?? null;
            const icon = tabNode.getChildByName('Icon')?.getComponent(Sprite) ?? null;
            const label = tabNode.getChildByName('Label')?.getComponent(Label) ?? null;
            const chapterId = (index + 1) as ChapterId;

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

    private async ensureLevelItemViews(requiredCount: number): Promise<void> {
        this.prepareLevelGridContent();
        const levelItemPrefab = await this.loadLevelItemPrefab();
        const activeLevelGridRoot = this.levelGridRoot;

        if (!activeLevelGridRoot) {
            throw new Error('ChapterView.ensureLevelItemViews: levelGridRoot is missing');
        }

        while (this.levelItemViews.length > requiredCount) {
            const levelItemView = this.levelItemViews.pop();

            if (!levelItemView) {
                break;
            }

            levelItemView.node.removeFromParent();
            levelItemView.node.destroy();
        }

        while (this.levelItemViews.length < requiredCount) {
            const index = this.levelItemViews.length;
            const levelItemNode = instantiate(levelItemPrefab);
            levelItemNode.name = `LevelItem_${index + 1}`;
            levelItemNode.setParent(activeLevelGridRoot);
            levelItemNode.setPosition(0, 0, 0);

            const levelItemView = levelItemNode.getComponent(LevelItemView);

            if (!levelItemView) {
                throw new Error(`ChapterView.ensureLevelItemViews: instantiated level item ${index + 1} is missing LevelItemView`);
            }

            this.levelItemViews.push(levelItemView);
        }

        activeLevelGridRoot.getComponent(Layout)?.updateLayout();
    }

    private async renderSelectedChapter(): Promise<void> {
        const renderVersion = ++this.renderVersion;
        const save = this.saveService.load();
        const config = await this.loadChapterConfig(this.selectedChapterId);

        if (renderVersion !== this.renderVersion) {
            return;
        }

        const levelDisplayModels = this.controller.buildLevelDisplayModels(config, save);
        await this.ensureLevelItemViews(levelDisplayModels.length);

        if (renderVersion !== this.renderVersion) {
            return;
        }

        const clearedCount = this.controller.getProgressCount(config, save);

        this.progressValueLabel!.string = `${clearedCount}/${config.levels.length}`;
        this.progressSuffixLabel!.string = 'Cleared';
        this.levelSelections.clear();

        this.levelItemViews.forEach((levelItemView, index) => {
            const levelDisplayModel = levelDisplayModels[index] ?? null;
            const levelItemNode = levelItemView.node;

            if (!levelItemNode) {
                throw new Error(`ChapterView.renderSelectedChapter: levelItem node ${index} is missing`);
            }

            if (!levelDisplayModel) {
                levelItemNode.active = false;
                levelItemView.onTap = null;
                return;
            }

            levelItemNode.active = true;
            levelItemView.onTap = levelDisplayModel.isPlayable ? this.handleLevelTap : null;
            levelItemView.render(this.toLevelItemRenderData(levelDisplayModel));

            if (levelDisplayModel.isPlayable) {
                this.levelSelections.set(levelDisplayModel.levelId, this.createLevelSelection(config, levelDisplayModel));
            }
        });

        this.renderTabs();
        this.levelGridScrollView?.stopAutoScroll();
        this.levelGridScrollView?.scrollToTop(0);
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

    private async loadLevelItemPrefab(): Promise<Prefab> {
        if (!this.levelItemPrefabPromise) {
            this.levelItemPrefabPromise = new Promise<Prefab>((resolve, reject) => {
                resources.load(LEVEL_ITEM_PREFAB_PATH, Prefab, (error, asset) => {
                    if (error) {
                        reject(new Error(`ChapterView.loadLevelItemPrefab failed: ${error.message}`));
                        return;
                    }

                    if (!asset) {
                        reject(new Error('ChapterView.loadLevelItemPrefab failed: prefab asset is missing'));
                        return;
                    }

                    resolve(asset);
                });
            });
        }

        return await this.levelItemPrefabPromise;
    }

    private ensureLevelGridScrollView(): void {
        if (this.levelGridScrollView || !this.levelGridRoot) {
            return;
        }

        const contentNode = this.levelGridRoot;
        const parentNode = contentNode.parent;
        const contentTransform = contentNode.getComponent(UITransform);
        const siblingIndex = contentNode.getSiblingIndex();

        if (!parentNode || !contentTransform) {
            throw new Error('ChapterView.ensureLevelGridScrollView: levelGridRoot parent or UITransform is missing');
        }

        const viewportNode = new Node('LevelGridScrollView');
        viewportNode.layer = contentNode.layer;
        viewportNode.setParent(parentNode);
        viewportNode.setSiblingIndex(siblingIndex);
        viewportNode.setPosition(new Vec3(contentNode.position.x, contentNode.position.y, contentNode.position.z));
        viewportNode.setScale(new Vec3(contentNode.scale.x, contentNode.scale.y, contentNode.scale.z));
        viewportNode.setRotation(contentNode.rotation);

        const viewportTransform = viewportNode.addComponent(UITransform);
        viewportTransform.setContentSize(contentTransform.contentSize);

        const mask = viewportNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;

        const scrollView = viewportNode.addComponent(ScrollView);
        scrollView.horizontal = false;
        scrollView.vertical = true;
        scrollView.inertia = true;
        scrollView.elastic = true;

        contentNode.setParent(viewportNode);
        contentNode.setPosition(0, 0, 0);
        contentNode.setScale(1, 1, 1);
        contentNode.setRotationFromEuler(0, 0, 0);

        scrollView.content = contentNode;
        this.levelGridScrollView = scrollView;
    }

    private prepareLevelGridContent(): void {
        if (this.hasPreparedLevelGridContent || !this.levelGridRoot) {
            return;
        }

        this.levelGridRoot.children.slice().forEach((childNode) => {
            childNode.removeFromParent();
            childNode.destroy();
        });

        this.levelItemViews = [];
        this.hasPreparedLevelGridContent = true;
    }
}
