import { _decorator, Button, Component, EventTouch, Label, Node, Prefab, Tween, instantiate, resources, tween, Vec3 } from 'cc';

import { GameController } from '../../controller/game/GameController';
import { LevelService } from '../../core/LevelService';
import { LevelModel } from '../../model/game/LevelModel';
import { AnswerPopupView } from './AnswerPopupView';
import { NumPanelView } from './NumPanelView';
import { ResultPopupView } from './ResultPopupView';
import { SignPanelView } from './SignPanelView';

const { ccclass, property } = _decorator;

const FALLBACK_LEVEL: LevelModel = {
    id: 101,
    chapterId: 1,
    numbers: [6, 6, 2, 2],
    answerExpression: '(6*2)*(6/2)',
};

const ANSWER_POPUP_PREFAB_PATH = 'prefabs/AnswerPopUI';
const RESULT_POPUP_PREFAB_PATH = 'prefabs/ResultPupUI';
const CONTROL_BUTTON_PRESS_SCALE = 0.94;
const CONTROL_BUTTON_PRESS_DURATION = 0.08;
const CONTROL_BUTTON_RELEASE_DURATION = 0.1;
const HEADER_TITLE_PATH = 'Header/Level 24: MasterNode';
const HEADER_LEVEL_NUMBER_PATH = '24Node';
const CHAPTER_TITLE_BY_ID: Readonly<Record<number, string>> = {
    1: 'Junior',
    2: 'Middle',
    3: 'Senior',
};

interface LevelRequest {
    readonly chapterFileName: string;
    readonly levelIndex: number;
}

@ccclass('GameView')
export class GameView extends Component {
    @property({ type: [Node] })
    private readonly numPanels: Node[] = [];

    @property({ type: [Node] })
    private readonly signPanels: Node[] = [];

    @property(Node)
    private readonly backOneButton: Node | null = null;

    @property(Node)
    private readonly retryButton: Node | null = null;

    @property(Node)
    private readonly tipButton: Node | null = null;

    @property(Node)
    private readonly exitButton: Node | null = null;

    @property(Node)
    private readonly headerTitleNode: Node | null = null;

    @property(Node)
    private readonly headerLevelNumberNode: Node | null = null;

    @property
    private levelFileName: string = 'chapter_01';

    public onLevelStarted: ((level: LevelModel) => void) | null = null;
    public onLevelCompleted: ((level: LevelModel) => void) | null = null;
    public onExitRequested: (() => void) | null = null;

    private readonly controller: GameController = new GameController();
    private readonly levelService: LevelService = new LevelService();
    private numPanelViews: NumPanelView[] = [];
    private signPanelViews: SignPanelView[] = [];
    private backOneButtonComponent: Button | null = null;
    private retryButtonComponent: Button | null = null;
    private tipButtonComponent: Button | null = null;
    private exitButtonComponent: Button | null = null;
    private answerPopupView: AnswerPopupView | null = null;
    private resultPopupView: ResultPopupView | null = null;
    private chapterLevels: readonly LevelModel[] = [];
    private currentLevelIndex: number = 0;
    private readonly controlButtonBaseScales: Map<Node, Vec3> = new Map();
    private pendingLevelRequest: LevelRequest | null = null;
    private isInitialized: boolean = false;
    private loadRequestVersion: number = 0;
    private popupInitializationPromise: Promise<void> | null = null;
    private reportedCompletedLevelId: number | null = null;
    private resolvedExitButton: Node | null = null;
    private headerTitleLabel: Label | null = null;
    private headerLevelNumberLabel: Label | null = null;

    protected onLoad(): void {
        this.numPanelViews = this.resolveNumPanels();
        this.signPanelViews = this.resolveSignPanels();
        this.resolveControlButtons();
        this.resolveHeaderLabels();
        this.validatePanelReferences();
        this.refreshControlButtons();
    }

    protected onEnable(): void {
        this.registerInteraction();
        this.refreshControlButtons();
    }

    protected start(): void {
        void this.initialize();
    }

    protected onDisable(): void {
        this.unregisterInteraction();
        this.resetControlButtonScales();
    }

    private async initialize(): Promise<void> {
        await this.ensurePopupViews();
        await this.applyLevelRequest(this.pendingLevelRequest ?? {
            chapterFileName: this.levelFileName,
            levelIndex: 0,
        });
        this.isInitialized = true;
    }

    public openLevel(chapterFileName: string, levelIndex: number): void {
        this.pendingLevelRequest = {
            chapterFileName,
            levelIndex,
        };

        if (!this.isInitialized) {
            return;
        }

        void this.applyLevelRequest(this.pendingLevelRequest);
    }

