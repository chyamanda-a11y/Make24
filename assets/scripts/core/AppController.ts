import { _decorator, Component, Node } from 'cc';

import { ChapterController } from '../controller/chapter/ChapterController';
import { LevelModel } from '../model/game/LevelModel';
import { ChapterLevelSelection, ChapterView } from '../view/chapter/ChapterView';
import { GameView } from '../view/game/GameView';
import { AudioService } from './AudioService';
import { LevelService } from './LevelService';
import { PageName, PageRouter } from './PageRouter';
import { SaveService } from './SaveService';
import { WXService } from './WXService';

const { ccclass, property } = _decorator;
@ccclass('AppController')
export class AppController extends Component {
    @property(Node)
    private homePage: Node | null = null;

    @property(Node)
    private chapterPage: Node | null = null;

    @property(Node)
    private gamePage: Node | null = null;

    private readonly pageRouter: PageRouter = new PageRouter();
    private readonly levelService: LevelService = new LevelService();
    private readonly saveService: SaveService = new SaveService();
    private readonly wxService: WXService = new WXService();
    private readonly audioService: AudioService = new AudioService();
    private readonly chapterController: ChapterController = new ChapterController();

    private chapterView: ChapterView | null = null;
    private gameView: GameView | null = null;

    protected onLoad(): void {
        this.resolvePages();
        this.bindViews();
        this.registerPages();
        this.openPage('chapter');
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

    private resolvePages(): void {
        this.gamePage = this.gamePage ?? this.node.getChildByName('MainUI');
        this.chapterPage = this.chapterPage ?? this.node.getChildByName('ChapterPage');
        this.homePage = this.homePage ?? this.node.getChildByName('HomePage');

        if (!this.chapterPage || !this.gamePage) {
            throw new Error('AppController.resolvePages: chapterPage or gamePage is missing');
        }
    }

    private bindViews(): void {
        if (!this.chapterPage || !this.gamePage) {
            throw new Error('AppController.bindViews: page nodes are missing');
        }

        this.chapterView = this.chapterPage.getComponent(ChapterView) ?? this.chapterPage.addComponent(ChapterView);
        this.gameView = this.gamePage.getComponent(GameView);

        if (!this.gameView) {
            throw new Error('AppController.bindViews: gamePage is missing GameView');
        }

        this.chapterView.onLevelSelected = this.handleLevelSelected;
        this.gameView.onLevelStarted = this.handleLevelStarted;
        this.gameView.onLevelCompleted = this.handleLevelCompleted;
        this.gameView.onExitRequested = this.handleExitRequested;
    }

    private registerPages(): void {
        if (this.homePage) {
            this.pageRouter.register('home', this.homePage);
        }

        if (!this.chapterPage || !this.gamePage) {
            throw new Error('AppController.registerPages: chapterPage or gamePage is missing');
        }

        this.pageRouter.register('chapter', this.chapterPage);
        this.pageRouter.register('game', this.gamePage);
    }

    private readonly handleLevelSelected = (selection: ChapterLevelSelection): void => {
        if (!this.gameView) {
            throw new Error('AppController.handleLevelSelected: gameView is missing');
        }

        this.persistCurrentEntry(selection.chapterId, selection.levelId);
        this.gameView.openLevel(selection.chapterFileName, selection.levelIndex);
        this.openPage('game');
    };

    private readonly handleLevelStarted = (level: LevelModel): void => {
        this.persistCurrentEntry(level.chapterId, level.id);
    };

    private readonly handleLevelCompleted = (level: LevelModel): void => {
        const save = this.saveService.load();
        const passedLevelIds = Array.from(new Set([...save.passedLevelIds, level.id]));
        const unlockedChapterId = this.resolveUnlockedChapterId(level.chapterId, save.unlockedChapterId);

        this.saveService.save({
            ...save,
            currentChapterId: level.chapterId,
            currentLevelId: level.id,
            unlockedChapterId,
            passedLevelIds,
        });

        this.chapterView?.refresh();
    };

    private readonly handleExitRequested = (): void => {
        this.chapterView?.refresh();
        this.openPage('chapter');
    };

    private persistCurrentEntry(chapterId: number, levelId: number): void {
        const save = this.saveService.load();

        this.saveService.save({
            ...save,
            currentChapterId: chapterId,
            currentLevelId: levelId,
        });
    }

    private resolveUnlockedChapterId(chapterId: number, currentUnlockedChapterId: number): number {
        const maxChapterId = this.chapterController.getMaxChapterId();
        const hasCompletedChapter = this.gameView?.isCurrentLevelLastInChapter() ?? false;

        if (!hasCompletedChapter) {
            return currentUnlockedChapterId;
        }

        return Math.min(Math.max(currentUnlockedChapterId, chapterId + 1), maxChapterId);
    }
}
