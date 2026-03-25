import {
    _decorator,
    Color,
    Component,
    EventTouch,
    Layers,
    Node,
    Sprite,
    SpriteFrame,
    UITransform,
    resources,
} from 'cc';

import { AudioUtil } from '../../core/AudioUtil';

const { ccclass } = _decorator;

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
const CONTAINER_NAME = 'container';

const COLORS = {
    background: new Color(18, 17, 4, 255),
    topBar: new Color(12, 11, 4, 210),
    primaryText: new Color(255, 239, 167, 255),
    startShadow: new Color(255, 217, 98, 92),
    settingsTint: new Color(58, 127, 72, 255),
    heroDecor: new Color(103, 95, 13, 52),
    bottomSettingIcon: new Color(237, 247, 229, 255),
};

interface SpriteConfig {
    readonly resourcePath: string;
    readonly color?: Color;
    readonly type?: Sprite.Type;
    readonly sizeMode?: Sprite.SizeMode;
}

interface SpriteBinding {
    readonly path: string[];
    readonly config: SpriteConfig;
}

const SPRITE_BINDINGS: ReadonlyArray<SpriteBinding> = [
    {
        path: ['Background'],
        config: {
            resourcePath: 'sprites/main/black_bg',
            color: COLORS.background,
            type: Sprite.Type.SLICED,
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
    {
        path: ['TopBar'],
        config: {
            resourcePath: 'sprites/main/black_bg',
            color: COLORS.topBar,
            type: Sprite.Type.SLICED,
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
    {
        path: ['TopBar', 'TopSettingButton', 'Icon'],
        config: {
            resourcePath: 'sprites/cover/setting_icon',
            color: COLORS.primaryText,
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
    {
        path: ['HeroDecor'],
        config: {
            resourcePath: 'sprites/cover/dector_icon',
            color: COLORS.heroDecor,
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
    {
        path: ['ActionGroup', 'StartGlow'],
        config: {
            resourcePath: 'sprites/main/tip_btn_bg',
            color: COLORS.startShadow,
            type: Sprite.Type.SLICED,
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
    {
        path: ['ActionGroup', 'BottomSettingButton'],
        config: {
            resourcePath: 'sprites/main/green_btn',
            color: COLORS.settingsTint,
            type: Sprite.Type.SLICED,
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
    {
        path: ['ActionGroup', 'BottomSettingButton', 'Icon'],
        config: {
            resourcePath: 'sprites/cover/setting_icon',
            color: COLORS.bottomSettingIcon,
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
    {
        path: ['PlusDecor'],
        config: {
            resourcePath: 'sprites/cover/plus_dector',
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
    {
        path: ['MultiplyDecor'],
        config: {
            resourcePath: 'sprites/cover/multy_icon',
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
    {
        path: ['ToyDecor'],
        config: {
            resourcePath: 'sprites/cover/toy_icon',
            sizeMode: Sprite.SizeMode.CUSTOM,
        },
    },
];

@ccclass('HomeView')
export class HomeView extends Component {
    public onStartTap: (() => void) | null = null;
    public onMenuTap: (() => void) | null = null;
    public onSettingsTap: (() => void) | null = null;

    private startButton: Node | null = null;
    private menuButton: Node | null = null;
    private topSettingButton: Node | null = null;
    private bottomSettingButton: Node | null = null;

    private readonly spriteFrameCache: Map<string, SpriteFrame> = new Map();
    private readonly spriteFrameTasks: Map<string, Promise<SpriteFrame>> = new Map();
    private readonly pressedButtons: Set<Node> = new Set();
    private runtimeEventsBound: boolean = false;

    protected onLoad(): void {
        this.ensureRootTransform();
        this.resolveButtons();
        void this.loadSpriteFramesSafely();
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
        this.menuButton = this.findRuntimeNode(['TopBar', 'MenuButton']);
        this.topSettingButton = this.findRuntimeNode(['TopBar', 'TopSettingButton']);
        this.startButton = this.findRuntimeNode(['ActionGroup', 'StartButton']);
        this.bottomSettingButton = this.findRuntimeNode(['ActionGroup', 'BottomSettingButton']);

        if (this.startButton) {
            return;
        }

        console.warn('HomeView.resolveButtons: StartButton is missing, home actions will stay unbound.');
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

    private async loadSpriteFramesSafely(): Promise<void> {
        try {
            await Promise.all(SPRITE_BINDINGS.map(({ path, config }) => this.assignSpriteFrameIfExists(path, config)));
        } catch (error) {
            console.warn('HomeView: failed to load one or more cover sprite frames', error);
        }
    }

    private async assignSpriteFrameIfExists(path: string[], config: SpriteConfig): Promise<void> {
        const node = this.findRuntimeNode(path);

        if (!node) {
            return;
        }

        const sprite = node.getComponent(Sprite);

        if (!sprite) {
            return;
        }

        sprite.spriteFrame = await this.loadSpriteFrame(config.resourcePath);
        sprite.sizeMode = config.sizeMode ?? Sprite.SizeMode.CUSTOM;
        sprite.type = config.type ?? Sprite.Type.SIMPLE;
        sprite.color = config.color ?? Color.WHITE;
    }

    private async loadSpriteFrame(resourcePath: string): Promise<SpriteFrame> {
        const cachedSpriteFrame = this.spriteFrameCache.get(resourcePath);

        if (cachedSpriteFrame) {
            return cachedSpriteFrame;
        }

        const loadingTask = this.spriteFrameTasks.get(resourcePath);

        if (loadingTask) {
            return loadingTask;
        }

        const task = new Promise<SpriteFrame>((resolve, reject) => {
            resources.load(`${resourcePath}/spriteFrame`, SpriteFrame, (error, asset) => {
                if (error || !asset) {
                    reject(error ?? new Error(`Missing sprite frame: ${resourcePath}`));
                    return;
                }

                this.spriteFrameCache.set(resourcePath, asset);
                resolve(asset);
            });
        });

        this.spriteFrameTasks.set(resourcePath, task);

        try {
            return await task;
        } finally {
            this.spriteFrameTasks.delete(resourcePath);
        }
    }

    private findRuntimeNode(path: string[]): Node | null {
        return this.findNode(path) ?? this.findNode([CONTAINER_NAME, ...path]);
    }

    private findNode(path: string[]): Node | null {
        let currentNode: Node | null = this.node;

        for (const name of path) {
            currentNode = currentNode?.getChildByName(name) ?? null;

            if (!currentNode) {
                return null;
            }
        }

        return currentNode;
    }
}
