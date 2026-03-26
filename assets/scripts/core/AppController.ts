import { _decorator, Component, director, Enum, instantiate, isValid, Node, Prefab, resources } from 'cc';

import { ChapterController } from '../controller/chapter/ChapterController';
import { SaveModel } from '../model/common/SaveModel';
import { LevelModel } from '../model/game/LevelModel';
import { ChapterLevelSelection, ChapterView } from '../view/chapter/ChapterView';
import { GameView } from '../view/game/GameView';
import { MainUIEnterAnimator } from '../view/game/MainUIEnterAnimator';
import { HomeView } from '../view/home/HomeView';
import { AudioUtil } from './AudioUtil';
import { ChapterLevelConfig, LevelService } from './LevelService';
import { PageName, PageRouter } from './PageRouter';
import { SaveService } from './SaveService';
import { WXService } from './WXService';

const { ccclass, property } = _decorator;

const PAGE_PREFAB_PATHS = {
    home: 'prefabs/HomePage',
    chapter: 'prefabs/ChapterPage',
    game: 'prefabs/MainUI',
} as const;

const PAGE_NODE_NAMES = {
    home: 'HomePage',
    chapter: 'ChapterPage',
    game: 'MainUI',
} as const;

enum StartupPage {
    Home = 0,
    Chapter = 1,
    Game = 2,
}

interface GameEntrySelection {
    readonly chapterFileName: string;
    readonly levelIndex: number;
}

@ccclass('AppController')
export class AppController extends Component {
    @property(Node)
    private homePage: Node | null = null;

    @property(Node)
    private chapterPage: Node | null = null;

    @property(Node)
    private gamePage: Node | null = null;

    @property({ type: Enum(StartupPage) })
    private startupPage: StartupPage = StartupPage.Home;

    private readonly pageRouter: PageRouter = new PageRouter();
    private readonly levelService: LevelService = new LevelService();
    private readonly saveService: SaveService = new SaveService();
    private readonly wxService: WXService = new WXService();
    private readonly chapterController: ChapterController = new ChapterController();

    private homeView: HomeView | null = null;
    private chapterView: ChapterView | null = null;
    private gameView: GameView | null = null;
    private readonly prefabTasks: Map<string, Promise<Prefab>> = new Map();
    private pagesInitializationTask: Promise<void> | null = null;

