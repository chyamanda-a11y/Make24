import {
    _decorator,
    Button,
    Color,
    Component,
    EventTouch,
    Graphics,
    Label,
    LabelOutline,
    Layers,
    Node,
    Sprite,
    SpriteFrame,
    Tween,
    UITransform,
    Vec3,
    resources,
    tween,
    warn,
} from 'cc';
import { EDITOR } from 'cc/env';

import { GameController } from '../../controller/game/GameController';
import { LevelService } from '../../core/LevelService';
import { LevelModel } from '../../model/game/LevelModel';
import { OperatorSymbol } from '../../model/game/OperatorSymbol';

const { ccclass, executeInEditMode, property } = _decorator;

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
const GOAL_VALUE = 24;
const ACTION_PRESS_SCALE = 0.96;
const ACTION_PRESS_DURATION = 0.08;
const ACTION_RELEASE_DURATION = 0.1;

const FALLBACK_LEVEL: LevelModel = {
    id: 24001,
    chapterId: 24,
    numbers: [8, 3, 4, 2],
    answerExpression: '8*(4-(3-2))',
};

const COLORS = {
    background: new Color(16, 15, 0, 255),
    board: new Color(22, 20, 0, 255),
    boardShadow: new Color(8, 8, 0, 120),
    card: new Color(255, 231, 146, 255),
    cardSelected: new Color(255, 215, 0, 255),
    cardSolved: new Color(63, 255, 139, 255),
    cardShadow: new Color(161, 128, 0, 255),
    operator: new Color(41, 39, 0, 255),
    operatorBorder: new Color(77, 73, 21, 255),
    operatorSelected: new Color(255, 231, 146, 255),
    operatorDisabled: new Color(55, 53, 18, 255),
    reset: new Color(255, 113, 108, 255),
    resetShadow: new Color(121, 0, 16, 255),
    textPrimary: new Color(255, 231, 146, 255),
    textSecondary: new Color(179, 173, 110, 255),
    textDark: new Color(69, 57, 0, 255),
    green: new Color(63, 255, 139, 255),
    greenDim: new Color(41, 39, 0, 255),
};

interface ButtonRef {
    node: Node;
    button: Button;
}

interface NumberCardRef extends ButtonRef {
    glow: Graphics;
    shadow: Graphics;
    face: Graphics;
    label: Label;
}

interface OperatorRef extends ButtonRef {
    operator: OperatorSymbol;
    glow: Graphics;
    face: Graphics;
    label: Label | null;
    icon: Sprite | null;
}

interface ProgressBarRef {
    graphics: Graphics;
}

@ccclass('FigmaGamePage')
@executeInEditMode(true)
export class FigmaGamePage extends Component {
    @property({ type: String })
    private levelFileName: string = 'chapter_figma_demo';

    private readonly controller: GameController = new GameController();
    private readonly levelService: LevelService = new LevelService();
    private readonly buttonBaseScales: Map<Node, Vec3> = new Map();
    private readonly numberCards: NumberCardRef[] = [];
    private readonly operatorButtons: OperatorRef[] = [];
    private readonly progressBars: ProgressBarRef[] = [];

    private progressLabel: Label | null = null;
    private targetLabel: Label | null = null;
    private targetValueLabel: Label | null = null;
    private undoButton: ButtonRef | null = null;
    private resetButton: ButtonRef | null = null;
    private initialized: boolean = false;

    protected onLoad(): void {
        this.ensureRootTransform();
        this.ensureLayout();
    }

    protected start(): void {
        if (EDITOR) {
            return;
        }

        void this.initialize();
    }

    protected onDisable(): void {
        this.resetButtonScales();
    }

    private async initialize(): Promise<void> {
        const level = await this.loadInitialLevel();

        this.controller.startLevel(level);

        if (!this.targetValueLabel || !this.targetLabel || !this.progressLabel) {
            throw new Error('FigmaGamePage.initialize: required labels are missing');
        }

        this.targetLabel.string = 'TARGET';
        this.targetValueLabel.string = `${GOAL_VALUE}`;
        this.initialized = true;
        this.render();

        void this.loadIconsSafely();
    }

