import { App, SuggestModal, setIcon, getIconIds } from 'obsidian';

// Curated list of popular workspace & layout icons shown at the top by default
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
 * Retrieves all registered icon IDs available in Obsidian's icon registry.
 */
export function getAllIcons(): string[] {
    const iconIds = getIconIds();
    return Array.from(new Set(iconIds)).sort((a, b) => a.localeCompare(b));
}

export class IconSuggestModal extends SuggestModal<string> {
    private allIcons: string[];
    private defaultOrderedIcons: string[];
    onSelect: (icon: string) => void;

    constructor(app: App, onSelect: (icon: string) => void) {
        super(app);
        this.onSelect = onSelect;
        this.setPlaceholder('Search workspace icons...');

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

        // Popular icons first, followed by all other available icons
        this.defaultOrderedIcons = [...resolvedPopular, ...remainingIcons];
    }

    getSuggestions(query: string): string[] {
        const lowerQuery = query.toLowerCase().trim();

        // STATE 1: Empty input -> Immediately revert to popular icons list
        if (!lowerQuery) {
            return this.defaultOrderedIcons;
        }

        // STATE 2: Active Search -> Query full registry with smart relevance sorting
        return this.allIcons
            .filter(icon => icon.toLowerCase().includes(lowerQuery))
            .sort((a, b) => {
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();

                // Exact match first
                if (aLower === lowerQuery) return -1;
                if (bLower === lowerQuery) return 1;

                // "Starts with" matches second
                const aStarts = aLower.startsWith(lowerQuery);
                const bStarts = bLower.startsWith(lowerQuery);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                // Alphabetical fallback
                return aLower.localeCompare(bLower);
            });
    }

    renderSuggestion(iconName: string, el: HTMLElement) {
        el.empty();
        el.addClass('spaces-icon-suggestion');

        const iconContainer = el.createDiv({ cls: 'space-icon-preview' });
        setIcon(iconContainer, iconName);

        el.createSpan({ text: iconName });
    }

    onChooseSuggestion(iconName: string, evt: MouseEvent | KeyboardEvent) {
        this.onSelect(iconName);
    }
}
