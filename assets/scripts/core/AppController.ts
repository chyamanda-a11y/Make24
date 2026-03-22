import { _decorator, Component, Node } from 'cc';

import { AudioService } from './AudioService';
import { LevelService } from './LevelService';
import { PageName, PageRouter } from './PageRouter';
import { SaveService } from './SaveService';
import { WXService } from './WXService';

const { ccclass, property } = _decorator;

@ccclass('AppController')
export class AppController extends Component {
    @property(Node)
    private readonly homePage: Node | null = null;

    @property(Node)
    private readonly chapterPage: Node | null = null;

    @property(Node)
    private readonly gamePage: Node | null = null;

    private readonly pageRouter: PageRouter = new PageRouter();
    private readonly levelService: LevelService = new LevelService();
    private readonly saveService: SaveService = new SaveService();
    private readonly wxService: WXService = new WXService();
    private readonly audioService: AudioService = new AudioService();

    protected onLoad(): void {
        if (!this.homePage || !this.chapterPage || !this.gamePage) {
            throw new Error('AppController: page nodes are not assigned');
        }

        this.pageRouter.register('home', this.homePage);
        this.pageRouter.register('chapter', this.chapterPage);
        this.pageRouter.register('game', this.gamePage);
        this.openPage('home');
    }

    public openPage(pageName: PageName): void {
        this.pageRouter.show(pageName);
    }

    public getLevelService(): LevelService {
        return this.levelService;
    }

    public getSaveService(): SaveService {
        return this.saveService;
    }

    public getWXService(): WXService {
        return this.wxService;
    }

    public getAudioService(): AudioService {
        return this.audioService;
    }
}
