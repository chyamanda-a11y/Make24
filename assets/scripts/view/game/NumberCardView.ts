import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('NumberCardView')
export class NumberCardView extends Component {
    @property(Label)
    private readonly valueLabel: Label | null = null;

    private cardIndex: number = -1;
    public onTap: ((index: number) => void) | null = null;

    protected onLoad(): void {
        if (!this.valueLabel) {
            throw new Error('NumberCardView: valueLabel is not assigned');
        }
    }

    public render(index: number, value: number): void {
        if (!this.valueLabel) {
            throw new Error('NumberCardView.render: valueLabel is not assigned');
        }

        this.cardIndex = index;
        this.valueLabel.string = `${value}`;
    }

    public handleTap(): void {
        this.onTap?.(this.cardIndex);
    }
}
