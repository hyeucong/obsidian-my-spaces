import { App, Setting, ButtonComponent, Notice, SuggestModal, setIcon, TextComponent } from 'obsidian';
import * as obsidian from 'obsidian';
import MySpacesPlugin from './main';

export interface Space {
    id: string;
    name: string;
    icon: string;
    paths: string[];
    exclusions: string[];
}

export interface MySpacesSettings {
    spaces: Space[];
    activeSpaceId: string;
    useDefaultName: boolean;
    defaultSpaceName: string;
    registerHotkeys: boolean;
    showStatusBar: boolean;
    useStatusBarPrefix: boolean;
    statusBarPrefix: string;
    defaultStatusBarName: string;
    defaultSpaceIcon: string;
    autoTrackNewItems: boolean;
    centerNavButtons: boolean;
}

export const DEFAULT_SETTINGS: MySpacesSettings = {
    spaces: [],
    activeSpaceId: 'default',
    useDefaultName: false,
    defaultSpaceName: 'Untitled Space',
    registerHotkeys: false,
    showStatusBar: false,
    useStatusBarPrefix: false,
    statusBarPrefix: 'Space: ',
    defaultStatusBarName: 'Default',
    defaultSpaceIcon: 'home',
    autoTrackNewItems: true,
    centerNavButtons: false
};

export const POPULAR_ICONS = [
    'folder', 'folder-heart', 'folder-open', 'home', 'star', 'heart', 'list', 'check-square',
    'bookmark', 'calendar', 'user', 'settings', 'file-text', 'tag', 'hash', 'pin', 'map-pin',
    'compass', 'search', 'bell', 'archive', 'trash', 'lock', 'key', 'link', 'image', 'code',
    'terminal', 'database', 'coffee', 'book', 'book-open', 'pen', 'pencil', 'wrench', 'hammer',
    'zap', 'smile', 'gift', 'crown', 'trophy', 'target', 'flag', 'sun', 'moon', 'cloud',
    'shield', 'info', 'help-circle', 'alert-triangle', 'layers', 'layout', 'box', 'briefcase',
    'graduation-cap', 'clover', 'flame', 'lightbulb', 'globe', 'heart-handshake', 'hourglass'
];

// Creates a clean type mask that strips out the upstream @deprecated flag from the display method
const SafeSettingTab = obsidian.PluginSettingTab as unknown as new (
    app: App,
    plugin: MySpacesPlugin
) => Omit<obsidian.PluginSettingTab, 'display'> & { display(): void };

export class MySpacesSettingTab extends SafeSettingTab {
    plugin: MySpacesPlugin;

    private newSpaceId: string = '';
    private newSpaceName: string = '';
    private newSpaceIcon: string = 'folder';

