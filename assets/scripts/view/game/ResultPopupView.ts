import { _decorator, Button, Component, Label } from 'cc';

import { AudioUtil } from '../../core/AudioUtil';

const { ccclass } = _decorator;

@ccclass('ResultPopupView')
export class ResultPopupView extends Component {
    private titleLabel: Label | null = null;
    private nextButton: Button | null = null;
    private nextButtonLabel: Label | null = null;

    public onNextTap: (() => void) | null = null;

    protected onLoad(): void {
        this.titleLabel = this.node.getChildByName('title')?.getComponent(Label) ?? null;
        this.nextButton = this.node.getChildByName('Button')?.getComponent(Button) ?? null;
        this.nextButtonLabel = this.node.getChildByName('Button')?.getChildByName('Label')?.getComponent(Label) ?? null;

        if (!this.titleLabel) {
            throw new Error('ResultPopupView: titleLabel is not assigned');
        }

        if (!this.nextButton) {
            throw new Error('ResultPopupView: nextButton is not assigned');
        }

        if (!this.nextButtonLabel) {
            throw new Error('ResultPopupView: nextButtonLabel is not assigned');
        }
    }

    protected onEnable(): void {
        this.nextButton?.node.on(Button.EventType.CLICK, this.handleNextButton, this);
    }

    protected onDisable(): void {
        this.nextButton?.node.off(Button.EventType.CLICK, this.handleNextButton, this);
    }

    public show(title: string, nextButtonText: string = '下一关'): void {
        if (!this.titleLabel) {
            throw new Error('ResultPopupView.show: titleLabel is not assigned');
        }

        if (!this.nextButtonLabel) {
            throw new Error('ResultPopupView.show: nextButtonLabel is not assigned');
        }

        this.titleLabel.string = title;
        this.nextButtonLabel.string = nextButtonText;
        this.node.active = true;
    }

    public hide(): void {
        this.node.active = false;
    }

    public handleNextButton(): void {
        AudioUtil.PlayNormalBtn();
        this.onNextTap?.();
    }
}
