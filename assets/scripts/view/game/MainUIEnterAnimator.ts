import {
    _decorator,
    BlockInputEvents,
    Button,
    Component,
    find,
    isValid,
    Node,
    tween,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    Widget,
} from 'cc';

import { GameView } from './GameView';

const { ccclass, property } = _decorator;

type NodeTweenSnapshot = {
    readonly node: Node;
    readonly position: Vec3;
    readonly scale: Vec3;
    readonly opacity: number | null;
};

@ccclass('MainUIEnterAnimator')
export class MainUIEnterAnimator extends Component {
    @property
    private durationSeconds: number = 0.52;

    @property
    private staggerSeconds: number = 0.05;

    @property
    private enableInputBlocker: boolean = true;

    private readonly cachedSnapshots: Map<Node, NodeTweenSnapshot> = new Map();
    private inputBlockerNode: Node | null = null;
    private cachedButtonStates: Array<{ readonly button: Button; readonly interactable: boolean }> = [];
    private playVersion: number = 0;

    protected onEnable(): void {
        this.play();
    }

    protected onDisable(): void {
        this.stopAndRestore(true);
    }

    public play(): void {
        const version = ++this.playVersion;
        // Cancel previous state/tweens but keep this play()'s version.
        this.stopAndRestore(false);

        if (this.enableInputBlocker) {
            this.createInputBlocker();
        }

        this.setAllButtonsInteractable(false);

        const targets = this.resolveTargets();

        // Fast exit: if target set is empty, don't lock input.
        if (targets.length === 0) {
            this.setAllButtonsInteractable(true);
            this.removeInputBlocker();
            return;
        }

        const startConfig = this.applyStartPose(targets);
        this.startTweens(startConfig, () => {
            if (version !== this.playVersion) {
                return;
            }
            this.setAllButtonsInteractable(true);
            this.removeInputBlocker();
        });
    }

    private stopAndRestore(invalidateVersion: boolean): void {
        if (invalidateVersion) {
            this.playVersion++;
        }
        this.removeInputBlocker();
        this.restoreCachedSnapshots();
        this.setAllButtonsInteractable(true);
    }

    private resolveTargets(): Node[] {
        const targetNodes: Node[] = [];

        const gameView = this.node.getComponent(GameView);
        const numPanels = (gameView as unknown as { numPanels?: Node[] } | null)?.numPanels ?? [];
        const signPanels = (gameView as unknown as { signPanels?: Node[] } | null)?.signPanels ?? [];

        targetNodes.push(...this.filterValidNodes(numPanels));
        targetNodes.push(...this.filterValidNodes(signPanels));

        const bottomButtons = this.filterValidNodes([
            (gameView as unknown as { retryButton?: Node | null } | null)?.retryButton ?? null,
            (gameView as unknown as { tipButton?: Node | null } | null)?.tipButton ?? null,
            (gameView as unknown as { backOneButton?: Node | null } | null)?.backOneButton ?? null,
        ]);
        targetNodes.push(...bottomButtons);

        const targetBarNodes = this.filterValidNodes([
            this.tryFindByPaths(['container/Header/TARGETNode', 'Header/TARGETNode']),
            this.tryFindByPaths(['container/Header/24Node', 'Header/24Node']),
        ]);
        targetNodes.push(...targetBarNodes);

        const exitButton = (gameView as unknown as { exitButton?: Node | null } | null)?.exitButton ?? null;
        if (exitButton && isValid(exitButton, true)) {
            targetNodes.push(exitButton);
        }

        return Array.from(new Set(targetNodes));
    }

    private tryFindByPaths(paths: string[]): Node | null {
        for (const path of paths) {
            const matched = find(path, this.node);
            if (matched && isValid(matched, true)) {
                return matched;
            }
        }
        return null;
    }

    private filterValidNodes(nodes: Array<Node | null | undefined>): Node[] {
        return nodes.filter((node): node is Node => !!node && isValid(node, true));
    }

    private applyStartPose(nodes: Node[]): NodeTweenSnapshot[] {
        const snapshots: NodeTweenSnapshot[] = [];
        for (const node of nodes) {
            snapshots.push(this.snapshotNode(node));
        }

        const headerTargetNodes = new Set<Node>();
        const targetNode = this.tryFindByPaths(['container/Header/TARGETNode', 'Header/TARGETNode']);
        const target24Node = this.tryFindByPaths(['container/Header/24Node', 'Header/24Node']);
        if (targetNode) headerTargetNodes.add(targetNode);
        if (target24Node) headerTargetNodes.add(target24Node);

        for (const snapshot of snapshots) {
            Tween.stopAllByTarget(snapshot.node);
            const uiOpacity = snapshot.node.getComponent(UIOpacity) ?? snapshot.node.addComponent(UIOpacity);

            uiOpacity.opacity = 0;

            if (headerTargetNodes.has(snapshot.node)) {
                snapshot.node.setPosition(snapshot.position.x, snapshot.position.y + 24, snapshot.position.z);
                snapshot.node.setScale(snapshot.scale.x * 0.92, snapshot.scale.y * 0.92, snapshot.scale.z);
                continue;
            }

            const isBottomControl = this.isLikelyBottomControlNode(snapshot.node);
            if (isBottomControl) {
                snapshot.node.setPosition(snapshot.position.x, snapshot.position.y - 28, snapshot.position.z);
                snapshot.node.setScale(snapshot.scale.x * 0.96, snapshot.scale.y * 0.96, snapshot.scale.z);
                continue;
            }

            snapshot.node.setPosition(snapshot.position.x, snapshot.position.y - 14, snapshot.position.z);
            snapshot.node.setScale(snapshot.scale.x * 0.90, snapshot.scale.y * 0.90, snapshot.scale.z);
        }

        return snapshots;
    }