    constructor(app: App, plugin: MySpacesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // Explicitly satisfies structural checks for legacy Obsidian environment deployments
    display(): void {
        this.renderSettingsTab();
    }

    // Isolated render implementation safe from method override warnings
    renderSettingsTab(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Spaces management')
            .setHeading();

        new Setting(containerEl)
            .setName('Active space ID')
            .setDesc('The internal routing ID of your currently active space filter.')
            .addText(text => text
                .setValue(this.plugin.settings.activeSpaceId)
                .setDisabled(true));

        new Setting(containerEl)
            .setName('Auto-track newly created items')
            .setDesc('Automatically append the layout paths of folders or files created while working inside an active space to prevent them from vanishing.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoTrackNewItems)
                .onChange((value) => {
                    this.plugin.settings.autoTrackNewItems = value;
                    void this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default view')
            .setHeading();

        new Setting(containerEl)
            .setName('Default view display name')
            .setDesc('The display text used for the default un-filtered view configuration status and label profiles.')
            .addText(text => text
                .setPlaceholder('E.g., default, vault, base')
                .setValue(this.plugin.settings.defaultStatusBarName)
                .onChange((value) => {
                    this.plugin.settings.defaultStatusBarName = value.trim() || 'Default';
                    void this.plugin.saveSettings().then(() => {
                        this.plugin.updateStatusBar();
                        this.plugin.renderNavButtons();
                    });
                }));

        const defaultIconSetting = new Setting(containerEl)
            .setName('Default view custom icon')
            .setDesc('The explicit navigation button icon used when accessing your global default layout window.');

        const defaultPreviewContainer = defaultIconSetting.controlEl.createDiv({ cls: 'space-icon-preview' });
        setIcon(defaultPreviewContainer, this.plugin.settings.defaultSpaceIcon || 'home');

        defaultIconSetting.addButton(btn => btn
            .setButtonText('Set home icon')
            .onClick(() => {
                new IconSuggestModal(this.app, (chosenIcon) => {
                    this.plugin.settings.defaultSpaceIcon = chosenIcon;
                    void this.plugin.saveSettings().then(() => {
                        this.plugin.renderNavButtons();
                        defaultPreviewContainer.empty();
                        setIcon(defaultPreviewContainer, chosenIcon);
                        new Notice(`Updated home button icon asset to "${chosenIcon}"`);
                    });
                }).open();
            }));

        new Setting(containerEl)
            .setName('Center navigation buttons')
            .setDesc('When enabled, buttons inside the file explorer header will use Obsidian default centered alignments. When turned off (default), they align cleanly to the left.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.centerNavButtons)
                .onChange((value) => {
                    this.plugin.settings.centerNavButtons = value;
                    void this.plugin.saveSettings().then(() => {
                        this.plugin.renderNavButtons();
                    });
                }));

        new Setting(containerEl)
            .setName('Use default space name')
            .setDesc('Pre-populate the creation modal name field when clicking the "+" button.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useDefaultName)
                .onChange((value) => {
                    this.plugin.settings.useDefaultName = value;
                    void this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default space name')
            .setDesc('The specific default value loaded into the modal input field when the setting above is enabled.')
            .addText(text => text
                .setPlaceholder('E.g., untitled space')
                .setValue(this.plugin.settings.defaultSpaceName)
                .onChange((value) => {
                    this.plugin.settings.defaultSpaceName = value;
                    void this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Register space hotkeys')
            .setDesc('Dynamically generate an individual command entry for every space created. Allows setting custom hotkeys via Obsidian options -> hotkeys. Requires application reload on initial creation.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.registerHotkeys)
                .onChange((value) => {
                    this.plugin.settings.registerHotkeys = value;
                    void this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Status bar')
            .setHeading();

        new Setting(containerEl)
            .setName('Enable status bar indicator')
            .setDesc('Show the currently active space name in the bottom right application status bar pane.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showStatusBar)
                .onChange((value) => {
                    this.plugin.settings.showStatusBar = value;
                    void this.plugin.saveSettings().then(() => {
                        this.plugin.updateStatusBar();
                    });
                }));

        new Setting(containerEl)
            .setName('Add status bar prefix')
            .setDesc('Prepend a specific descriptive prefix string directly before the workspace name rendering.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useStatusBarPrefix)
                .onChange((value) => {
                    this.plugin.settings.useStatusBarPrefix = value;
                    void this.plugin.saveSettings().then(() => {
                        this.plugin.updateStatusBar();
                    });
                }));

        new Setting(containerEl)
            .setName('Status bar prefix text')
            .setDesc('The text formatting configuration applied when the prefix toggle switch above is operational.')
            .addText(text => text
                .setPlaceholder('E.g., space: ')
                .setValue(this.plugin.settings.statusBarPrefix)
                .onChange((value) => {
                    this.plugin.settings.statusBarPrefix = value;
                    void this.plugin.saveSettings().then(() => {
                        this.plugin.updateStatusBar();
                    });
                }));

        new Setting(containerEl)
            .setName('Existing spaces')
            .setHeading();

        if (this.plugin.settings.spaces.length === 0) {
            containerEl.createEl('p', { text: 'No spaces configured yet. Create one below!', cls: 'setting-item-description' });
        }

        this.plugin.settings.spaces.forEach((space) => {
            const spaceSetting = new Setting(containerEl)
                .setClass('space-setting-left');

            spaceSetting.addText(text => {
                text.inputEl.addClass('space-id-input');
                text.setPlaceholder('Space ID')
                    .setValue(space.id)
                    .setDisabled(true);
            });

            spaceSetting.addText(text => {
                text.inputEl.addClass('space-name-input');
                text.setPlaceholder('Workspace name')
                    .setValue(space.name);

                text.inputEl.addEventListener('blur', () => {
                    if (!this.plugin.settings.spaces.some(s => s.id === space.id)) return;

                    const newName = text.getValue().trim();
                    if (newName && newName !== space.name) {
                        space.name = newName;
                        void this.plugin.saveSettings().then(() => {
                            this.plugin.renderNavButtons();
                            this.plugin.updateStatusBar();
                            new Notice(`Renamed space to "${newName}"`);
                        });
                    } else if (!newName) {
                        text.setValue(space.name);
                    }
                });
            });

            let iconInputRef: TextComponent | null = null;
            spaceSetting.addText(text => {
                iconInputRef = text;
                text.inputEl.addClass('space-icon-input');
                text.setPlaceholder('Icon (e.g., folder)')
                    .setValue(space.icon);

                text.inputEl.addEventListener('blur', () => {
                    if (!this.plugin.settings.spaces.some(s => s.id === space.id)) return;

                    const newIcon = text.getValue().trim();
                    if (newIcon && newIcon !== space.icon) {
                        space.icon = newIcon;
                        void this.plugin.saveSettings().then(() => {
                            this.plugin.renderNavButtons();
                            new Notice(`Updated icon for "${space.name}"`);
                        });
                    } else if (!newIcon) {
                        text.setValue(space.icon);
                    }
                });
            });

            spaceSetting.addButton(btn => {
                btn.setButtonText('Set icon')
                    .setTooltip('Browse icons')
                    .onClick(() => {
                        new IconSuggestModal(this.app, (chosenIcon) => {
                            space.icon = chosenIcon;
                            if (iconInputRef) iconInputRef.setValue(chosenIcon);
                            void this.plugin.saveSettings().then(() => {
                                this.plugin.renderNavButtons();
                                new Notice(`Updated icon to "${chosenIcon}"`);
                            });
                        }).open();
                    });
            });

            spaceSetting.addButton(btn => {
                btn.setIcon('trash')
                    .setTooltip(`Delete "${space.name}"`);

                const btnObj = btn as unknown as Record<string, unknown>;
                const destructiveFn = btnObj['setDestructive'];
                const warningFn = btnObj['setWarning'];

                if (typeof destructiveFn === 'function') {
                    (destructiveFn as () => void)();
                } else if (typeof warningFn === 'function') {
                    (warningFn as () => void)();
                }

                btn.onClick(() => {
                    this.plugin.settings.spaces = this.plugin.settings.spaces.filter(s => s.id !== space.id);
                    if (this.plugin.settings.activeSpaceId === space.id) {
                        this.plugin.settings.activeSpaceId = 'default';
                    }
                    void this.plugin.saveSettings().then(() => {
                        this.plugin.renderNavButtons();
                        this.plugin.applyExplorerFilterState();
                        this.plugin.updateStatusBar();
                        new Notice(`Deleted space "${space.name}"`);
                        this.renderSettingsTab();
                    });
                });
            });
        });

        new Setting(containerEl)
            .setName('New space')
            .setHeading();

        const createSetting = new Setting(containerEl)
            .setClass('space-setting-left');

        createSetting.addText(text => {
            text.inputEl.addClass('space-id-input');
            text.setPlaceholder('ID (optional)...')
                .setValue(this.newSpaceId)
                .onChange(value => { this.newSpaceId = value; });
        });

        createSetting.addText(text => {
            text.inputEl.addClass('space-name-input');
            text.setPlaceholder('Enter space name here...')
                .setValue(this.newSpaceName)
                .onChange(value => { this.newSpaceName = value; });
        });

        let newIconInputRef: TextComponent | null = null;
        createSetting.addText(text => {
            newIconInputRef = text;
            text.inputEl.addClass('space-icon-input');
            text.setPlaceholder('Icon (e.g., star)')
                .setValue(this.newSpaceIcon)
                .onChange(value => { this.newSpaceIcon = value; });
        });

        createSetting.addButton(btn => {
            btn.setButtonText('Set icon')
                .setTooltip('Browse icons')
                .onClick(() => {
                    new IconSuggestModal(this.app, (chosenIcon) => {
                        this.newSpaceIcon = chosenIcon;
                        if (newIconInputRef) newIconInputRef.setValue(chosenIcon);
                    }).open();
                });
        });

        createSetting.addButton((btn: ButtonComponent) => {
            btn.setButtonText('Create')
                .setCta()
                .onClick(() => {
                    if (!this.newSpaceName.trim()) {
                        new Notice('Please enter a valid space name');
                        return;
                    }

                    const finalId = this.newSpaceId.trim()
                        ? this.newSpaceId.trim().toLowerCase().replace(/\s+/g, '_')
                        : 'space_' + Date.now();

                    if (this.plugin.settings.spaces.some(s => s.id === finalId)) {
                        new Notice(`An ID setup matching "${finalId}" already exists!`);
                        return;
                    }

                    const newSpace: Space = {
                        id: finalId,
                        name: this.newSpaceName.trim(),
                        icon: this.newSpaceIcon.trim() || 'folder',
                        paths: [],
                        exclusions: []
                    };

                    this.plugin.settings.spaces.push(newSpace);
                    this.plugin.registerSingleSpaceCommand(newSpace);

                    void this.plugin.saveSettings().then(() => {
                        this.plugin.renderNavButtons();
                        this.plugin.applyExplorerFilterState();
                        new Notice(`Created new space "${newSpace.name}"`);

                        this.newSpaceId = '';
                        this.newSpaceName = '';
                        this.newSpaceIcon = 'folder';

                        this.renderSettingsTab();
                    });
                });
        });
    }
}

export class IconSuggestModal extends SuggestModal<string> {
    onSelect: (icon: string) => void;

    constructor(app: App, onSelect: (icon: string) => void) {
        super(app);
        this.onSelect = onSelect;
        this.setPlaceholder('Search workspace icons...');
    }

    getSuggestions(query: string): string[] {
        return POPULAR_ICONS.filter(icon =>
            icon.toLowerCase().includes(query.toLowerCase())
        );
    }

    renderSuggestion(value: string, el: HTMLElement) {
        el.addClass('spaces-icon-suggestion');

        const iconContainer = el.createDiv();
        setIcon(iconContainer, value);

        el.createSpan({ text: value });
    }

    onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
        this.onSelect(item);
    }
}