    private async loadInitialLevel(): Promise<LevelModel> {
        try {
            const config = await this.levelService.loadChapterConfig(this.levelFileName);
            const level = config.levels[0];

            return level ?? FALLBACK_LEVEL;
        } catch {
            return FALLBACK_LEVEL;
        }
    }

    private async loadIcons(): Promise<void> {
        const tasks: Array<Promise<void>> = [];

        tasks.push(this.assignSpriteFrame('figma/level24-master/header-grid', 'HeaderLeadingIcon'));
        tasks.push(this.assignSpriteFrame('figma/level24-master/header-trophy', 'HeaderTrailingIcon'));
        tasks.push(this.assignSpriteFrame('figma/level24-master/undo', 'UndoIcon'));
        tasks.push(this.assignSpriteFrame('figma/level24-master/reset-icon', 'ResetIcon'));
        tasks.push(this.assignSpriteFrame('figma/level24-master/operator-multiply', 'OperatorMultiplyIcon'));

        const results = await Promise.all(
            tasks.map(async (task) => {
                try {
                    await task;
                    return true;
                } catch (error) {
                    warn('FigmaGamePage: failed to load a Figma icon', error);
                    return false;
                }
            }),
        );
        const failedCount = results.filter((result) => !result).length;

        if (failedCount > 0) {
            warn(`FigmaGamePage: ${failedCount} Figma icon(s) failed to load`);
        }
    }

    private async loadIconsSafely(): Promise<void> {
        try {
            await this.loadIcons();
        } catch (error) {
            warn('FigmaGamePage: Figma icons are not ready yet. Refresh assets in Cocos and reopen the scene.', error);
        }
    }

    private async assignSpriteFrame(resourcePath: string, nodeName: string): Promise<void> {
        const targetNode = this.findChild(nodeName);

        if (!targetNode) {
            throw new Error(`FigmaGamePage.assignSpriteFrame: ${nodeName} is missing`);
        }

        const sprite = targetNode.getComponent(Sprite);

        if (!sprite) {
            throw new Error(`FigmaGamePage.assignSpriteFrame: ${nodeName} is missing Sprite`);
        }

        sprite.spriteFrame = await this.loadSpriteFrame(resourcePath);
    }

    private async loadSpriteFrame(resourcePath: string): Promise<SpriteFrame> {
        return await new Promise<SpriteFrame>((resolve, reject) => {
            resources.load(`${resourcePath}/spriteFrame`, SpriteFrame, (error, asset) => {
                if (error || !asset) {
                    reject(error ?? new Error(`Missing sprite frame at ${resourcePath}`));
                    return;
                }

                resolve(asset);
            });
        });
    }

    private ensureRootTransform(): void {
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        this.node.setPosition(0, 0, 0);
    }

    private ensureLayout(): void {
        this.resetLayoutRefs();

        this.createBackground();
        this.createHeader();
        this.createTargetSection();
        this.createProgressSection();
        this.createBoard();
        this.createResetButton();
    }

    private resetLayoutRefs(): void {
        this.numberCards.length = 0;
        this.operatorButtons.length = 0;
        this.progressBars.length = 0;
        this.progressLabel = null;
        this.targetLabel = null;
        this.targetValueLabel = null;
        this.undoButton = null;
        this.resetButton = null;
    }

    private createBackground(): void {
        const background = this.createNode('Background', this.node, new Vec3(0, 0, 0), 720, 1280);
        const graphics = background.getComponent(Graphics) ?? background.addComponent(Graphics);
        this.drawRoundedRect(graphics, 720, 1280, 0, COLORS.background);
    }

    private createHeader(): void {
        const header = this.createNode('Header', this.node, new Vec3(0, 562, 0), 624, 72);

        this.createIconNode('HeaderLeadingIcon', header, new Vec3(-286, 0, 0), 45, 45);
        this.createLabel(header, new Vec3(-208, 0, 0), 360, 44, 'Level 24: Master', 36, COLORS.textPrimary, 0);
        this.createLabel(header, new Vec3(204, 0, 0), 80, 48, '24', 48, COLORS.textPrimary, 1);
        this.createIconNode('HeaderTrailingIcon', header, new Vec3(286, 0, 0), 45, 45);
    }

