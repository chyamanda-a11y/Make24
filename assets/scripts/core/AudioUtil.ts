import { AudioClip, AudioSource, Node, director, isValid } from 'cc';

import { BundleAssetLocation, BundleService } from './BundleService';

const AUDIO_ROOT_NODE_NAME = 'AudioUtilRoot';

const AUDIO_RESOURCE_LOCATIONS = {
    Match24: {
        bundleName: 'game',
        assetPath: 'audio/match_24',
    },
    NormalBtn: {
        bundleName: 'resources',
        assetPath: 'audio/normal_btn',
    },
    Success: {
        bundleName: 'game',
        assetPath: 'audio/success_3',
    },
} as const;

const STARTUP_AUDIO_KEYS = ['NormalBtn'] as const;
const GAMEPLAY_AUDIO_KEYS = ['Match24', 'Success'] as const;

type AudioKey = keyof typeof AUDIO_RESOURCE_LOCATIONS;

export class AudioUtil {
    private static readonly audioClipCache: Map<AudioKey, AudioClip> = new Map();
    private static readonly audioClipTasks: Map<AudioKey, Promise<AudioClip>> = new Map();

    private static audioRootNode: Node | null = null;
    private static audioSource: AudioSource | null = null;
    private static isMusicEnabled: boolean = true;
    private static isSoundEnabled: boolean = true;

    public static async Preload(audioKeys: readonly AudioKey[] = STARTUP_AUDIO_KEYS): Promise<void> {
        await Promise.all(
            audioKeys.map((audioKey) => this.loadAudioClip(audioKey)),
        );
    }

    public static async PreloadGameplay(): Promise<void> {
        await this.Preload(GAMEPLAY_AUDIO_KEYS);
    }

    public static SetMusicEnabled(enabled: boolean): void {
        this.isMusicEnabled = enabled;
        this.syncMusicEnabledState();
    }

    public static SetSoundEnabled(enabled: boolean): void {
        this.isSoundEnabled = enabled;
        this.syncSoundEnabledState();
    }

    public static PlayMatch24(): void {
        this.playAudio('Match24');
    }

    public static PlayNormalBtn(): void {
        this.playAudio('NormalBtn');
    }

    public static PlaySuccess(): void {
        this.playAudio('Success');
    }

    private static playAudio(audioKey: AudioKey): void {
        if (!this.isSoundEnabled) {
            return;
        }

        const cachedAudioClip = this.audioClipCache.get(audioKey) ?? null;

        if (cachedAudioClip) {
            this.getAudioSource().playOneShot(cachedAudioClip, 1);
            return;
        }

        void this.playAudioAsync(audioKey);
    }

    private static async playAudioAsync(audioKey: AudioKey): Promise<void> {
        try {
            const audioClip = await this.loadAudioClip(audioKey);

            this.getAudioSource().playOneShot(audioClip, 1);
        } catch (error) {
            console.error(`AudioUtil.playAudioAsync failed for ${audioKey}`, error);
        }
    }

    private static getAudioSource(): AudioSource {
        const cachedAudioSource = this.audioSource;

        if (cachedAudioSource && isValid(cachedAudioSource.node, true)) {
            return cachedAudioSource;
        }

        const audioRootNode = this.getAudioRootNode();
        const audioSource = audioRootNode.getComponent(AudioSource) ?? audioRootNode.addComponent(AudioSource);

        audioSource.playOnAwake = false;
        audioSource.loop = false;
        this.audioSource = audioSource;
        this.syncSoundEnabledState();
        return audioSource;
    }

    private static getAudioRootNode(): Node {
        const cachedAudioRootNode = this.audioRootNode;

        if (cachedAudioRootNode && isValid(cachedAudioRootNode, true)) {
            return cachedAudioRootNode;
        }

        const activeScene = director.getScene();

        if (!activeScene) {
            throw new Error('AudioUtil.getAudioRootNode: active scene is missing');
        }

        const existingAudioRootNode = activeScene.getChildByName(AUDIO_ROOT_NODE_NAME);

        if (existingAudioRootNode) {
            this.audioRootNode = existingAudioRootNode;
            return existingAudioRootNode;
        }

        const audioRootNode = new Node(AUDIO_ROOT_NODE_NAME);

        activeScene.addChild(audioRootNode);
        director.addPersistRootNode(audioRootNode);
        this.audioRootNode = audioRootNode;
        return audioRootNode;
    }

    private static async loadAudioClip(audioKey: AudioKey): Promise<AudioClip> {
        const cachedAudioClip = this.audioClipCache.get(audioKey);

        if (cachedAudioClip) {
            return cachedAudioClip;
        }

        const loadingTask = this.audioClipTasks.get(audioKey);

        if (loadingTask) {
            return loadingTask;
        }

        const task = BundleService.loadAsset(AUDIO_RESOURCE_LOCATIONS[audioKey] as BundleAssetLocation, AudioClip);

        this.audioClipTasks.set(audioKey, task);

        try {
            const audioClip = await task;

            this.audioClipCache.set(audioKey, audioClip);
            return audioClip;
        } finally {
            this.audioClipTasks.delete(audioKey);
        }
    }

    private static syncSoundEnabledState(): void {
        const audioSource = this.audioSource;

        if (!audioSource || !isValid(audioSource.node, true)) {
            return;
        }

        audioSource.volume = this.isSoundEnabled ? 1 : 0;

        if (!this.isSoundEnabled) {
            audioSource.stop();
        }
    }

    private static syncMusicEnabledState(): void {
        // TODO: Add background music playback control here after music assets are integrated.
        void this.isMusicEnabled;
    }
}