    protected onLoad(): void {
        void AudioUtil.Preload().catch((error: unknown) => {
            console.error('AppController.onLoad: AudioUtil.Preload failed', error);
        });
        this.homePage = this.resolveReusableHomePageNode(this.homePage);
        this.chapterPage = this.getUsableAssignedNode(this.chapterPage);
        this.gamePage = this.getUsableAssignedNode(this.gamePage);
        this.applyStartupPageVisibility(this.homePage, this.chapterPage, this.gamePage);
        this.registerStartupPageIfAvailable();
        this.bindHomeViewIfAvailable();
        this.pagesInitializationTask = this.initializePages();
        void this.pagesInitializationTask.catch((error: unknown) => {
            console.error('AppController.initializePages failed', error);
        });
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

    private async initializePages(): Promise<void> {
        const startupPageName = this.getStartupPageName();
        const startupPageNode = await this.resolvePageNode(startupPageName, this.getAssignedPageNode(startupPageName));

        this.setPageNode(startupPageName, startupPageNode);
        this.pageRouter.register(startupPageName, startupPageNode);

        const remainingPageNames = (Object.keys(PAGE_PREFAB_PATHS) as PageName[]).filter(
            (pageName) => pageName !== startupPageName,
        );

        const remainingPageNodes = await Promise.all(
            remainingPageNames.map((pageName) => this.resolvePageNode(pageName, this.getAssignedPageNode(pageName))),
        );

        remainingPageNames.forEach((pageName, index) => {
            this.setPageNode(pageName, remainingPageNodes[index]);
        });

        this.applyStartupPageVisibility(this.homePage, this.chapterPage, this.gamePage);
        this.bindViews();
        this.registerPages();
        await this.preparePagesForStartup(startupPageName);
        this.openPage(startupPageName);

        if (startupPageName === 'chapter') {
            this.chapterView?.scheduleRenderPreparedContent();
        }
    }

    private bindHomeViewIfAvailable(): void {
        if (!this.homePage) {
            return;
        }

        this.homeView = this.homePage.getComponent(HomeView) ?? this.homePage.addComponent(HomeView);
        this.homeView.onStartTap = this.handleHomeStartTap;
        this.homeView.onMenuTap = this.handleHomeMenuTap;
        this.homeView.onSettingsTap = this.handleHomeSettingsTap;
    }

    private bindViews(): void {
        if (!this.homePage || !this.chapterPage || !this.gamePage) {
            throw new Error('AppController.bindViews: page nodes are missing');
        }

        this.homeView = this.homePage.getComponent(HomeView) ?? this.homePage.addComponent(HomeView);
        this.chapterView = this.chapterPage.getComponent(ChapterView);
        this.gameView = this.gamePage.getComponent(GameView);

        if (!this.chapterView) {
            throw new Error('AppController.bindViews: chapterPage is missing ChapterView');
        }

        if (!this.gameView) {
            throw new Error('AppController.bindViews: gamePage is missing GameView');
        }

        this.gamePage.getComponent(MainUIEnterAnimator) ?? this.gamePage.addComponent(MainUIEnterAnimator);

        this.homeView.onStartTap = this.handleHomeStartTap;
        this.homeView.onMenuTap = this.handleHomeMenuTap;
        this.homeView.onSettingsTap = this.handleHomeSettingsTap;

        this.chapterView.onLevelSelected = this.handleLevelSelected;
        this.gameView.onLevelStarted = this.handleLevelStarted;
        this.gameView.onLevelCompleted = this.handleLevelCompleted;
        this.gameView.onExitRequested = this.handleExitRequested;
    }

    private registerPages(): void {
        if (!this.homePage || !this.chapterPage || !this.gamePage) {
            throw new Error('AppController.registerPages: page nodes are missing');
        }

        this.pageRouter.register('home', this.homePage);
        this.pageRouter.register('chapter', this.chapterPage);
        this.pageRouter.register('game', this.gamePage);
    }

    private async resolvePageNode(pageName: PageName, assignedNode: Node | null): Promise<Node> {
        if (pageName === 'home') {
            const reusableHomePageNode = this.resolveReusableHomePageNode(assignedNode);

            if (reusableHomePageNode) {
                return reusableHomePageNode;
            }
        }

        const usableAssignedNode = this.getUsableAssignedNode(assignedNode);

        if (usableAssignedNode) {
            usableAssignedNode.active = false;
        }

        const prefab = await this.loadPagePrefab(PAGE_PREFAB_PATHS[pageName]);
        const pageNode = instantiate(prefab);

        pageNode.name = PAGE_NODE_NAMES[pageName];
        pageNode.active = false;
        pageNode.setParent(this.node);
        pageNode.setPosition(0, 0, 0);
        return pageNode;
    }

    private applyStartupPageVisibility(...pages: Array<Node | null>): void {
        const startupPageName = this.getStartupPageName();

        pages.forEach((pageNode) => {
            if (!pageNode || !isValid(pageNode, true)) {
                return;
            }

            pageNode.active = pageNode.name === PAGE_NODE_NAMES[startupPageName];
        });
    }

    private getStartupPageName(): PageName {
        switch (this.startupPage) {
            case StartupPage.Home:
                return 'home';
            case StartupPage.Chapter:
                return 'chapter';
            case StartupPage.Game:
                return 'game';
            default:
                throw new Error(`AppController.getStartupPageName: unsupported startupPage ${this.startupPage}`);
        }
    }

    private registerStartupPageIfAvailable(): void {
        const startupPageName = this.getStartupPageName();

        if (startupPageName !== 'home') {
            return;
        }

        const startupPageNode = this.getAssignedPageNode(startupPageName);

        if (!startupPageNode) {
            return;
        }

        this.pageRouter.register(startupPageName, startupPageNode);
        this.pageRouter.show(startupPageName);
    }

    private getAssignedPageNode(pageName: PageName): Node | null {
        switch (pageName) {
            case 'home':
                return this.homePage;
            case 'chapter':
                return this.chapterPage;
            case 'game':
                return this.gamePage;
            default:
                throw new Error(`AppController.getAssignedPageNode: unsupported pageName ${String(pageName)}`);
        }
    }

    private setPageNode(pageName: PageName, pageNode: Node): void {
        switch (pageName) {
            case 'home':
                this.homePage = pageNode;
                return;
            case 'chapter':
                this.chapterPage = pageNode;
                return;
            case 'game':
                this.gamePage = pageNode;
                return;
            default:
                throw new Error(`AppController.setPageNode: unsupported pageName ${String(pageName)}`);
        }
    }

    private resolveReusableHomePageNode(assignedNode: Node | null): Node | null {
        const usableAssignedNode = this.getUsableAssignedNode(assignedNode);

        if (usableAssignedNode) {
            return usableAssignedNode;
        }

        const activeScene = director.getScene();

        if (!activeScene) {
            return null;
        }

        return this.findDescendantByName(activeScene, PAGE_NODE_NAMES.home);
    }

    private getUsableAssignedNode(assignedNode: Node | null): Node | null {
        if (!assignedNode || !isValid(assignedNode, true)) {
            return null;
        }

        return assignedNode;
    }

    private findDescendantByName(rootNode: Node, nodeName: string): Node | null {
        if (!isValid(rootNode, true)) {
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

    private async loadPagePrefab(resourcePath: string): Promise<Prefab> {
        const loadingTask = this.prefabTasks.get(resourcePath);

        if (loadingTask) {
            return loadingTask;
        }

        const task = new Promise<Prefab>((resolve, reject) => {
            resources.load(resourcePath, Prefab, (error, asset) => {
                if (error) {
                    reject(new Error(`AppController.loadPagePrefab failed for ${resourcePath}: ${error.message}`));
                    return;
                }

                if (!asset) {
                    reject(new Error(`AppController.loadPagePrefab failed for ${resourcePath}: prefab asset is missing`));
                    return;
                }

                resolve(asset);
            });
        });

        this.prefabTasks.set(resourcePath, task);

        try {
            return await task;
        } finally {
            this.prefabTasks.delete(resourcePath);
        }
    }

    private readonly handleLevelSelected = (selection: ChapterLevelSelection): void => {
        void this.openSelectedLevel(selection);
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

        void this.prepareChapterViewSafely('handleLevelCompleted', level.chapterId);
    };

    private readonly handleHomeStartTap = (): void => {
        void this.openCurrentGameFromHome();
    };

    private readonly handleHomeMenuTap = (): void => {
        void this.openChapterFromHome();
    };

    private async openCurrentGameFromHome(): Promise<void> {
        try {
            await this.pagesInitializationTask;

            const selection = await this.resolveHomeEntrySelection();

            await this.prepareGameView(selection.chapterFileName, selection.levelIndex, true);
            this.openPage('game');
        } catch (error) {
            console.error('AppController.openCurrentGameFromHome failed', error);
            await this.prepareChapterViewSafely('openCurrentGameFromHome');
            this.openPage('chapter');
            this.chapterView?.scheduleRenderPreparedContent();
        }
    }

    private async openChapterFromHome(): Promise<void> {
        try {
            await this.pagesInitializationTask;
            await this.prepareChapterView();
            this.openPage('chapter');
            this.chapterView?.scheduleRenderPreparedContent();
        } catch (error) {
            console.error('AppController.openChapterFromHome failed', error);
        }
    }

    private async resolveHomeEntrySelection(): Promise<GameEntrySelection> {
        const save = this.saveService.load();
        const chapterIds = this.buildHomeEntryChapterIds(save);

        for (const chapterId of chapterIds) {
            const config = await this.loadChapterConfigByChapterId(chapterId);
            const levelIndex = this.chapterController.resolveCurrentPlayableLevelIndex(config, save);

            if (levelIndex !== null) {
                return this.createGameEntrySelection(chapterId, levelIndex);
            }
        }

        const fallbackChapterId = chapterIds[0] ?? 1;
        const fallbackConfig = await this.loadChapterConfigByChapterId(fallbackChapterId);
        const fallbackLevelIndex = this.chapterController.resolveSavedLevelIndex(fallbackConfig, save) ?? 0;

        return this.createGameEntrySelection(fallbackChapterId, fallbackLevelIndex);
    }

    private readonly handleHomeSettingsTap = (): void => {
    };

    private readonly handleExitRequested = (): void => {
        void this.openPreparedChapter('handleExitRequested');
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

    private buildHomeEntryChapterIds(save: SaveModel): readonly number[] {
        const maxUnlockedChapterId = this.chapterController.normalizeChapterId(Math.max(save.unlockedChapterId, 1));
        const preferredChapterId = this.chapterController.normalizeChapterId(
            Math.min(Math.max(save.currentChapterId, 1), maxUnlockedChapterId),
        );
        const chapterIds: number[] = [];

        for (let offset = 0; offset < maxUnlockedChapterId; offset += 1) {
            const chapterId = ((preferredChapterId - 1 + offset) % maxUnlockedChapterId) + 1;

            chapterIds.push(this.chapterController.normalizeChapterId(chapterId));
        }

        return chapterIds;
    }

    private async loadChapterConfigByChapterId(chapterId: number): Promise<ChapterLevelConfig> {
        return this.levelService.loadChapterConfig(this.chapterController.getChapterFileName(chapterId));
    }

    private createGameEntrySelection(chapterId: number, levelIndex: number): GameEntrySelection {
        return {
            chapterFileName: this.chapterController.getChapterFileName(chapterId),
            levelIndex,
        };
    }

    private async preparePagesForStartup(startupPageName: PageName): Promise<void> {
        switch (startupPageName) {
            case 'home': {
                const selection = await this.resolveHomeEntrySelection();

                await Promise.all([
                    this.prepareChapterView(),
                    this.prepareGameView(selection.chapterFileName, selection.levelIndex),
                ]);
                return;
            }
            case 'chapter':
                await this.prepareChapterView();
                return;
            case 'game': {
                const selection = await this.resolveHomeEntrySelection();

                await this.prepareGameView(selection.chapterFileName, selection.levelIndex, true);
                return;
            }
            default:
                throw new Error(`AppController.preparePagesForStartup: unsupported startup page ${startupPageName}`);
        }
    }

    private async openSelectedLevel(selection: ChapterLevelSelection): Promise<void> {
        try {
            this.persistCurrentEntry(selection.chapterId, selection.levelId);
            await this.prepareGameView(selection.chapterFileName, selection.levelIndex);
            this.openPage('game');
        } catch (error) {
            console.error('AppController.openSelectedLevel failed', error);
        }
    }

    private async openPreparedChapter(source: string): Promise<void> {
        try {
            await this.prepareChapterView();
            this.openPage('chapter');
            this.chapterView?.scheduleRenderPreparedContent();
        } catch (error) {
            console.error(`AppController.${source}: chapterView.prepareForOpen failed`, error);
        }
    }

    private async prepareGameView(
        chapterFileName: string,
        levelIndex: number,
        notifyLevelStarted: boolean = false,
    ): Promise<void> {
        if (!this.gameView) {
            throw new Error('AppController.prepareGameView: gameView is missing');
        }

        await this.gameView.prepareLevel(chapterFileName, levelIndex, notifyLevelStarted);
    }

    private async prepareChapterView(chapterId?: number): Promise<void> {
        if (!this.chapterView) {
            throw new Error('AppController.prepareChapterView: chapterView is missing');
        }

        const normalizedChapterId = chapterId === undefined
            ? undefined
            : this.chapterController.normalizeChapterId(chapterId);

        await this.chapterView.prepareDataForOpen(normalizedChapterId);
    }

    private async prepareChapterViewSafely(source: string, chapterId?: number): Promise<void> {
        try {
            await this.prepareChapterView(chapterId);
        } catch (error) {
            console.error(`AppController.${source}: chapterView.prepareForOpen failed`, error);
        }
    }
}