    private createTargetSection(): void {
        this.targetLabel = this.createLabel(
            this.node,
            new Vec3(-258, 426, 0),
            180,
            28,
            'TARGET',
            20,
            COLORS.textSecondary,
            0,
        );

        this.targetValueLabel = this.createLabel(
            this.node,
            new Vec3(-198, 318, 0),
            240,
            160,
            '24',
            160,
            COLORS.textPrimary,
            0,
        );
    }

    private createProgressSection(): void {
        const group = this.createNode('ProgressGroup', this.node, new Vec3(176, 364, 0), 220, 80);

        const positions = [-64, 0, 64];

        positions.forEach((x, index) => {
            const barNode = this.createNode(`ProgressBar${index + 1}`, group, new Vec3(x, 12, 0), 54, 20);
            const graphics = barNode.getComponent(Graphics) ?? barNode.addComponent(Graphics);
            this.drawRoundedRect(graphics, 54, 20, 10, COLORS.greenDim);
            this.progressBars.push({ graphics });
        });

        this.progressLabel = this.createLabel(
            group,
            new Vec3(0, -20, 0),
            220,
            28,
            '0 / 3 SOLVED',
            20,
            COLORS.green,
            1,
        );
    }

    private createBoard(): void {
        const boardShadow = this.createNode('BoardShadow', this.node, new Vec3(0, -18, 0), 624, 624);
        const boardShadowGraphics = boardShadow.getComponent(Graphics) ?? boardShadow.addComponent(Graphics);
        this.drawRoundedRect(boardShadowGraphics, 624, 624, 72, COLORS.boardShadow);

        const board = this.createNode('Board', this.node, new Vec3(0, 52, 0), 624, 624);
        const boardGraphics = board.getComponent(Graphics) ?? board.addComponent(Graphics);
        this.drawRoundedRect(boardGraphics, 624, 624, 72, COLORS.board);

        this.createNumberCard(board, 'NumberCard1', new Vec3(-198, 198, 0));
        this.createNumberCard(board, 'NumberCard2', new Vec3(198, 198, 0));
        this.createNumberCard(board, 'NumberCard3', new Vec3(-198, -198, 0));
        this.createNumberCard(board, 'NumberCard4', new Vec3(198, -198, 0));

        this.createOperatorButton(board, 'OperatorAdd', new Vec3(0, 198, 0), '+');
        this.createOperatorButton(board, 'OperatorMultiply', new Vec3(-198, 0, 0), '*');
        this.createOperatorButton(board, 'OperatorSubtract', new Vec3(198, 0, 0), '-');
        this.createOperatorButton(board, 'OperatorDivide', new Vec3(0, -198, 0), '/');

        this.createUndoButton(board, new Vec3(0, 0, 0));
    }

    private createResetButton(): void {
        const buttonNode = this.createNode('ResetButton', this.node, new Vec3(0, -378, 0), 600, 106);
        const shadowNode = this.createNode('ResetButtonShadow', buttonNode, new Vec3(0, -12, 0), 600, 106);
        const shadowGraphics = shadowNode.getComponent(Graphics) ?? shadowNode.addComponent(Graphics);
        this.drawRoundedRect(shadowGraphics, 600, 106, 53, COLORS.resetShadow);

        const faceNode = this.createNode('ResetButtonFace', buttonNode, new Vec3(0, 0, 0), 600, 96);
        const faceGraphics = faceNode.getComponent(Graphics) ?? faceNode.addComponent(Graphics);
        this.drawRoundedRect(faceGraphics, 600, 96, 48, COLORS.reset);

        this.createIconNode('ResetIcon', buttonNode, new Vec3(-118, 0, 1), 32, 32);
        this.createLabel(buttonNode, new Vec3(56, 0, 1), 320, 40, 'RESET PUZZLE', 36, new Color(58, 0, 4, 255), 1);

        this.resetButton = this.attachButton(buttonNode, (): void => {
            if (!this.initialized || !this.resetButton?.button.interactable) {
                return;
            }

            this.controller.restartLevel();
            this.render();
        });
    }

