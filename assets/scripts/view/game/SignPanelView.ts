import { _decorator, Button, Color, Component, Enum, Label, Node, Sprite } from 'cc';

import { OperatorSymbol } from '../../model/game/OperatorSymbol';

const { ccclass, property } = _decorator;

export enum SignPanelType {
    Add = 0,
    Subtract = 1,
    Multiply = 2,
    Divide = 3,
}

const DEFAULT_SIGN_COLOR = new Color(255, 255, 255, 255);
const SELECTED_SIGN_COLOR = new Color(255, 226, 117, 255);
const DISABLED_SIGN_COLOR = new Color(190, 190, 190, 255);

@ccclass('SignPanelView')
export class SignPanelView extends Component {
    @property({ type: Enum(SignPanelType) })
    private signType: SignPanelType = SignPanelType.Add;

    public onTap: ((operator: OperatorSymbol) => void) | null = null;

    private signLabel: Label | null = null;
    private backgroundSprite: Sprite | null = null;
    private button: Button | null = null;
    private isInteractable: boolean = true;

    protected onLoad(): void {
        this.signLabel = this.node.getChildByName('sign')?.getComponent(Label) ?? null;
        this.backgroundSprite = this.node.getComponent(Sprite);
        this.button = this.node.getComponent(Button);

        if (!this.signLabel || !this.backgroundSprite || !this.button) {
            throw new Error('SignPanelView: sign label, sprite, or button is missing');
        }

        this.signLabel.string = this.getOperator();
    }

    protected onEnable(): void {
        this.node.on(Node.EventType.TOUCH_END, this.handleTap, this);
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.TOUCH_END, this.handleTap, this);
    }

    public getOperator(): OperatorSymbol {
        switch (this.signType) {
            case SignPanelType.Add:
                return '+';
            case SignPanelType.Subtract:
                return '-';
            case SignPanelType.Multiply:
                return '*';
            case SignPanelType.Divide:
                return '/';
            default:
                throw new Error(`SignPanelView.getOperator: unsupported sign type ${this.signType}`);
        }
    }

    public render(isSelected: boolean, isEnabled: boolean): void {
        if (!this.signLabel || !this.backgroundSprite || !this.button) {
            throw new Error('SignPanelView.render: panel references are missing');
        }

        this.signLabel.string = this.getOperator();
        this.isInteractable = isEnabled;
        this.button.interactable = isEnabled;
        this.node.setScale(isSelected ? 1.08 : 1, isSelected ? 1.08 : 1, 1);
        this.backgroundSprite.color = isSelected
            ? new Color(SELECTED_SIGN_COLOR.r, SELECTED_SIGN_COLOR.g, SELECTED_SIGN_COLOR.b, SELECTED_SIGN_COLOR.a)
            : isEnabled
              ? new Color(DEFAULT_SIGN_COLOR.r, DEFAULT_SIGN_COLOR.g, DEFAULT_SIGN_COLOR.b, DEFAULT_SIGN_COLOR.a)
              : new Color(DISABLED_SIGN_COLOR.r, DISABLED_SIGN_COLOR.g, DISABLED_SIGN_COLOR.b, DISABLED_SIGN_COLOR.a);
    }

    private handleTap(): void {
        if (!this.isInteractable) {
            return;
        }

        this.onTap?.(this.getOperator());
    }
}
