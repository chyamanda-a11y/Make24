import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('AnswerPopupView')
export class AnswerPopupView extends Component {
    @property(Label)
    private readonly answerLabel: Label | null = null;

    protected onLoad(): void {
        if (!this.answerLabel) {
            throw new Error('AnswerPopupView: answerLabel is not assigned');
        }
    }

    public show(answerExpression: string): void {
        if (!this.answerLabel) {
            throw new Error('AnswerPopupView.show: answerLabel is not assigned');
        }

        this.answerLabel.string = answerExpression;
        this.node.active = true;
    }

    public hide(): void {
        this.node.active = false;
    }
}