    public isCurrentLevelLastInChapter(): boolean {
        return !this.hasNextLevel();
    }

    private async loadChapterLevels(chapterFileName: string): Promise<readonly LevelModel[]> {
        try {
            const config = await this.levelService.loadChapterConfig(chapterFileName);

            return config.levels.length > 0 ? config.levels : [FALLBACK_LEVEL];
        } catch {
            return [FALLBACK_LEVEL];
        }
    }

    private async ensurePopupViews(): Promise<void> {
        if (this.answerPopupView && this.resultPopupView) {
            return;
        }

        if (!this.popupInitializationPromise) {
            this.popupInitializationPromise = this.initializePopupViews();
        }

        await this.popupInitializationPromise;
    }

    private async applyLevelRequest(request: LevelRequest): Promise<void> {
        const requestVersion = ++this.loadRequestVersion;
        const chapterLevels = await this.loadChapterLevels(request.chapterFileName);

        if (requestVersion !== this.loadRequestVersion) {
            return;
        }

        this.levelFileName = request.chapterFileName;
        this.chapterLevels = chapterLevels;
        this.startLevelByIndex(this.sanitizeLevelIndex(request.levelIndex));
    }

    private sanitizeLevelIndex(levelIndex: number): number {
        if (this.chapterLevels.length === 0) {
            return 0;
        }

        return Math.min(Math.max(levelIndex, 0), this.chapterLevels.length - 1);
    }

    private async initializePopupViews(): Promise<void> {
        const [answerPopupPrefab, resultPopupPrefab] = await Promise.all([
            this.loadPrefab(ANSWER_POPUP_PREFAB_PATH),
            this.loadPrefab(RESULT_POPUP_PREFAB_PATH),
        ]);

        const answerPopupNode = instantiate(answerPopupPrefab);
        const resultPopupNode = instantiate(resultPopupPrefab);

        answerPopupNode.setParent(this.node);
        resultPopupNode.setParent(this.node);
        answerPopupNode.setPosition(0, 0, 0);
        resultPopupNode.setPosition(0, 0, 0);

        this.answerPopupView = answerPopupNode.getComponent(AnswerPopupView) ?? answerPopupNode.addComponent(AnswerPopupView);
        this.resultPopupView = resultPopupNode.getComponent(ResultPopupView) ?? resultPopupNode.addComponent(ResultPopupView);
        this.resultPopupView.onNextTap = (): void => {
            this.handleResultNextTap();
        };

        this.hideTransientPopups();
    }

    private async loadPrefab(resourcePath: string): Promise<Prefab> {
        return await new Promise<Prefab>((resolve, reject) => {
            resources.load(resourcePath, Prefab, (error, asset) => {
                if (error) {
                    reject(new Error(`GameView.loadPrefab failed: ${error.message}`));
                    return;
                }

                if (!asset) {
                    reject(new Error(`GameView.loadPrefab failed: prefab ${resourcePath} is missing`));
                    return;
                }

                resolve(asset);
            });
        });
    }

    private startLevelByIndex(index: number): void {
        const level = this.chapterLevels[index];

        if (!level) {
            throw new Error(`GameView.startLevelByIndex: level index ${index} is out of range`);
        }

        this.currentLevelIndex = index;
        this.reportedCompletedLevelId = null;
        this.hideTransientPopups();
        this.controller.startLevel(level);
        this.onLevelStarted?.(level);
        this.render();
    }

    private validatePanelReferences(): void {
        const uniqueOperators = new Set(this.signPanelViews.map((panel) => panel.getOperator()));

        if (uniqueOperators.size !== this.signPanelViews.length) {
            throw new Error('GameView: signPanels operator types must be unique');
        }
    }

