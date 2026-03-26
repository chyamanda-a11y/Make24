import { _decorator, Button, Component, Label } from 'cc';

import { AudioUtil } from '../../core/AudioUtil';

const { ccclass } = _decorator;

@ccclass('AnswerPopupView')
export class AnswerPopupView extends Component {
    private answerLabel: Label | null = null;
    private closeButton: Button | null = null;
    private hasResolvedReferences: boolean = false;

    protected onLoad(): void {
        this.resolveReferencesIfNeeded();
    }

    private resolveReferencesIfNeeded(): void {
        if (this.hasResolvedReferences) {
            return;
        }

        this.answerLabel = this.node.getChildByName('formulaBg')?.getChildByName('tip')?.getComponent(Label) ?? null;
        this.closeButton = this.node.getChildByName('Button')?.getComponent(Button) ?? null;

        if (!this.answerLabel) {
            throw new Error('AnswerPopupView: answerLabel is not assigned');
        }

        if (!this.closeButton) {
            throw new Error('AnswerPopupView: closeButton is not assigned');
        }

        this.hasResolvedReferences = true;
    }

    protected onEnable(): void {
        this.closeButton?.node.on(Button.EventType.CLICK, this.handleCloseTap, this);
    }

    protected onDisable(): void {
        this.closeButton?.node.off(Button.EventType.CLICK, this.handleCloseTap, this);
    }

    public show(answerExpression: string): void {
        this.resolveReferencesIfNeeded();

        this.answerLabel.string = this.formatExpressionForDisplay(answerExpression);
        this.node.active = true;
    }

    public hide(): void {
        this.node.active = false;
    }

    private handleCloseTap(): void {
        AudioUtil.PlayNormalBtn();
        this.hide();
    }

    private formatExpressionForDisplay(answerExpression: string): string {
        return answerExpression.replace(/\*/g, '×').replace(/\//g, '÷');
    }
}