    private startTweens(snapshots: NodeTweenSnapshot[], onComplete: () => void): void {
        const duration = Math.min(Math.max(this.durationSeconds, 0.4), 0.6);
        const stagger = Math.max(this.staggerSeconds, 0);

        const sorted = snapshots.slice().sort((a, b) => {
            const ay = a.position.y;
            const by = b.position.y;
            return by - ay;
        });

        let remaining = sorted.length;
        const completeOne = (): void => {
            remaining -= 1;
            if (remaining <= 0) {
                onComplete();
            }
        };

        sorted.forEach((snapshot, index) => {
            const delay = index * stagger;
            const uiOpacity = snapshot.node.getComponent(UIOpacity) ?? snapshot.node.addComponent(UIOpacity);

            tween(snapshot.node)
                .delay(delay)
                .to(duration, { position: snapshot.position, scale: snapshot.scale }, { easing: 'backOut' })
                .call(() => {
                    completeOne();
                })
                .start();

            tween(uiOpacity)
                .delay(delay)
                .to(duration * 0.85, { opacity: 255 }, { easing: 'quadOut' })
                .start();
        });
    }

    private snapshotNode(node: Node): NodeTweenSnapshot {
        const cached = this.cachedSnapshots.get(node);
        if (cached) {
            return cached;
        }

        const uiOpacity = node.getComponent(UIOpacity);
        const snapshot: NodeTweenSnapshot = {
            node,
            position: node.position.clone(),
            scale: node.scale.clone(),
            opacity: uiOpacity ? uiOpacity.opacity : null,
        };

        this.cachedSnapshots.set(node, snapshot);
        return snapshot;
    }

    private restoreCachedSnapshots(): void {
        for (const snapshot of this.cachedSnapshots.values()) {
            if (!isValid(snapshot.node, true)) {
                continue;
            }
            Tween.stopAllByTarget(snapshot.node);
            snapshot.node.setPosition(snapshot.position);
            snapshot.node.setScale(snapshot.scale);
            if (snapshot.opacity !== null) {
                const uiOpacity = snapshot.node.getComponent(UIOpacity);
                if (uiOpacity) {
                    uiOpacity.opacity = snapshot.opacity;
                }
            }
        }
        this.cachedSnapshots.clear();
    }

    private isLikelyBottomControlNode(node: Node): boolean {
        const name = node.name.toLowerCase();
        if (name.includes('reset') || name.includes('hint') || name.includes('undo') || name.includes('retry') || name.includes('tip')) {
            return true;
        }

        const transform = node.getComponent(UITransform);
        if (!transform) {
            return false;
        }

        // Heuristic: bottom controls are wider / button-like.
        return transform.contentSize.width >= 120 && transform.contentSize.height <= 120;
    }

    private createInputBlocker(): void {
        if (this.inputBlockerNode && isValid(this.inputBlockerNode, true)) {
            this.inputBlockerNode.active = true;
            return;
        }

        const blocker = new Node('MainUIInputBlocker');
        blocker.layer = this.node.layer;
        blocker.setParent(this.node);
        blocker.setSiblingIndex(this.node.children.length - 1);

        const uiTransform = blocker.addComponent(UITransform);
        const parentTransform = this.node.getComponent(UITransform);
        if (parentTransform) {
            uiTransform.setContentSize(parentTransform.contentSize);
        } else {
            uiTransform.setContentSize(720, 1280);
        }

        const widget = blocker.addComponent(Widget);
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.left = 0;
        widget.right = 0;
        widget.top = 0;
        widget.bottom = 0;
        widget.alignMode = Widget.AlignMode.ALWAYS;

        blocker.addComponent(BlockInputEvents);
        this.inputBlockerNode = blocker;
    }

    private removeInputBlocker(): void {
        if (!this.inputBlockerNode) {
            return;
        }
        if (isValid(this.inputBlockerNode, true)) {
            this.inputBlockerNode.destroy();
        }
        this.inputBlockerNode = null;
    }

    private setAllButtonsInteractable(interactable: boolean): void {
        const buttons = this.node.getComponentsInChildren(Button);

        if (!interactable) {
            this.cachedButtonStates = buttons.map((button) => ({
                button,
                interactable: button.interactable,
            }));
            for (const button of buttons) {
                button.interactable = false;
            }
            return;
        }

        for (const cached of this.cachedButtonStates) {
            if (!isValid(cached.button, true)) {
                continue;
            }
            cached.button.interactable = cached.interactable;
        }
        this.cachedButtonStates = [];
    }
}