    private registerInteraction(): void {
        this.numPanelViews.forEach((panel, index) => {
            panel.onTap = (): void => {
                this.controller.handleNumberTap(index);
                this.render();
            };
        });

        this.signPanelViews.forEach((panel) => {
            panel.onTap = (operator): void => {
                this.controller.handleOperatorTap(operator);
                this.render();
            };
        });

        this.backOneButton?.on(Node.EventType.TOUCH_START, this.handleControlButtonTouchStart, this);
        this.backOneButton?.on(Node.EventType.TOUCH_END, this.handleControlButtonTouchEnd, this);
        this.backOneButton?.on(Node.EventType.TOUCH_CANCEL, this.handleControlButtonTouchCancel, this);
        this.backOneButton?.on(Node.EventType.TOUCH_END, this.handleBackOneTap, this);

        this.retryButton?.on(Node.EventType.TOUCH_START, this.handleControlButtonTouchStart, this);
        this.retryButton?.on(Node.EventType.TOUCH_END, this.handleControlButtonTouchEnd, this);
        this.retryButton?.on(Node.EventType.TOUCH_CANCEL, this.handleControlButtonTouchCancel, this);
        this.retryButton?.on(Node.EventType.TOUCH_END, this.handleRetryTap, this);

        this.tipButton?.on(Node.EventType.TOUCH_START, this.handleControlButtonTouchStart, this);
        this.tipButton?.on(Node.EventType.TOUCH_END, this.handleControlButtonTouchEnd, this);
        this.tipButton?.on(Node.EventType.TOUCH_CANCEL, this.handleControlButtonTouchCancel, this);
        this.tipButton?.on(Node.EventType.TOUCH_END, this.handleTipTap, this);

        this.resolvedExitButton?.on(Node.EventType.TOUCH_START, this.handleControlButtonTouchStart, this);
        this.resolvedExitButton?.on(Node.EventType.TOUCH_END, this.handleControlButtonTouchEnd, this);
        this.resolvedExitButton?.on(Node.EventType.TOUCH_CANCEL, this.handleControlButtonTouchCancel, this);
        this.resolvedExitButton?.on(Node.EventType.TOUCH_END, this.handleExitTap, this);

    }

    private unregisterInteraction(): void {
        this.numPanelViews.forEach((panel) => {
            panel.onTap = null;
        });

        this.signPanelViews.forEach((panel) => {
            panel.onTap = null;
        });

        this.backOneButton?.off(Node.EventType.TOUCH_START, this.handleControlButtonTouchStart, this);
        this.backOneButton?.off(Node.EventType.TOUCH_END, this.handleControlButtonTouchEnd, this);
        this.backOneButton?.off(Node.EventType.TOUCH_CANCEL, this.handleControlButtonTouchCancel, this);
        this.backOneButton?.off(Node.EventType.TOUCH_END, this.handleBackOneTap, this);

        this.retryButton?.off(Node.EventType.TOUCH_START, this.handleControlButtonTouchStart, this);
        this.retryButton?.off(Node.EventType.TOUCH_END, this.handleControlButtonTouchEnd, this);
        this.retryButton?.off(Node.EventType.TOUCH_CANCEL, this.handleControlButtonTouchCancel, this);
        this.retryButton?.off(Node.EventType.TOUCH_END, this.handleRetryTap, this);

        this.tipButton?.off(Node.EventType.TOUCH_START, this.handleControlButtonTouchStart, this);
        this.tipButton?.off(Node.EventType.TOUCH_END, this.handleControlButtonTouchEnd, this);
        this.tipButton?.off(Node.EventType.TOUCH_CANCEL, this.handleControlButtonTouchCancel, this);
        this.tipButton?.off(Node.EventType.TOUCH_END, this.handleTipTap, this);

        this.resolvedExitButton?.off(Node.EventType.TOUCH_START, this.handleControlButtonTouchStart, this);
        this.resolvedExitButton?.off(Node.EventType.TOUCH_END, this.handleControlButtonTouchEnd, this);
        this.resolvedExitButton?.off(Node.EventType.TOUCH_CANCEL, this.handleControlButtonTouchCancel, this);
        this.resolvedExitButton?.off(Node.EventType.TOUCH_END, this.handleExitTap, this);

    }

    private render(): void {
        const model = this.controller.getModel();
        const finalNumberIndex = model.hasCompletedLevel ? model.getFirstActiveNumberIndex() : -1;

        this.numPanelViews.forEach((panel, index) => {
            const value = model.currentNumbers[index] ?? null;
            const isSelected = model.selectedNumberIndices.indexOf(index) >= 0;
            const isSolved = model.hasCompletedLevel && index === finalNumberIndex;

            panel.render(value, isSelected, isSolved);
        });

        this.signPanelViews.forEach((panel) => {
            const operator = panel.getOperator();
            const isSelected = model.selectedOperator === operator;
            const isEnabled = model.getActiveNumberCount() > 1;

            panel.render(isSelected, isEnabled);
        });

        this.refreshControlButtons();
        this.renderHeader(model.currentLevel);
        this.syncResultPopup();
    }

    private resolveNumPanels(): NumPanelView[] {
        if (this.numPanels.length !== 4) {
            throw new Error('GameView: numPanels must contain exactly 4 panel nodes');
        }

        return this.numPanels.map((panelNode, index) => {
            const panelView = panelNode.getComponent(NumPanelView);

            if (!panelView) {
                throw new Error(`GameView: numPanels[${index}] is missing NumPanelView`);
            }

            return panelView;
        });
    }

