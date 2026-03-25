import { AudioUtil } from './AudioUtil';

export class AudioService {
    public playButton(): void {
        AudioUtil.PlayNormalBtn();
    }

    public playMerge(): void {
        AudioUtil.PlayMatch24();
    }

    public playWin(): void {
        AudioUtil.PlaySuccess();
    }
}
