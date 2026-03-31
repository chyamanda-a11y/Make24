import { _decorator, Button, Component, Node } from 'cc';

import { AudioUtil } from '../../core/AudioUtil';
import { SaveService } from '../../core/SaveService';
import { ToggleBtnView } from './ToggleBtnView';

const { ccclass, property } = _decorator;

@ccclass('SettingPopupView')
export class SettingPopupView extends Component {
    @property({ type: Node })
    private soundToggleButtonNode: Node | null = null;

    @property({ type: Node })
    private musicToggleButtonNode: Node | null = null;

    private closeButton: Button | null = null;
    private soundToggleButton: ToggleBtnView | null = null;
    private musicToggleButton: ToggleBtnView | null = null;
    private hasResolvedReferences: boolean = false;
    private readonly saveService: SaveService = new SaveService();

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
        this.syncToggleStatesFromSave();
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
        this.soundToggleButton = this.resolveToggleButton(this.soundToggleButtonNode, ['soundPanel', 'ToggleBtn']);
        this.musicToggleButton = this.resolveToggleButton(this.musicToggleButtonNode, ['musicPanel', 'ToggleBtn']);

        if (!this.closeButton) {
            throw new Error('SettingPopupView: closeButton is not assigned');
        }

        if (!this.soundToggleButton) {
            throw new Error('SettingPopupView: soundToggleButton is not assigned');
        }

        if (!this.musicToggleButton) {
            throw new Error('SettingPopupView: musicToggleButton is not assigned');
        }

        this.soundToggleButton.onValueChanged = this.handleSoundToggleChanged;
        this.musicToggleButton.onValueChanged = this.handleMusicToggleChanged;
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

    private syncToggleStatesFromSave(): void {
        const save = this.saveService.load();

        this.soundToggleButton?.setIsOn(save.isSoundEnabled, false);
        this.musicToggleButton?.setIsOn(save.isMusicEnabled, false);
    }

    private readonly handleSoundToggleChanged = (isOn: boolean): void => {
        const save = this.saveService.load();

        this.saveService.save({
            ...save,
            isSoundEnabled: isOn,
        });
        AudioUtil.SetSoundEnabled(isOn);
    };

    private readonly handleMusicToggleChanged = (isOn: boolean): void => {
        const save = this.saveService.load();

        this.saveService.save({
            ...save,
            isMusicEnabled: isOn,
        });
        AudioUtil.SetMusicEnabled(isOn);
    };

    private resolveToggleButton(assignedNode: Node | null, fallbackPath: string[]): ToggleBtnView | null {
        const toggleNode = assignedNode ?? this.findNode(fallbackPath);

        if (!toggleNode) {
            return null;
        }

        return toggleNode.getComponent(ToggleBtnView) ?? toggleNode.addComponent(ToggleBtnView);
    }

    private findNode(path: string[]): Node | null {
        let currentNode = this.node;

        for (const name of path) {
            currentNode = currentNode.getChildByName(name);

            if (!currentNode) {
                return null;
            }
        }

        return currentNode;
    }
}