    private resolveSignPanels(): SignPanelView[] {
        if (this.signPanels.length !== 4) {
            throw new Error('GameView: signPanels must contain exactly 4 panel nodes');
        }

        return this.signPanels.map((panelNode, index) => {
            const panelView = panelNode.getComponent(SignPanelView);

            if (!panelView) {
                throw new Error(`GameView: signPanels[${index}] is missing SignPanelView`);
            }

            return panelView;
        });
    }

    private resolveControlButtons(): void {
        if (!this.backOneButton) {
            throw new Error('GameView: backOneButton is not assigned');
        }

        if (!this.retryButton) {
            throw new Error('GameView: retryButton is not assigned');
        }

        if (!this.tipButton) {
            throw new Error('GameView: tipButton is not assigned');
        }

        this.backOneButtonComponent = this.backOneButton.getComponent(Button);
        this.retryButtonComponent = this.retryButton.getComponent(Button);
        this.tipButtonComponent = this.tipButton.getComponent(Button);
        this.resolvedExitButton = this.resolveExitButton();
        this.exitButtonComponent = this.resolvedExitButton?.getComponent(Button) ?? null;

        if (!this.backOneButtonComponent) {
            throw new Error('GameView: backOneButton is missing Button component');
        }

        if (!this.retryButtonComponent) {
            throw new Error('GameView: retryButton is missing Button component');
        }

        if (!this.tipButtonComponent) {
            throw new Error('GameView: tipButton is missing Button component');
        }

        if (this.resolvedExitButton && !this.exitButtonComponent) {
            throw new Error('GameView: ExitBtn is missing Button component');
        }

        this.initializeControlButtonVisual(this.backOneButton, this.backOneButtonComponent);
        this.initializeControlButtonVisual(this.retryButton, this.retryButtonComponent);
        this.initializeControlButtonVisual(this.tipButton, this.tipButtonComponent);
        if (this.resolvedExitButton && this.exitButtonComponent) {
            this.initializeControlButtonVisual(this.resolvedExitButton, this.exitButtonComponent);
        }
    }

    private resolveHeaderLabels(): void {
        this.headerTitleLabel = this.resolveHeaderLabel(this.headerTitleNode, HEADER_TITLE_PATH);
        this.headerLevelNumberLabel = this.resolveHeaderLabel(this.headerLevelNumberNode, HEADER_LEVEL_NUMBER_PATH);
    }

    private refreshControlButtons(): void {
        const model = this.controller.getModel();

        if (this.backOneButtonComponent) {
            this.backOneButtonComponent.interactable = model.stepHistory.length > 0;
        }

        if (this.retryButtonComponent) {
            this.retryButtonComponent.interactable = model.currentLevel !== null;
        }

        if (this.tipButtonComponent) {
            this.tipButtonComponent.interactable = model.currentLevel !== null && !model.hasCompletedLevel;
        }

        if (this.exitButtonComponent) {
            this.exitButtonComponent.interactable = true;
        }
    }

    private initializeControlButtonVisual(buttonNode: Node, button: Button): void {
        button.transition = Button.Transition.NONE;
        this.controlButtonBaseScales.set(
            buttonNode,
            new Vec3(buttonNode.scale.x, buttonNode.scale.y, buttonNode.scale.z),
        );
    }

    private handleControlButtonTouchStart(event: EventTouch): void {
        const buttonNode = event.currentTarget as Node | null;

        if (!buttonNode || !this.isControlButtonInteractable(buttonNode)) {
            return;
        }

        this.playControlButtonScale(buttonNode, CONTROL_BUTTON_PRESS_SCALE, CONTROL_BUTTON_PRESS_DURATION);
    }

    private handleControlButtonTouchEnd(event: EventTouch): void {
        const buttonNode = event.currentTarget as Node | null;

        if (!buttonNode) {
            return;
        }

        this.restoreControlButtonScale(buttonNode);
    }

    private handleControlButtonTouchCancel(event: EventTouch): void {
        const buttonNode = event.currentTarget as Node | null;

        if (!buttonNode) {
            return;
        }

        this.restoreControlButtonScale(buttonNode);
    }

    private isControlButtonInteractable(buttonNode: Node): boolean {
        return this.getControlButtonComponent(buttonNode)?.interactable ?? false;
    }

    private getControlButtonComponent(buttonNode: Node): Button | null {
        if (buttonNode === this.backOneButton) {
            return this.backOneButtonComponent;
        }

        if (buttonNode === this.retryButton) {
            return this.retryButtonComponent;
        }

        if (buttonNode === this.tipButton) {
            return this.tipButtonComponent;
        }

        if (buttonNode === this.resolvedExitButton) {
            return this.exitButtonComponent;
        }

        return null;
    }

