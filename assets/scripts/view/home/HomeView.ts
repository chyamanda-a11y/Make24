import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('HomeView')
export class HomeView extends Component {
    @property(Node)
    private readonly startButton: Node | null = null;

    @property(Node)
    private readonly continueButton: Node | null = null;

    @property(Node)
    private readonly chapterButton: Node | null = null;

    public onStartTap: (() => void) | null = null;
    public onContinueTap: (() => void) | null = null;
    public onChapterTap: (() => void) | null = null;

    protected onLoad(): void {
        if (!this.startButton || !this.continueButton || !this.chapterButton) {
            throw new Error('HomeView: button nodes are not assigned');
        }
    }

    public handleStartButton(): void {
        this.onStartTap?.();
    }

    public handleContinueButton(): void {
        this.onContinueTap?.();
    }

    public handleChapterButton(): void {
        this.onChapterTap?.();
    }
}
