import { AudioClip, AudioSource, Node, director, isValid, resources } from 'cc';

const AUDIO_ROOT_NODE_NAME = 'AudioUtilRoot';

const AUDIO_RESOURCE_PATHS = {
    Match24: 'audio/match_24',
    NormalBtn: 'audio/normal_btn',
    Success: 'audio/success',
} as const;

type AudioKey = keyof typeof AUDIO_RESOURCE_PATHS;

export class AudioUtil {
    private static readonly audioClipCache: Map<AudioKey, AudioClip> = new Map();
    private static readonly audioClipTasks: Map<AudioKey, Promise<AudioClip>> = new Map();

    private static audioRootNode: Node | null = null;
    private static audioSource: AudioSource | null = null;

    public static async Preload(): Promise<void> {
        await Promise.all(
            (Object.keys(AUDIO_RESOURCE_PATHS) as AudioKey[]).map((audioKey) => this.loadAudioClip(audioKey)),
        );
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

        const task = new Promise<AudioClip>((resolve, reject) => {
            resources.load(AUDIO_RESOURCE_PATHS[audioKey], AudioClip, (error, asset) => {
                if (error) {
                    reject(new Error(`AudioUtil.loadAudioClip failed for ${audioKey}: ${error.message}`));
                    return;
                }

                if (!asset) {
                    reject(new Error(`AudioUtil.loadAudioClip failed for ${audioKey}: audio clip is missing`));
                    return;
                }

                resolve(asset);
            });
        });

        this.audioClipTasks.set(audioKey, task);

        try {
            const audioClip = await task;

            this.audioClipCache.set(audioKey, audioClip);
            return audioClip;
        } finally {
            this.audioClipTasks.delete(audioKey);
        }
    }
}
