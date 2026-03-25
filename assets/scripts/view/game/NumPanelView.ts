import { _decorator, Button, Color, Component, Label, Node, Sprite } from 'cc';

import { AudioUtil } from '../../core/AudioUtil';

const { ccclass } = _decorator;

const DEFAULT_CARD_COLOR = new Color(255, 255, 255, 255);
const SELECTED_CARD_COLOR = new Color(255, 226, 117, 255);
const COMPLETED_CARD_COLOR = new Color(135, 255, 170, 255);

@ccclass('NumPanelView')
export class NumPanelView extends Component {
    public onTap: (() => void) | null = null;

    private valueLabel: Label | null = null;
    private rootBackgroundSprite: Sprite | null = null;
    private normalBackgroundNode: Node | null = null;
    private selectedBackgroundNode: Node | null = null;
    private normalBackgroundSprite: Sprite | null = null;
    private selectedBackgroundSprite: Sprite | null = null;
    private button: Button | null = null;
    private isInteractable: boolean = true;

    protected onLoad(): void {
        this.valueLabel = this.node.getChildByName('num')?.getComponent(Label) ?? null;
        this.rootBackgroundSprite = this.node.getComponent(Sprite);
        this.normalBackgroundNode = this.node.getChildByName('normalBg');
        this.selectedBackgroundNode = this.node.getChildByName('selectedBg');
        this.normalBackgroundSprite = this.normalBackgroundNode?.getComponent(Sprite) ?? null;
        this.selectedBackgroundSprite = this.selectedBackgroundNode?.getComponent(Sprite) ?? null;
        this.button = this.node.getComponent(Button);

        if (!this.valueLabel || !this.button) {
            throw new Error('NumPanelView: num label or button is missing');
        }

        if (!this.rootBackgroundSprite && (!this.normalBackgroundSprite || !this.selectedBackgroundSprite)) {
            throw new Error('NumPanelView: background sprites are missing');
        }
    }

    protected onEnable(): void {
        this.node.on(Button.EventType.CLICK, this.handleTap, this);
    }

    protected onDisable(): void {
        this.node.off(Button.EventType.CLICK, this.handleTap, this);
    }

    public render(value: number | null, isSelected: boolean, isCompleted: boolean): void {
        if (!this.valueLabel || !this.button) {
            throw new Error('NumPanelView.render: panel references are missing');
        }

        const isVisible = value !== null;
        this.node.active = isVisible;

        if (!isVisible) {
            return;
        }

        this.valueLabel.string = this.formatNumber(value);
        this.isInteractable = !isCompleted;
        this.button.interactable = this.isInteractable;
        this.node.setScale(isSelected ? 1.08 : 1, isSelected ? 1.08 : 1, 1);
        this.renderBackground(isSelected, isCompleted);
    }

    private handleTap(): void {
        if (!this.isInteractable || !this.onTap) {
            return;
        }

        AudioUtil.PlayMatch24();
        this.onTap?.();
    }

    private formatNumber(value: number): string {
        if (Number.isInteger(value)) {
            return `${value}`;
        }

        return `${Math.round(value * 1000) / 1000}`.replace(/\.?0+$/, '');
    }

    private renderBackground(isSelected: boolean, isCompleted: boolean): void {
        if (this.normalBackgroundNode && this.selectedBackgroundNode && this.normalBackgroundSprite && this.selectedBackgroundSprite) {
            const shouldShowSelectedBackground = isSelected || isCompleted;
            const activeNode = shouldShowSelectedBackground ? this.selectedBackgroundNode : this.normalBackgroundNode;
            const inactiveNode = shouldShowSelectedBackground ? this.normalBackgroundNode : this.selectedBackgroundNode;
            const activeSprite = shouldShowSelectedBackground ? this.selectedBackgroundSprite : this.normalBackgroundSprite;
            const inactiveSprite = shouldShowSelectedBackground ? this.normalBackgroundSprite : this.selectedBackgroundSprite;
            const activeColor = isCompleted ? COMPLETED_CARD_COLOR : DEFAULT_CARD_COLOR;

            activeNode.active = true;
            inactiveNode.active = false;
            activeSprite.color = new Color(activeColor.r, activeColor.g, activeColor.b, activeColor.a);
            inactiveSprite.color = new Color(DEFAULT_CARD_COLOR.r, DEFAULT_CARD_COLOR.g, DEFAULT_CARD_COLOR.b, DEFAULT_CARD_COLOR.a);
            return;
        }

        if (!this.rootBackgroundSprite) {
            throw new Error('NumPanelView.renderBackground: background sprites are missing');
        }

        this.rootBackgroundSprite.color = isCompleted
            ? new Color(COMPLETED_CARD_COLOR.r, COMPLETED_CARD_COLOR.g, COMPLETED_CARD_COLOR.b, COMPLETED_CARD_COLOR.a)
            : isSelected
              ? new Color(SELECTED_CARD_COLOR.r, SELECTED_CARD_COLOR.g, SELECTED_CARD_COLOR.b, SELECTED_CARD_COLOR.a)
              : new Color(DEFAULT_CARD_COLOR.r, DEFAULT_CARD_COLOR.g, DEFAULT_CARD_COLOR.b, DEFAULT_CARD_COLOR.a);
    }
}
