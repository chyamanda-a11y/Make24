import { _decorator, Button, Component, EventTouch, Node, Prefab, Tween, instantiate, resources, tween, Vec3 } from 'cc';

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

    @property({ type: String })
    private readonly levelFileName: string = 'chapter_01';

    private readonly controller: GameController = new GameController();
    private readonly levelService: LevelService = new LevelService();
    private numPanelViews: NumPanelView[] = [];
    private signPanelViews: SignPanelView[] = [];
    private backOneButtonComponent: Button | null = null;
    private retryButtonComponent: Button | null = null;
    private tipButtonComponent: Button | null = null;
    private answerPopupView: AnswerPopupView | null = null;
    private resultPopupView: ResultPopupView | null = null;
    private chapterLevels: readonly LevelModel[] = [];
    private currentLevelIndex: number = 0;
    private readonly controlButtonBaseScales: Map<Node, Vec3> = new Map();

    protected onLoad(): void {
        this.numPanelViews = this.resolveNumPanels();
        this.signPanelViews = this.resolveSignPanels();
        this.resolveControlButtons();
        this.validatePanelReferences();
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
        const [chapterLevels] = await Promise.all([
            this.loadChapterLevels(),
            this.initializePopupViews(),
        ]);

        this.chapterLevels = chapterLevels;
        this.startLevelByIndex(0);
    }

    private async loadChapterLevels(): Promise<readonly LevelModel[]> {
        try {
            const config = await this.levelService.loadChapterConfig(this.levelFileName);

            return config.levels.length > 0 ? config.levels : [FALLBACK_LEVEL];
        } catch {
            return [FALLBACK_LEVEL];
        }
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
        this.hideTransientPopups();
        this.controller.startLevel(level);
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

    }

    private render(): void {
        const model = this.controller.getModel();
        const finalNumberIndex = model.hasCompletedLevel ? model.getFirstActiveNumberIndex() : -1;

        this.numPanelViews.forEach((panel, index) => {
            const value = model.currentNumbers[index] ?? null;
            const isSelected = model.selectedNumberIndices.includes(index);
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

        if (!this.backOneButtonComponent) {
            throw new Error('GameView: backOneButton is missing Button component');
        }

        if (!this.retryButtonComponent) {
            throw new Error('GameView: retryButton is missing Button component');
        }

        if (!this.tipButtonComponent) {
            throw new Error('GameView: tipButton is missing Button component');
        }

        this.initializeControlButtonVisual(this.backOneButton, this.backOneButtonComponent);
        this.initializeControlButtonVisual(this.retryButton, this.retryButtonComponent);
        this.initializeControlButtonVisual(this.tipButton, this.tipButtonComponent);
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

        return null;
    }

    private hideTransientPopups(): void {
        this.answerPopupView?.hide();
        this.resultPopupView?.hide();
    }

    private syncResultPopup(): void {
        const model = this.controller.getModel();

        if (!this.resultPopupView) {
            return;
        }

        if (!model.hasCompletedLevel) {
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

    private hasNextLevel(): boolean {
        return this.currentLevelIndex < this.chapterLevels.length - 1;
    }

    private handleResultNextTap(): void {
        const nextLevelIndex = this.hasNextLevel() ? this.currentLevelIndex + 1 : 0;
        this.startLevelByIndex(nextLevelIndex);
    }
}
