import { App, SuggestModal, setIcon, getIconIds } from 'obsidian';

// Curated list of popular workspace & layout icons shown at the top
const POPULAR_WORKSPACE_ICONS: string[] = [
    'folder', 'layout', 'grid', 'layers', 'box', 'bookmark', 'star', 'home',
    'file-text', 'database', 'briefcase', 'compass', 'cpu', 'archive', 'tag',
    'zap', 'calendar', 'user', 'settings', 'shield', 'award', 'flag', 'map-pin',
    'book', 'code', 'command', 'columns', 'filter', 'git-branch', 'heart',
    'inbox', 'key', 'link', 'list', 'lock', 'target', 'terminal', 'check-square',
    'activity', 'pie-chart', 'sliders', 'globe', 'hash', 'message-square',
    'image', 'paperclip', 'coffee', 'pen-tool', 'smile', 'sun', 'moon',
    'vault', 'sparkles', 'wrench', 'disc', 'terminal-square', 'folder-kanban'
];

/**
 * Global persistent template cache. 
 * Icons parsed once remain in memory across modal re-opens for 0ms load times.
 */
const ICON_TEMPLATE_CACHE: Map<string, HTMLDivElement> = new Map();

/**
 * Retrieves all registered icon IDs available in Obsidian's icon registry.
 */
export function getAllIcons(): string[] {
    const iconIds = getIconIds();
    return Array.from(new Set(iconIds)).sort((a, b) => a.localeCompare(b));
}

export class IconSuggestModal extends SuggestModal<string[]> {
    private allIcons: string[];
    private defaultOrderedIcons: string[];
    private iconsPerRow: number = 12;
    onSelect: (icon: string) => void;

    constructor(app: App, onSelect: (icon: string) => void) {
        super(app);
        this.onSelect = onSelect;
        this.setPlaceholder('Search workspace icons...');

        this.modalEl.addClass('spaces-icon-modal');

        this.allIcons = getAllIcons();

        const allIconsSet = new Set(this.allIcons);
        const resolvedPopular: string[] = [];

        POPULAR_WORKSPACE_ICONS.forEach(name => {
            if (allIconsSet.has(name)) {
                resolvedPopular.push(name);
            } else if (allIconsSet.has(`lucide-${name}`)) {
                resolvedPopular.push(`lucide-${name}`);
            }
        });

        const popularSet = new Set(resolvedPopular);
        const remainingIcons = this.allIcons.filter(icon => !popularSet.has(icon));

        this.defaultOrderedIcons = [...resolvedPopular, ...remainingIcons];
    }

    /**
     * Lazy-parses SVG once, then uses native cloneNode(true) for ultra-fast rendering.
     */
    private getIconNode(iconName: string): HTMLDivElement {
        let template = ICON_TEMPLATE_CACHE.get(iconName);
        if (!template) {
            template = document.createElement('div');
            template.className = 'spaces-icon-grid-item';
            template.setAttribute('aria-label', iconName);
            template.setAttribute('data-icon', iconName);
            setIcon(template, iconName);
            ICON_TEMPLATE_CACHE.set(iconName, template);
        }
        return template.cloneNode(true) as HTMLDivElement;
    }

    getSuggestions(query: string): string[][] {
        const lowerQuery = query.toLowerCase().trim();
        let matchedIcons = this.defaultOrderedIcons;

        if (lowerQuery) {
            matchedIcons = this.allIcons.filter(icon =>
                icon.toLowerCase().includes(lowerQuery)
            );
        }

        const rows: string[][] = [];
        for (let i = 0; i < matchedIcons.length; i += this.iconsPerRow) {
            rows.push(matchedIcons.slice(i, i + this.iconsPerRow));
        }

        return rows;
    }

    renderSuggestion(value: string[], el: HTMLElement) {
        el.addClass('spaces-icon-row');
        el.empty();

        // 1. Fast DOM insertion using cloned templates
        value.forEach(iconName => {
            el.appendChild(this.getIconNode(iconName));
        });

        // 2. Event Delegation: 1 listener per row instead of 12 listeners per item
        el.onclick = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.spaces-icon-grid-item');
            if (target) {
                const iconName = target.getAttribute('data-icon');
                if (iconName) {
                    e.stopPropagation();
                    this.onSelect(iconName);
                    this.close();
                }
            }
        };
    }

    onChooseSuggestion(item: string[], evt: MouseEvent | KeyboardEvent) {
        const firstIcon = item[0];
        if (firstIcon) {
            this.onSelect(firstIcon);
        }
    }
}
