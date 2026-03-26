import { _decorator, Button, Color, Component, Enum, Label, Node, Sprite } from 'cc';

import { AudioUtil } from '../../core/AudioUtil';
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
const SELECTED_LABEL_COLOR = new Color(69, 57, 0, 255);

@ccclass('SignPanelView')
export class SignPanelView extends Component {
    @property({ type: Enum(SignPanelType) })
    private signType: SignPanelType = SignPanelType.Add;

    public onTap: ((operator: OperatorSymbol) => void) | null = null;

    private signLabel: Label | null = null;
    private rootBackgroundSprite: Sprite | null = null;
    private normalBackgroundNode: Node | null = null;
    private selectedBackgroundNode: Node | null = null;
    private normalBackgroundSprite: Sprite | null = null;
    private selectedBackgroundSprite: Sprite | null = null;
    private button: Button | null = null;
    private isInteractable: boolean = true;
    private hasResolvedReferences: boolean = false;

    protected onLoad(): void {
        this.resolveReferencesIfNeeded();
    }

    private resolveReferencesIfNeeded(): void {
        if (this.hasResolvedReferences) {
            return;
        }

        this.signLabel = this.node.getChildByName('sign')?.getComponent(Label) ?? null;
        this.rootBackgroundSprite = this.node.getComponent(Sprite);
        this.normalBackgroundNode = this.node.getChildByName('normalBg');
        this.selectedBackgroundNode = this.node.getChildByName('selectedBg');
        this.normalBackgroundSprite = this.normalBackgroundNode?.getComponent(Sprite) ?? null;
        this.selectedBackgroundSprite = this.selectedBackgroundNode?.getComponent(Sprite) ?? null;
        this.button = this.node.getComponent(Button);

        if (!this.signLabel || !this.button) {
            throw new Error('SignPanelView: sign label or button is missing');
        }

        if (!this.rootBackgroundSprite && (!this.normalBackgroundSprite || !this.selectedBackgroundSprite)) {
            throw new Error('SignPanelView: background sprites are missing');
        }

        this.signLabel.string = this.getDisplayOperator();
        this.hasResolvedReferences = true;
    }

    protected onEnable(): void {
        this.node.on(Button.EventType.CLICK, this.handleTap, this);
    }

    protected onDisable(): void {
        this.node.off(Button.EventType.CLICK, this.handleTap, this);
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
        this.resolveReferencesIfNeeded();

        this.signLabel.string = this.getDisplayOperator();
        this.isInteractable = isEnabled;
        this.button.interactable = isEnabled;
        this.node.setScale(isSelected ? 1.08 : 1, isSelected ? 1.08 : 1, 1);
        this.signLabel.color = isSelected
            ? new Color(
                SELECTED_LABEL_COLOR.r,
                SELECTED_LABEL_COLOR.g,
                SELECTED_LABEL_COLOR.b,
                SELECTED_LABEL_COLOR.a,
            )
            : isEnabled
              ? new Color(DEFAULT_SIGN_COLOR.r, DEFAULT_SIGN_COLOR.g, DEFAULT_SIGN_COLOR.b, DEFAULT_SIGN_COLOR.a)
              : new Color(DISABLED_SIGN_COLOR.r, DISABLED_SIGN_COLOR.g, DISABLED_SIGN_COLOR.b, DISABLED_SIGN_COLOR.a);
        this.renderBackground(isSelected, isEnabled);
    }

    private handleTap(): void {
        if (!this.isInteractable || !this.onTap) {
            return;
        }

        AudioUtil.PlayMatch24();
        this.onTap?.(this.getOperator());
    }

    private getDisplayOperator(): string {
        switch (this.signType) {
            case SignPanelType.Add:
                return '+';
            case SignPanelType.Subtract:
                return '-';
            case SignPanelType.Multiply:
                return '×';
            case SignPanelType.Divide:
                return '÷';
            default:
                throw new Error(`SignPanelView.getDisplayOperator: unsupported sign type ${this.signType}`);
        }
    }

    private renderBackground(isSelected: boolean, isEnabled: boolean): void {
        if (this.normalBackgroundNode && this.selectedBackgroundNode && this.normalBackgroundSprite && this.selectedBackgroundSprite) {
            const activeNode = isSelected ? this.selectedBackgroundNode : this.normalBackgroundNode;
            const inactiveNode = isSelected ? this.normalBackgroundNode : this.selectedBackgroundNode;
            const activeSprite = isSelected ? this.selectedBackgroundSprite : this.normalBackgroundSprite;
            const inactiveSprite = isSelected ? this.normalBackgroundSprite : this.selectedBackgroundSprite;
            const activeColor = isEnabled ? DEFAULT_SIGN_COLOR : DISABLED_SIGN_COLOR;

            activeNode.active = true;
            inactiveNode.active = false;
            activeSprite.color = new Color(activeColor.r, activeColor.g, activeColor.b, activeColor.a);
            inactiveSprite.color = new Color(DEFAULT_SIGN_COLOR.r, DEFAULT_SIGN_COLOR.g, DEFAULT_SIGN_COLOR.b, DEFAULT_SIGN_COLOR.a);
            return;
        }

        if (!this.rootBackgroundSprite) {
            throw new Error('SignPanelView.renderBackground: background sprites are missing');
        }

        this.rootBackgroundSprite.color = isSelected
            ? new Color(SELECTED_SIGN_COLOR.r, SELECTED_SIGN_COLOR.g, SELECTED_SIGN_COLOR.b, SELECTED_SIGN_COLOR.a)
            : isEnabled
              ? new Color(DEFAULT_SIGN_COLOR.r, DEFAULT_SIGN_COLOR.g, DEFAULT_SIGN_COLOR.b, DEFAULT_SIGN_COLOR.a)
              : new Color(DISABLED_SIGN_COLOR.r, DISABLED_SIGN_COLOR.g, DISABLED_SIGN_COLOR.b, DISABLED_SIGN_COLOR.a);
    }
}
