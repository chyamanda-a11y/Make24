import { _decorator, Button, Component, Node, Tween, Vec3, tween } from 'cc';

const { ccclass, property } = _decorator;

const DEFAULT_TOGGLE_DURATION = 0.12;

@ccclass('ToggleBtnView')
export class ToggleBtnView extends Component {
    @property({ type: Node })
    private offIcon: Node | null = null;

    @property({ type: Node })
    private onIcon: Node | null = null;

    @property
    private defaultIsOn: boolean = false;

    @property
    private toggleDuration: number = DEFAULT_TOGGLE_DURATION;

    public onValueChanged: ((isOn: boolean) => void) | null = null;

    private button: Button | null = null;
    private offVisiblePosition: Vec3 = new Vec3();
    private onVisiblePosition: Vec3 = new Vec3();
    private isOn: boolean = false;
    private hasResolvedReferences: boolean = false;
    private hasCapturedVisiblePositions: boolean = false;

    protected onLoad(): void {
        this.resolveReferencesIfNeeded();
        this.captureVisiblePositionsIfNeeded();
        this.setIsOn(this.defaultIsOn, false);
    }

    protected onEnable(): void {
        this.button?.node.on(Button.EventType.CLICK, this.handleToggleTap, this);
    }

    protected onDisable(): void {
        this.button?.node.off(Button.EventType.CLICK, this.handleToggleTap, this);
        this.stopAnimations();
    }

    public setIsOn(isOn: boolean, playAnimation: boolean = true): void {
        this.resolveReferencesIfNeeded();
        this.captureVisiblePositionsIfNeeded();
        this.isOn = isOn;

        if (playAnimation) {
            this.playStateTransition();
            return;
        }

        this.renderStateImmediately();
    }

    public getIsOn(): boolean {
        return this.isOn;
    }

    private resolveReferencesIfNeeded(): void {
        if (this.hasResolvedReferences) {
            return;
        }

        this.offIcon = this.offIcon ?? this.node.getChildByName('offIcon');
        this.onIcon = this.onIcon ?? this.node.getChildByName('onIcon');
        this.button = this.node.getComponent(Button);

        if (!this.offIcon) {
            throw new Error('ToggleBtnView: offIcon is not assigned');
        }

        if (!this.onIcon) {
            throw new Error('ToggleBtnView: onIcon is not assigned');
        }

        if (!this.button) {
            throw new Error('ToggleBtnView: Button component is missing');
        }

        this.hasResolvedReferences = true;
    }

    private captureVisiblePositionsIfNeeded(): void {
        if (this.hasCapturedVisiblePositions) {
            return;
        }

        if (!this.offIcon || !this.onIcon) {
            throw new Error('ToggleBtnView.captureVisiblePositions: icon nodes are missing');
        }

        this.offVisiblePosition = this.offIcon.getPosition().clone();
        this.onVisiblePosition = this.onIcon.getPosition().clone();
        this.hasCapturedVisiblePositions = true;
    }

    private handleToggleTap(): void {
        this.setIsOn(!this.isOn);
        this.onValueChanged?.(this.isOn);
    }

    private playStateTransition(): void {
        if (!this.offIcon || !this.onIcon) {
            throw new Error('ToggleBtnView.playStateTransition: icon nodes are missing');
        }

        this.stopAnimations();

        if (this.isOn) {
            this.offIcon.active = false;
            this.onIcon.active = true;
            this.onIcon.setPosition(this.offVisiblePosition);
            tween(this.onIcon)
                .to(this.toggleDuration, { position: this.onVisiblePosition })
                .start();
            return;
        }

        this.onIcon.active = false;
        this.offIcon.active = true;
        this.offIcon.setPosition(this.onVisiblePosition);
        tween(this.offIcon)
            .to(this.toggleDuration, { position: this.offVisiblePosition })
            .start();
    }

    private renderStateImmediately(): void {
        if (!this.offIcon || !this.onIcon) {
            throw new Error('ToggleBtnView.renderStateImmediately: icon nodes are missing');
        }

        this.stopAnimations();
        this.offIcon.active = !this.isOn;
        this.onIcon.active = this.isOn;
        this.offIcon.setPosition(this.offVisiblePosition);
        this.onIcon.setPosition(this.onVisiblePosition);
    }

    private stopAnimations(): void {
        if (this.offIcon) {
            Tween.stopAllByTarget(this.offIcon);
        }

        if (this.onIcon) {
            Tween.stopAllByTarget(this.onIcon);
        }
    }
}
