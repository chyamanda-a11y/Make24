import {
    _decorator,
    Color,
    Component,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    Tween,
    Vec3,
    tween,
} from 'cc';

import { ChapterLevelStatus } from '../../controller/chapter/ChapterController';

const { ccclass, property } = _decorator;

const PRESS_SCALE = 0.96;
const PRESS_DURATION = 0.08;
const RELEASE_DURATION = 0.1;

const COLORS = {
    passedNumber: new Color(117, 255, 147, 255),
    passedIcon: new Color(117, 255, 147, 255),
    currentText: new Color(74, 66, 33, 255),
    lockedNumber: new Color(97, 90, 54, 255),
    lockedIcon: new Color(97, 90, 54, 255),
};

export interface LevelItemRenderData {
    readonly levelId: number;
    readonly displayNumber: string;
    readonly status: ChapterLevelStatus;
    readonly isPlayable: boolean;
}

@ccclass('LevelItemView')
export class LevelItemView extends Component {
    @property(Sprite)
    private readonly outerFrameSprite: Sprite | null = null;

    @property(Sprite)
    private readonly middleFrameSprite: Sprite | null = null;

    @property(Sprite)
    private readonly backgroundSprite: Sprite | null = null;

    @property(Label)
    private readonly levelLabel: Label | null = null;

    @property(Sprite)
    private readonly statusIconSprite: Sprite | null = null;

    @property(Label)
    private readonly actionLabel: Label | null = null;

    @property(SpriteFrame)
    private readonly passBackgroundFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    private readonly lockBackgroundFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    private readonly currentBackgroundFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    private readonly currentBoxFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    private readonly passIconFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    private readonly lockIconFrame: SpriteFrame | null = null;

    public onTap: ((levelId: number) => void) | null = null;

    private levelId: number = 0;
    private isPlayable: boolean = false;
    private defaultScale: Vec3 = new Vec3(1, 1, 1);

    protected onLoad(): void {
        this.defaultScale = new Vec3(this.node.scale.x, this.node.scale.y, this.node.scale.z);
        this.validateReferences();
    }

    protected onEnable(): void {
        this.node.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.node.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.node.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
        this.resetScale();
    }

    public render(renderData: LevelItemRenderData): void {
        this.validateReferences();

        this.levelId = renderData.levelId;
        this.isPlayable = renderData.isPlayable;
        this.levelLabel!.string = renderData.displayNumber;

        switch (renderData.status) {
            case 'passed':
                this.renderPassedState();
                return;
            case 'current':
                this.renderCurrentState();
                return;
            case 'locked':
                this.renderLockedState();
                return;
            default:
                throw new Error(`LevelItemView.render: unsupported status ${renderData.status}`);
        }
    }

    private validateReferences(): void {
        if (!this.outerFrameSprite || !this.middleFrameSprite || !this.backgroundSprite || !this.levelLabel || !this.statusIconSprite || !this.actionLabel) {
            throw new Error('LevelItemView: ui references are not assigned');
        }

        if (
            !this.passBackgroundFrame
            || !this.lockBackgroundFrame
            || !this.currentBackgroundFrame
            || !this.currentBoxFrame
            || !this.passIconFrame
            || !this.lockIconFrame
        ) {
            throw new Error('LevelItemView: sprite frame references are not assigned');
        }
    }

    private renderPassedState(): void {
        this.outerFrameSprite!.node.active = false;
        this.middleFrameSprite!.node.active = false;

        this.backgroundSprite!.node.active = true;
        this.backgroundSprite!.spriteFrame = this.passBackgroundFrame;
        this.backgroundSprite!.color = Color.WHITE;

        this.levelLabel!.color = COLORS.passedNumber;
        this.statusIconSprite!.node.active = true;
        this.statusIconSprite!.spriteFrame = this.passIconFrame;
        this.statusIconSprite!.color = COLORS.passedIcon;
        this.actionLabel!.node.active = false;
    }

    private renderCurrentState(): void {
        this.outerFrameSprite!.node.active = true;
        this.outerFrameSprite!.spriteFrame = this.currentBoxFrame;
        this.outerFrameSprite!.color = Color.WHITE;

        this.middleFrameSprite!.node.active = false;

        this.backgroundSprite!.node.active = true;
        this.backgroundSprite!.spriteFrame = this.currentBackgroundFrame;
        this.backgroundSprite!.color = Color.WHITE;

        this.levelLabel!.color = COLORS.currentText;
        this.statusIconSprite!.node.active = false;
        this.actionLabel!.node.active = true;
        this.actionLabel!.color = COLORS.currentText;
    }

    private renderLockedState(): void {
        this.outerFrameSprite!.node.active = false;
        this.middleFrameSprite!.node.active = false;

        this.backgroundSprite!.node.active = true;
        this.backgroundSprite!.spriteFrame = this.lockBackgroundFrame;
        this.backgroundSprite!.color = Color.WHITE;

        this.levelLabel!.color = COLORS.lockedNumber;
        this.statusIconSprite!.node.active = true;
        this.statusIconSprite!.spriteFrame = this.lockIconFrame;
        this.statusIconSprite!.color = COLORS.lockedIcon;
        this.actionLabel!.node.active = false;
    }

    private handleTouchStart(): void {
        if (!this.isPlayable) {
            return;
        }

        this.playScale(PRESS_SCALE, PRESS_DURATION);
    }

    private handleTouchEnd(): void {
        if (!this.isPlayable) {
            this.resetScale();
            return;
        }

        this.playScale(1, RELEASE_DURATION);
        this.onTap?.(this.levelId);
    }

    private handleTouchCancel(): void {
        this.resetScale();
    }

    private playScale(scaleFactor: number, duration: number): void {
        Tween.stopAllByTarget(this.node);
        tween(this.node)
            .to(duration, {
                scale: new Vec3(
                    this.defaultScale.x * scaleFactor,
                    this.defaultScale.y * scaleFactor,
                    this.defaultScale.z,
                ),
            })
            .start();
    }

    private resetScale(): void {
        Tween.stopAllByTarget(this.node);
        this.node.setScale(this.defaultScale);
    }
}
