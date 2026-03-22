export class ChapterController {
    public getChapterFileName(chapterId: number): string {
        return `chapter_${chapterId.toString().padStart(2, '0')}`;
    }
}
