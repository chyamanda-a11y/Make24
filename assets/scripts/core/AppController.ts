import { _decorator, Component, director, Enum, instantiate, isValid, Node, Prefab } from 'cc';

import { ChapterController } from '../controller/chapter/ChapterController';
import { SaveModel } from '../model/common/SaveModel';
import { LevelModel } from '../model/game/LevelModel';
import { ChapterLevelSelection, ChapterView } from '../view/chapter/ChapterView';
import { GameView } from '../view/game/GameView';
import { MainUIEnterAnimator } from '../view/game/MainUIEnterAnimator';
import { HomeView } from '../view/home/HomeView';
import { SettingPopupView } from '../view/home/SettingPopupView';
import { WechatLoginService } from '../platform/wechat/WechatLoginService';
import { WechatPrivacyService } from '../platform/wechat/WechatPrivacyService';
import { WechatShareContent, WechatShareService } from '../platform/wechat/WechatShareService';
import { WechatUpdateService } from '../platform/wechat/WechatUpdateService';
import { AudioUtil } from './AudioUtil';
import { BundleAssetLocation, BundleService } from './BundleService';
import { ChapterLevelConfig, LevelService } from './LevelService';
import { PageName, PageRouter } from './PageRouter';
import { SaveService } from './SaveService';
import { WXService } from './WXService';

const { ccclass, property } = _decorator;

const PAGE_PREFAB_LOCATIONS: Record<PageName, BundleAssetLocation> = {
    home: {
        bundleName: 'resources',
        assetPath: 'prefabs/HomePage',
    },
    chapter: {
        bundleName: 'chapter',
        assetPath: 'prefabs/ChapterPage',
    },
    game: {
        bundleName: 'game',
        assetPath: 'prefabs/MainUI',
    },
};

const PAGE_NODE_NAMES = {
    home: 'HomePage',
    chapter: 'ChapterPage',
    game: 'MainUI',
} as const;

