import { _decorator, Button, Color, Component, Label, Node, Sprite } from 'cc';

const { ccclass } = _decorator;

const DEFAULT_CARD_COLOR = new Color(255, 255, 255, 255);
const SELECTED_CARD_COLOR = new Color(255, 226, 117, 255);
const COMPLETED_CARD_COLOR = new Color(135, 255, 170, 255);

@ccclass('NumPanelView')
export class NumPanelView extends Component {
    public onTap: (() => void) | null = null;

    private valueLabel: Label | null = null;
    private backgroundSprite: Sprite | null = null;
    private button: Button | null = null;
    private isInteractable: boolean = true;

    protected onLoad(): void {
        this.valueLabel = this.node.getChildByName('num')?.getComponent(Label) ?? null;
        this.backgroundSprite = this.node.getComponent(Sprite);
        this.button = this.node.getComponent(Button);

        if (!this.valueLabel || !this.backgroundSprite || !this.button) {
            throw new Error('NumPanelView: num label, sprite, or button is missing');
        }
    }

    protected onEnable(): void {
        this.node.on(Node.EventType.TOUCH_END, this.handleTap, this);
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.TOUCH_END, this.handleTap, this);
    }

    public render(value: number | null, isSelected: boolean, isCompleted: boolean): void {
        if (!this.valueLabel || !this.backgroundSprite || !this.button) {
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
        this.backgroundSprite.color = isCompleted
            ? new Color(COMPLETED_CARD_COLOR.r, COMPLETED_CARD_COLOR.g, COMPLETED_CARD_COLOR.b, COMPLETED_CARD_COLOR.a)
            : isSelected
              ? new Color(SELECTED_CARD_COLOR.r, SELECTED_CARD_COLOR.g, SELECTED_CARD_COLOR.b, SELECTED_CARD_COLOR.a)
              : new Color(DEFAULT_CARD_COLOR.r, DEFAULT_CARD_COLOR.g, DEFAULT_CARD_COLOR.b, DEFAULT_CARD_COLOR.a);
    }

    private handleTap(): void {
        if (!this.isInteractable) {
            return;
        }

        this.onTap?.();
    }

    private formatNumber(value: number): string {
        if (Number.isInteger(value)) {
            return `${value}`;
        }

        return `${Math.round(value * 1000) / 1000}`.replace(/\.?0+$/, '');
    }
}
