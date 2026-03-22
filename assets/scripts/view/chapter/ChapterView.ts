import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ChapterView')
export class ChapterView extends Component {
    @property(Node)
    private readonly levelListRoot: Node | null = null;

    public onLevelSelected: ((levelId: number) => void) | null = null;

    protected onLoad(): void {
        if (!this.levelListRoot) {
            throw new Error('ChapterView: levelListRoot is not assigned');
        }
    }

    public handleLevelSelected(levelId: number): void {
        this.onLevelSelected?.(levelId);
    }
}