    private createNumberCard(parent: Node, name: string, position: Vec3): void {
        const root = this.createNode(name, parent, position, 160, 160);
        const glowNode = this.createNode(`${name}Glow`, root, new Vec3(0, 12, 0), 208, 208);
        const shadowNode = this.createNode(`${name}Shadow`, root, new Vec3(0, -16, 0), 160, 160);
        const faceNode = this.createNode(`${name}Face`, root, new Vec3(0, 0, 1), 160, 160);

        const glow = glowNode.getComponent(Graphics) ?? glowNode.addComponent(Graphics);
        const shadow = shadowNode.getComponent(Graphics) ?? shadowNode.addComponent(Graphics);
        const face = faceNode.getComponent(Graphics) ?? faceNode.addComponent(Graphics);
        const label = this.createLabel(root, new Vec3(0, 0, 2), 120, 72, '0', 72, COLORS.textDark, 1);

        this.drawRoundedRect(glow, 208, 208, 40, new Color(255, 231, 146, 0));
        this.drawRoundedRect(shadow, 160, 160, 34, COLORS.cardShadow);
        this.drawRoundedRect(face, 160, 160, 34, COLORS.card);

        const ref = this.attachButton(root, (): void => {
            if (!this.initialized) {
                return;
            }

            const index = this.numberCards.findIndex((card) => card.node === root);

            if (index < 0) {
                return;
            }

            this.controller.handleNumberTap(index);
            this.render();
        });

        this.numberCards.push({
            ...ref,
            glow,
            shadow,
            face,
            label,
        });
    }

    private createOperatorButton(parent: Node, name: string, position: Vec3, operator: OperatorSymbol): void {
        const root = this.createNode(name, parent, position, 96, 96);
        const glowNode = this.createNode(`${name}Glow`, root, new Vec3(0, 0, 0), 120, 120);
        const faceNode = this.createNode(`${name}Face`, root, new Vec3(0, 0, 1), 96, 96);

        const glow = glowNode.getComponent(Graphics) ?? glowNode.addComponent(Graphics);
        const face = faceNode.getComponent(Graphics) ?? faceNode.addComponent(Graphics);
        let label: Label | null = null;
        let icon: Sprite | null = null;

        if (operator === '*') {
            icon = this.createIconNode('OperatorMultiplyIcon', root, new Vec3(0, 0, 2), 28, 28).getComponent(Sprite);
        } else {
            label = this.createLabel(root, new Vec3(0, 0, 2), 64, 40, operator, 36, COLORS.textPrimary, 1);
        }

        this.drawCircle(glow, 120, new Color(255, 231, 146, 0));
        this.drawCircle(face, 96, COLORS.operator);

        const ref = this.attachButton(root, (): void => {
            if (!this.initialized) {
                return;
            }

            this.controller.handleOperatorTap(operator);
            this.render();
        });

        this.operatorButtons.push({
            ...ref,
            operator,
            glow,
            face,
            label,
            icon,
        });
    }

    private createUndoButton(parent: Node, position: Vec3): void {
        const root = this.createNode('UndoButton', parent, position, 112, 112);
        const faceNode = this.createNode('UndoButtonFace', root, new Vec3(0, 0, 1), 112, 112);
        const iconNode = this.createIconNode('UndoIcon', root, new Vec3(0, 0, 2), 36, 36);
        const iconSprite = iconNode.getComponent(Sprite);

        if (iconSprite) {
            iconSprite.color = new Color(
                COLORS.textPrimary.r,
                COLORS.textPrimary.g,
                COLORS.textPrimary.b,
                COLORS.textPrimary.a,
            );
        }

        const faceGraphics = faceNode.getComponent(Graphics) ?? faceNode.addComponent(Graphics);
        this.drawCircle(faceGraphics, 112, new Color(48, 45, 0, 255));

        this.undoButton = this.attachButton(root, (): void => {
            if (!this.initialized || !this.undoButton?.button.interactable) {
                return;
            }

            if (!this.controller.undoLastStep()) {
                return;
            }

            this.render();
        });
    }

