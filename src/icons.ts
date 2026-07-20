import { App, SuggestModal, setIcon, getIconIds } from 'obsidian';

/**
 * Retrieves all registered icon IDs available in Obsidian's icon registry.
 */
export function getAllIcons(): string[] {
    const iconIds = getIconIds();
    return Array.from(new Set(iconIds)).sort((a, b) => a.localeCompare(b));
}

export class IconSuggestModal extends SuggestModal<string> {
    private allIcons: string[];
    onSelect: (icon: string) => void;

    constructor(app: App, onSelect: (icon: string) => void) {
        super(app);
        this.onSelect = onSelect;
        this.setPlaceholder('Search workspace icons...');
        this.allIcons = getAllIcons();
    }

    getSuggestions(query: string): string[] {
        const lowerQuery = query.toLowerCase().trim();
        if (!lowerQuery) {
            // Limit to top 100 initial suggestions to keep UI smooth
            return this.allIcons.slice(0, 100);
        }
        return this.allIcons
            .filter(icon => icon.toLowerCase().includes(lowerQuery))
            .slice(0, 100);
    }

    renderSuggestion(value: string, el: HTMLElement) {
        el.addClass('spaces-icon-suggestion');

        const iconContainer = el.createDiv();
        setIcon(iconContainer, value);

        // Display a clean icon name in the list (strip 'lucide-' prefix if present)
        const displayName = value.startsWith('lucide-') ? value.slice(7) : value;
        el.createSpan({ text: displayName });
    }

    onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
        this.onSelect(item);
    }
}
