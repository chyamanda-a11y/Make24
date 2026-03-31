import { _decorator, Button, Component } from 'cc';

import { AudioUtil } from '../../core/AudioUtil';

const { ccclass } = _decorator;

@ccclass('SettingPopupView')
export class SettingPopupView extends Component {
    private closeButton: Button | null = null;
    private hasResolvedReferences: boolean = false;

    protected onLoad(): void {
        this.resolveReferencesIfNeeded();
    }

    protected onEnable(): void {
        this.closeButton?.node.on(Button.EventType.CLICK, this.handleCloseTap, this);
    }

    protected onDisable(): void {
        this.closeButton?.node.off(Button.EventType.CLICK, this.handleCloseTap, this);
    }

    public show(): void {
        this.resolveReferencesIfNeeded();
        this.setVisible(true);
    }

    public hide(): void {
        this.setVisible(false);
    }

    private resolveReferencesIfNeeded(): void {
        if (this.hasResolvedReferences) {
            return;
        }

        this.closeButton = this.node.getChildByName('closeButton')?.getComponent(Button) ?? null;

        if (!this.closeButton) {
            throw new Error('SettingPopupView: closeButton is not assigned');
        }

        this.hasResolvedReferences = true;
    }

    private handleCloseTap(): void {
        AudioUtil.PlayNormalBtn();
        this.hide();
    }

    private setVisible(visible: boolean): void {
        if (this.node.active === visible) {
            return;
        }

        this.node.active = visible;
    }
}