    private attachButton(node: Node, onTap: () => void): ButtonRef {
        const button = node.getComponent(Button) ?? node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        this.buttonBaseScales.set(node, new Vec3(node.scale.x, node.scale.y, node.scale.z));

        node.targetOff(this);
        node.on(Node.EventType.TOUCH_START, this.handleButtonTouchStart, this);
        node.on(Node.EventType.TOUCH_END, this.handleButtonTouchEnd, this);
        node.on(Node.EventType.TOUCH_CANCEL, this.handleButtonTouchCancel, this);
        node.on(Node.EventType.TOUCH_END, onTap, this);

        return { node, button };
    }

    private handleButtonTouchStart(event: EventTouch): void {
        const node = event.currentTarget as Node | null;

        if (!node) {
            return;
        }

        const button = node.getComponent(Button);

        if (!button?.interactable) {
            return;
        }

        const baseScale = this.buttonBaseScales.get(node);

        if (!baseScale) {
            return;
        }

        Tween.stopAllByTarget(node);
        tween(node)
            .to(ACTION_PRESS_DURATION, {
                scale: new Vec3(baseScale.x * ACTION_PRESS_SCALE, baseScale.y * ACTION_PRESS_SCALE, baseScale.z),
            })
            .start();
    }

    private handleButtonTouchEnd(event: EventTouch): void {
        this.restoreButtonScale(event.currentTarget as Node | null);
    }

    private handleButtonTouchCancel(event: EventTouch): void {
        this.restoreButtonScale(event.currentTarget as Node | null);
    }

    private restoreButtonScale(node: Node | null): void {
        if (!node) {
            return;
        }

        const baseScale = this.buttonBaseScales.get(node);

        if (!baseScale) {
            return;
        }

        Tween.stopAllByTarget(node);
        tween(node)
            .to(ACTION_RELEASE_DURATION, {
                scale: new Vec3(baseScale.x, baseScale.y, baseScale.z),
            })
            .start();
    }

    private resetButtonScales(): void {
        this.buttonBaseScales.forEach((scale, node) => {
            Tween.stopAllByTarget(node);
            node.setScale(scale);
        });
    }

    private render(): void {
        if (!this.progressLabel || !this.resetButton || !this.undoButton) {
            throw new Error('FigmaGamePage.render: required UI references are missing');
        }

        const model = this.controller.getModel();
        const stepCount = model.currentLevel ? model.currentLevel.numbers.length - 1 : 3;
        const solvedCount = model.stepHistory.length;
        const finalNumberIndex = model.hasCompletedLevel ? model.getFirstActiveNumberIndex() : -1;

        this.numberCards.forEach((card, index) => {
            const value = model.currentNumbers[index];
            const isVisible = value !== undefined && value !== null;
            const isSelected = model.selectedNumberIndices.includes(index);
            const isSolved = model.hasCompletedLevel && index === finalNumberIndex;

            card.node.active = isVisible;
            card.button.interactable = isVisible && !model.hasCompletedLevel;

            if (value === undefined || value === null) {
                return;
            }

            card.label.string = this.formatNumber(value);
            this.drawRoundedRect(
                card.face,
                160,
                160,
                34,
                isSolved ? COLORS.cardSolved : isSelected ? COLORS.cardSelected : COLORS.card,
            );
            this.drawRoundedRect(
                card.shadow,
                160,
                160,
                34,
                isSolved ? new Color(24, 125, 72, 255) : COLORS.cardShadow,
            );
            this.drawRoundedRect(
                card.glow,
                208,
                208,
                40,
                isSelected ? new Color(255, 231, 146, 64) : new Color(255, 231, 146, 0),
            );
            card.label.color = new Color(COLORS.textDark.r, COLORS.textDark.g, COLORS.textDark.b, COLORS.textDark.a);
        });

        this.operatorButtons.forEach((operatorRef) => {
            const isSelected = model.selectedOperator === operatorRef.operator;
            const isEnabled = model.getActiveNumberCount() > 1 && !model.hasCompletedLevel;

            operatorRef.button.interactable = isEnabled;
            this.drawCircle(
                operatorRef.face,
                96,
                isSelected ? COLORS.operatorSelected : isEnabled ? COLORS.operator : COLORS.operatorDisabled,
            );
            this.drawCircle(
                operatorRef.glow,
                120,
                isSelected ? new Color(255, 231, 146, 54) : new Color(255, 231, 146, 0),
            );

            if (operatorRef.label) {
                operatorRef.label.color = isSelected ? COLORS.textDark : COLORS.textPrimary;
            }

            if (operatorRef.icon) {
                operatorRef.icon.color = isSelected ? COLORS.textDark : COLORS.textPrimary;
                operatorRef.icon.node.active = true;
            }
        });

        this.progressBars.forEach((barRef, index) => {
            this.drawRoundedRect(
                barRef.graphics,
                54,
                20,
                10,
                index < solvedCount ? COLORS.green : COLORS.greenDim,
            );
        });

        this.progressLabel.string = `${solvedCount} / ${stepCount} SOLVED`;
        this.undoButton.button.interactable = model.stepHistory.length > 0;
        this.resetButton.button.interactable = model.currentLevel !== null;
    }

