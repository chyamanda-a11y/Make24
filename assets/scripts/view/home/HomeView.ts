import {
    _decorator,
    Component,
    EventTouch,
    Layers,
    Node,
    UITransform,
} from 'cc';

import { AudioUtil } from '../../core/AudioUtil';

const { ccclass, property } = _decorator;

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;

@ccclass('HomeView')
export class HomeView extends Component {
    @property({ type: Node })
    private startButton: Node | null = null;

    @property({ type: Node })
    private topSettingButton: Node | null = null;

    public onStartTap: (() => void) | null = null;
    public onMenuTap: (() => void) | null = null;
    public onSettingsTap: (() => void) | null = null;

    private menuButton: Node | null = null;
    private bottomSettingButton: Node | null = null;

    private readonly pressedButtons: Set<Node> = new Set();
    private runtimeEventsBound: boolean = false;

    protected onLoad(): void {
        this.ensureRootTransform();
        this.resolveButtons();
    }

    protected onEnable(): void {
        this.bindRuntimeEvents();
    }

    protected onDisable(): void {
        this.unbindRuntimeEvents();
    }

    public handleStartButton(): void {
        if (!this.consumePressedButton(this.startButton)) {
            return;
        }

        AudioUtil.PlayNormalBtn();
        this.onStartTap?.();
    }

    public handleMenuButton(): void {
        if (!this.consumePressedButton(this.menuButton)) {
            return;
        }

        AudioUtil.PlayNormalBtn();
        this.onMenuTap?.();
    }

    public handleSettingsButton(): void {
        const pressedSettingButton = this.consumePressedButton(this.topSettingButton)
            || this.consumePressedButton(this.bottomSettingButton);

        if (!pressedSettingButton) {
            return;
        }

        AudioUtil.PlayNormalBtn();
        this.onSettingsTap?.();
    }

    private ensureRootTransform(): void {
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);

        transform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        this.node.setPosition(0, 0, 0);
        this.node.layer = Layers.Enum.UI_2D;
    }

    private resolveButtons(): void {
        this.menuButton = this.findNamedRuntimeNode('MenuButton');
        this.bottomSettingButton = this.findNamedRuntimeNode('BottomSettingButton');

        if (this.startButton) {
            return;
        }

        console.warn('HomeView.resolveButtons: StartButton is not assigned, home start action will stay unbound.');
    }

    private bindRuntimeEvents(): void {
        if (this.runtimeEventsBound) {
            return;
        }

        this.startButton?.on(Node.EventType.TOUCH_START, this.handleButtonTouchStart, this);
        this.startButton?.on(Node.EventType.TOUCH_END, this.handleStartButton, this);
        this.startButton?.on(Node.EventType.TOUCH_CANCEL, this.handleButtonTouchCancel, this);
        this.menuButton?.on(Node.EventType.TOUCH_START, this.handleButtonTouchStart, this);
        this.menuButton?.on(Node.EventType.TOUCH_END, this.handleMenuButton, this);
        this.menuButton?.on(Node.EventType.TOUCH_CANCEL, this.handleButtonTouchCancel, this);
        this.topSettingButton?.on(Node.EventType.TOUCH_START, this.handleButtonTouchStart, this);
        this.topSettingButton?.on(Node.EventType.TOUCH_END, this.handleSettingsButton, this);
        this.topSettingButton?.on(Node.EventType.TOUCH_CANCEL, this.handleButtonTouchCancel, this);
        this.bottomSettingButton?.on(Node.EventType.TOUCH_START, this.handleButtonTouchStart, this);
        this.bottomSettingButton?.on(Node.EventType.TOUCH_END, this.handleSettingsButton, this);
        this.bottomSettingButton?.on(Node.EventType.TOUCH_CANCEL, this.handleButtonTouchCancel, this);
        this.runtimeEventsBound = true;
    }

    private unbindRuntimeEvents(): void {
        if (!this.runtimeEventsBound) {
            return;
        }

        this.startButton?.off(Node.EventType.TOUCH_START, this.handleButtonTouchStart, this);
        this.startButton?.off(Node.EventType.TOUCH_END, this.handleStartButton, this);
        this.startButton?.off(Node.EventType.TOUCH_CANCEL, this.handleButtonTouchCancel, this);
        this.menuButton?.off(Node.EventType.TOUCH_START, this.handleButtonTouchStart, this);
        this.menuButton?.off(Node.EventType.TOUCH_END, this.handleMenuButton, this);
        this.menuButton?.off(Node.EventType.TOUCH_CANCEL, this.handleButtonTouchCancel, this);
        this.topSettingButton?.off(Node.EventType.TOUCH_START, this.handleButtonTouchStart, this);
        this.topSettingButton?.off(Node.EventType.TOUCH_END, this.handleSettingsButton, this);
        this.topSettingButton?.off(Node.EventType.TOUCH_CANCEL, this.handleButtonTouchCancel, this);
        this.bottomSettingButton?.off(Node.EventType.TOUCH_START, this.handleButtonTouchStart, this);
        this.bottomSettingButton?.off(Node.EventType.TOUCH_END, this.handleSettingsButton, this);
        this.bottomSettingButton?.off(Node.EventType.TOUCH_CANCEL, this.handleButtonTouchCancel, this);
        this.pressedButtons.clear();
        this.runtimeEventsBound = false;
    }

    private handleButtonTouchStart(event: EventTouch): void {
        const buttonNode = event.currentTarget as Node | null;

        if (!buttonNode) {
            return;
        }

        this.pressedButtons.add(buttonNode);
    }

    private handleButtonTouchCancel(event: EventTouch): void {
        const buttonNode = event.currentTarget as Node | null;

        if (!buttonNode) {
            return;
        }

        this.pressedButtons.delete(buttonNode);
    }

    private consumePressedButton(buttonNode: Node | null): boolean {
        if (!buttonNode || !this.pressedButtons.has(buttonNode)) {
            return false;
        }

        this.pressedButtons.delete(buttonNode);
        return true;
    }

    private findNamedRuntimeNode(nodeName: string): Node | null {
        return this.findDescendantByName(this.node, nodeName);
    }

    private findDescendantByName(rootNode: Node | null, nodeName: string): Node | null {
        if (!rootNode) {
            return null;
        }

        if (rootNode.name === nodeName) {
            return rootNode;
        }

        for (const childNode of rootNode.children) {
            const matchedNode = this.findDescendantByName(childNode, nodeName);

            if (matchedNode) {
                return matchedNode;
            }
        }

        return null;
    }
}