const SETTINGS_POPUP_PREFAB_LOCATION: BundleAssetLocation = {
    bundleName: 'resources',
    assetPath: 'prefabs/SettingPopUI',
};

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
    private settingPopupView: SettingPopupView | null = null;
    private readonly pageInitializationTasks: Map<PageName, Promise<Node>> = new Map();
    private pagesInitializationTask: Promise<void> | null = null;
    private settingPopupInitializationTask: Promise<SettingPopupView> | null = null;

    protected onLoad(): void {
        WechatPrivacyService.registerCustomPrivacyIfWechat();
        WechatUpdateService.registerUpdateManagerIfWechat();
        WechatShareService.setShareContentProvider(this.buildWechatShareContent);
        WechatShareService.registerShareMenuIfWechat();
        void WechatLoginService.requestLoginCode().then((code) => {
            if (!code) {
                return;
            }
            console.info(
                '[WechatLogin] code ready — exchange on server (jscode2session), then WechatLoginService.persistOpenIdFromServer(openid)',
            );
        });
        this.applySavedAudioSettings();
        void AudioUtil.Preload().catch((error: unknown) => {
            console.error('AppController.onLoad: AudioUtil.Preload failed', error);
        });
        this.homePage = this.resolveReusableHomePageNode(this.homePage);
        this.chapterPage = this.getUsableAssignedNode(this.chapterPage);
        this.gamePage = this.getUsableAssignedNode(this.gamePage);
        this.applyStartupPageVisibility(this.homePage, this.chapterPage, this.gamePage);
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

    private applySavedAudioSettings(): void {
        const save = this.saveService.load();

        AudioUtil.SetSoundEnabled(save.isSoundEnabled);
        AudioUtil.SetMusicEnabled(save.isMusicEnabled);
    }

    private async initializePages(): Promise<void> {
        const startupPageName = this.getStartupPageName();
        await this.ensurePageReady(startupPageName);
        await this.preparePagesForStartup(startupPageName);
        this.openPage(startupPageName);

        if (startupPageName === 'chapter') {
            this.chapterView?.scheduleRenderPreparedContent();
        }
    }

    private bindHomeViewIfAvailable(): void {
        const homePage = this.getUsableAssignedNode(this.homePage);

        if (!homePage) {
            return;
        }

        this.bindPageView('home', homePage);
    }

    private async ensurePageReady(pageName: PageName): Promise<Node> {
        const existingPageNode = this.getUsableAssignedNode(this.getAssignedPageNode(pageName));

        if (existingPageNode) {
            this.pageRouter.register(pageName, existingPageNode);
            this.bindPageView(pageName, existingPageNode);
            return existingPageNode;
        }

        const loadingTask = this.pageInitializationTasks.get(pageName);

        if (loadingTask) {
            return loadingTask;
        }

        const task = this.initializePageNode(pageName);

        this.pageInitializationTasks.set(pageName, task);

        try {
            return await task;
        } finally {
            this.pageInitializationTasks.delete(pageName);
        }
    }

    private async initializePageNode(pageName: PageName): Promise<Node> {
        const pageNode = await this.resolvePageNode(pageName, this.getAssignedPageNode(pageName));

        this.setPageNode(pageName, pageNode);
        this.pageRouter.register(pageName, pageNode);
        this.bindPageView(pageName, pageNode);
        return pageNode;
    }

    private bindPageView(pageName: PageName, pageNode: Node): void {
        switch (pageName) {
            case 'home':
                this.bindHomeView(pageNode);
                return;
            case 'chapter':
                this.bindChapterView(pageNode);
                return;
            case 'game':
                this.bindGameView(pageNode);
                return;
            default:
                throw new Error(`AppController.bindPageView: unsupported pageName ${String(pageName)}`);
        }
    }

    private bindHomeView(pageNode: Node): void {
        const homeView = pageNode.getComponent(HomeView) ?? pageNode.addComponent(HomeView);

        homeView.onStartTap = this.handleHomeStartTap;
        homeView.onMenuTap = this.handleHomeMenuTap;
        homeView.onSettingsTap = this.handleHomeSettingsTap;
        this.homeView = homeView;
    }

    private bindChapterView(pageNode: Node): void {
        const chapterView = pageNode.getComponent(ChapterView);

        if (!chapterView) {
            throw new Error('AppController.bindChapterView: chapterPage is missing ChapterView');
        }

        chapterView.onLevelSelected = this.handleLevelSelected;
        this.chapterView = chapterView;
    }

    private bindGameView(pageNode: Node): void {
        const gameView = pageNode.getComponent(GameView);

        if (!gameView) {
            throw new Error('AppController.bindGameView: gamePage is missing GameView');
        }

        pageNode.getComponent(MainUIEnterAnimator) ?? pageNode.addComponent(MainUIEnterAnimator);
        gameView.onLevelStarted = this.handleLevelStarted;
        gameView.onLevelCompleted = this.handleLevelCompleted;
        gameView.onExitRequested = this.handleExitRequested;
        this.gameView = gameView;
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

        const prefab = await this.loadPrefab(PAGE_PREFAB_LOCATIONS[pageName]);
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

    private async loadPrefab(prefabLocation: BundleAssetLocation): Promise<Prefab> {
        return BundleService.loadAsset(prefabLocation, Prefab);
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

    private async openSettingsPopup(): Promise<void> {
        try {
            const settingPopupView = await this.ensureSettingPopupView();

            settingPopupView.show();
        } catch (error) {
            console.error('AppController.openSettingsPopup failed', error);
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
        void this.openSettingsPopup();
    };

    private readonly buildWechatShareContent = (): WechatShareContent => {
        const save = this.saveService.load();
        const normalizedChapterId = this.chapterController.normalizeChapterId(save.currentChapterId);
        const chapterTitle = this.chapterController
            .getChapterTabs()
            .find((tab) => tab.chapterId === normalizedChapterId)
            ?.title ?? '初级';
        const displayLevelNumber = this.resolveShareLevelNumber(save.currentLevelId);

        return {
            title: `我在 24 点 ${chapterTitle} 第 ${displayLevelNumber} 关等你，来挑战一下？`,
            query: `chapter=${normalizedChapterId}&level=${displayLevelNumber}&source=wechat-share`,
        };
    };

    private readonly handleExitRequested = (): void => {
        void this.openPreparedChapter('handleExitRequested');
    };

    private resolveShareLevelNumber(levelId: number): number {
        if (levelId >= 100) {
            return Math.max(levelId % 100, 1);
        }

        return Math.max(levelId, 1);
    }

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

    private async ensureSettingPopupView(): Promise<SettingPopupView> {
        const existingSettingPopupView = this.settingPopupView;

        if (existingSettingPopupView && isValid(existingSettingPopupView.node, true)) {
            return existingSettingPopupView;
        }

        this.settingPopupView = null;

        if (!this.settingPopupInitializationTask) {
            this.settingPopupInitializationTask = this.initializeSettingPopupView();
        }

        try {
            const settingPopupView = await this.settingPopupInitializationTask;

            this.settingPopupView = settingPopupView;
            return settingPopupView;
        } finally {
            this.settingPopupInitializationTask = null;
        }
    }

    private async initializeSettingPopupView(): Promise<SettingPopupView> {
        if (!this.homePage || !isValid(this.homePage, true)) {
            throw new Error('AppController.initializeSettingPopupView: homePage is missing');
        }

        const popupPrefab = await this.loadPrefab(SETTINGS_POPUP_PREFAB_LOCATION);
        const popupNode = instantiate(popupPrefab);

        popupNode.name = 'SettingPopUI';
        popupNode.active = false;
        popupNode.setParent(this.homePage);
        popupNode.setPosition(0, 0, 0);

        return popupNode.getComponent(SettingPopupView) ?? popupNode.addComponent(SettingPopupView);
    }

    private async preparePagesForStartup(startupPageName: PageName): Promise<void> {
        switch (startupPageName) {
            case 'home':
                return;
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
        await this.ensurePageReady('game');

        if (!this.gameView) {
            throw new Error('AppController.prepareGameView: gameView is missing');
        }

        void AudioUtil.PreloadGameplay().catch((error: unknown) => {
            console.error('AppController.prepareGameView: AudioUtil.PreloadGameplay failed', error);
        });
        await this.gameView.prepareLevel(chapterFileName, levelIndex, notifyLevelStarted);
    }

    private async prepareChapterView(chapterId?: number): Promise<void> {
        await this.ensurePageReady('chapter');

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
