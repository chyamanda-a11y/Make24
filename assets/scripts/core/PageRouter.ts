import { Node } from 'cc';

export type PageName = 'home' | 'chapter' | 'game';

export class PageRouter {
    private readonly pages: Map<PageName, Node> = new Map<PageName, Node>();

    public register(name: PageName, node: Node): void {
        this.pages.set(name, node);
    }

    public show(name: PageName): void {
        for (const [pageName, node] of this.pages.entries()) {
            node.active = pageName === name;
        }
    }
}