    private hideTransientPopups(): void {
        this.answerPopupView?.hide();
        this.resultPopupView?.hide();
    }

    private renderHeader(level: LevelModel | null): void {
        const displayLevelNumber = level ? `${this.currentLevelIndex + 1}` : '';
        const chapterTitle = level ? this.getChapterTitle(level.chapterId) : '';

        if (this.headerTitleLabel) {
            this.headerTitleLabel.string = level ? `Level ${displayLevelNumber}: ${chapterTitle}` : '';
        }

        if (this.headerLevelNumberLabel) {
            this.headerLevelNumberLabel.string = displayLevelNumber;
        }
    }

    private syncResultPopup(): void {
        const model = this.controller.getModel();

        if (!this.resultPopupView) {
            return;
        }

        if (!model.hasCompletedLevel) {
            this.reportedCompletedLevelId = null;
            if (this.resultPopupView.node.active) {
                this.resultPopupView.hide();
            }
            return;
        }

        this.answerPopupView?.hide();

        if (!this.resultPopupView.node.active) {
            this.resultPopupView.show(
                this.hasNextLevel() ? '恭喜通关' : '全部完成',
                this.hasNextLevel() ? '下一关' : '重新开始',
            );
        }

        if (model.currentLevel && this.reportedCompletedLevelId !== model.currentLevel.id) {
            this.reportedCompletedLevelId = model.currentLevel.id;
            this.onLevelCompleted?.(model.currentLevel);
        }
    }

    private playControlButtonScale(buttonNode: Node, scaleFactor: number, duration: number): void {
        const baseScale = this.controlButtonBaseScales.get(buttonNode);

        if (!baseScale) {
            return;
        }

        Tween.stopAllByTarget(buttonNode);
        tween(buttonNode)
            .to(duration, {
                scale: new Vec3(baseScale.x * scaleFactor, baseScale.y * scaleFactor, baseScale.z),
            })
            .start();
    }

    private restoreControlButtonScale(buttonNode: Node): void {
        const baseScale = this.controlButtonBaseScales.get(buttonNode);

        if (!baseScale) {
            return;
        }

        Tween.stopAllByTarget(buttonNode);
        tween(buttonNode)
            .to(CONTROL_BUTTON_RELEASE_DURATION, {
                scale: new Vec3(baseScale.x, baseScale.y, baseScale.z),
            })
            .start();
    }

    private resetControlButtonScales(): void {
        this.controlButtonBaseScales.forEach((baseScale, buttonNode) => {
            Tween.stopAllByTarget(buttonNode);
            buttonNode.setScale(baseScale);
        });
    }

    private handleBackOneTap(): void {
        if (!this.backOneButtonComponent?.interactable) {
            return;
        }

        if (!this.controller.undoLastStep()) {
            return;
        }

        this.render();
    }

    private handleRetryTap(): void {
        if (!this.retryButtonComponent?.interactable) {
            return;
        }

        this.hideTransientPopups();
        this.controller.restartLevel();
        this.render();
    }

    private handleTipTap(): void {
        if (!this.tipButtonComponent?.interactable || !this.answerPopupView) {
            return;
        }

        const answerExpression = this.controller.revealAnswer();
        this.answerPopupView.show(answerExpression);
    }

    private handleExitTap(): void {
        if (!this.exitButtonComponent?.interactable) {
            return;
        }

        this.onExitRequested?.();
    }

    private hasNextLevel(): boolean {
        return this.currentLevelIndex < this.chapterLevels.length - 1;
    }

    private handleResultNextTap(): void {
        const nextLevelIndex = this.hasNextLevel() ? this.currentLevelIndex + 1 : 0;
        this.startLevelByIndex(nextLevelIndex);
    }

    private resolveHeaderLabel(headerNode: Node | null, fallbackPath: string): Label | null {
        const resolvedNode = headerNode ?? this.findNodeByPath(fallbackPath);

        return resolvedNode?.getComponent(Label) ?? null;
    }

    private getChapterTitle(chapterId: number): string {
        return CHAPTER_TITLE_BY_ID[chapterId] ?? CHAPTER_TITLE_BY_ID[1];
    }

    private resolveExitButton(): Node | null {
        if (this.exitButton) {
            return this.exitButton;
        }

        return this.findNodeByPath('container/Header/ExitBtn');
    }

    private findNodeByPath(nodePath: string): Node | null {
        return nodePath
            .split('/')
            .reduce<Node | null>((currentNode, nodeName) => currentNode?.getChildByName(nodeName) ?? null, this.node);
    }
}
