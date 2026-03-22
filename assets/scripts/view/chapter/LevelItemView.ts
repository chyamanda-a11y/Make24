import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('LevelItemView')
export class LevelItemView extends Component {
    @property(Label)
    private readonly levelLabel: Label | null = null;

    public onTap: ((levelId: number) => void) | null = null;
    private levelId: number = 0;

    protected onLoad(): void {
        if (!this.levelLabel) {
            throw new Error('LevelItemView: levelLabel is not assigned');
        }
    }

    public render(levelId: number): void {
        if (!this.levelLabel) {
            throw new Error('LevelItemView.render: levelLabel is not assigned');
        }

        this.levelId = levelId;
        this.levelLabel.string = `${levelId}`;
    }

    public handleTap(): void {
        this.onTap?.(this.levelId);
    }
}