    private createNode(name: string, parent: Node, position: Vec3, width: number, height: number): Node {
        const existingNode = parent.getChildByName(name);

        if (existingNode) {
            const existingTransform = existingNode.getComponent(UITransform) ?? existingNode.addComponent(UITransform);

            if (existingTransform.contentSize.width === 0 && existingTransform.contentSize.height === 0) {
                existingTransform.setContentSize(width, height);
            }

            existingNode.layer = parent.layer || Layers.Enum.UI_2D;
            return existingNode;
        }

        const node = new Node(name);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, height);
        node.setPosition(position);
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        return node;
    }

    private createLabel(
        parent: Node,
        position: Vec3,
        width: number,
        height: number,
        text: string,
        fontSize: number,
        color: Color,
        horizontalAlign: number,
    ): Label {
        const labelNode = this.createNode(`${text || 'Label'}Node`, parent, position, width, height);
        const label = labelNode.getComponent(Label) ?? labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize;
        label.horizontalAlign = horizontalAlign;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(color.r, color.g, color.b, color.a);
        label.isBold = true;
        label.overflow = Label.Overflow.SHRINK;

        const outline = labelNode.getComponent(LabelOutline) ?? labelNode.addComponent(LabelOutline);
        outline.color = new Color(0, 0, 0, 48);
        outline.width = 2;

        return label;
    }

    private createIconNode(name: string, parent: Node, position: Vec3, width: number, height: number): Node {
        const node = this.createNode(name, parent, position, width, height);
        const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        return node;
    }

    private drawRoundedRect(graphics: Graphics, width: number, height: number, radius: number, color: Color): void {
        const transform = graphics.node.getComponent(UITransform);
        const actualWidth = transform?.contentSize.width ?? width;
        const actualHeight = transform?.contentSize.height ?? height;

        graphics.clear();
        graphics.fillColor = new Color(color.r, color.g, color.b, color.a);
        graphics.roundRect(-actualWidth / 2, -actualHeight / 2, actualWidth, actualHeight, radius);
        graphics.fill();
    }

    private drawCircle(graphics: Graphics, diameter: number, color: Color): void {
        const transform = graphics.node.getComponent(UITransform);
        const actualDiameter = transform
            ? Math.min(transform.contentSize.width, transform.contentSize.height)
            : diameter;

        graphics.clear();
        graphics.fillColor = new Color(color.r, color.g, color.b, color.a);
        graphics.circle(0, 0, actualDiameter / 2);
        graphics.fill();
    }

    private formatNumber(value: number): string {
        if (Number.isInteger(value)) {
            return `${value}`;
        }

        return `${Math.round(value * 1000) / 1000}`.replace(/\.?0+$/, '');
    }

    private findChild(name: string): Node | null {
        return this.node.getChildByName('Header')?.getChildByName(name)
            ?? this.node.getChildByName('ResetButton')?.getChildByName(name)
            ?? this.node.getChildByName('Board')?.getChildByName('OperatorMultiply')?.getChildByName(name)
            ?? this.node.getChildByName('Board')?.getChildByName('UndoButton')?.getChildByName(name)
            ?? null;
    }
}
