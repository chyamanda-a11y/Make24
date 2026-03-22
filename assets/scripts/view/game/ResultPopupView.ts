import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ResultPopupView')
export class ResultPopupView extends Component {
    @property(Label)
    private readonly titleLabel: Label | null = null;

    public onNextTap: (() => void) | null = null;
    public onReplayTap: (() => void) | null = null;

    protected onLoad(): void {
        if (!this.titleLabel) {
            throw new Error('ResultPopupView: titleLabel is not assigned');
        }
    }

    public show(title: string): void {
        if (!this.titleLabel) {
            throw new Error('ResultPopupView.show: titleLabel is not assigned');
        }

        this.titleLabel.string = title;
        this.node.active = true;
    }

    public hide(): void {
        this.node.active = false;
    }

    public handleNextButton(): void {
        this.onNextTap?.();
    }

    public handleReplayButton(): void {
        this.onReplayTap?.();
    }
}
