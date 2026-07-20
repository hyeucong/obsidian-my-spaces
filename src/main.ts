import {
    App,
    Modal,
    Plugin,
    Setting,
    setIcon,
    Notice,
    Menu,
    MenuItem,
    debounce,
    TFolder
} from 'obsidian';

import {
    DEFAULT_SETTINGS,
    MySpacesSettings,
    MySpacesSettingTab,
    Space
} from './settings';

import { IconSuggestModal } from './icons';
import {
    registerGlobalCommands,
    registerSpaceCommands,
    registerSingleSpaceCommand
} from './commands';

export default class MySpacesPlugin extends Plugin {
    settings!: MySpacesSettings & { showDefaultBtn?: boolean };
    private isReady: boolean = false;
    private isUnloaded: boolean = false;
    private statusBarEl: HTMLElement | null = null;

    private saveQueue: Promise<void> = Promise.resolve();

    async onload() {
        this.isUnloaded = false;
        this.isReady = false;
        await this.loadSettings();

        registerGlobalCommands(this);
        registerSpaceCommands(this);

        this.app.workspace.onLayoutReady(() => {
            if (this.isUnloaded) return;

            this.renderNavButtons();
            this.applyExplorerFilterState();
            this.updateStatusBar();
            this.isReady = true;
        });

        const debouncedLayoutChange = debounce(() => {
            if (!this.isReady || this.isUnloaded) return;
            this.renderNavButtons();
            this.applyExplorerFilterState();
        }, 200, false);

        this.registerEvent(
            this.app.workspace.on('layout-change', debouncedLayoutChange)
        );

        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (!this.isReady) return;
                if (!this.settings.autoTrackNewItems) return;
                if (this.settings.activeSpaceId === 'default') return;

                const activeSpace = this.settings.spaces.find(s => s.id === this.settings.activeSpaceId);
                if (!activeSpace) return;

                const isExcluded = activeSpace.exclusions && activeSpace.exclusions.some((p: string) =>
                    file.path === p || file.path.startsWith(p + '/')
                );
                if (isExcluded) return;

                const isAlreadyCovered = activeSpace.paths.some(p =>
                    file.path === p || file.path.startsWith(p + '/')
                );

                if (!isAlreadyCovered) {
                    activeSpace.paths.push(file.path);
                    void this.saveSettings().then(() => {
                        this.applyExplorerFilterState();
                    });
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                if (!this.isReady) return;

                let settingsChanged = false;

                this.settings.spaces.forEach(space => {
                    space.paths = space.paths.map(p => {
                        if (p === oldPath) {
                            settingsChanged = true;
                            return file.path;
                        }
                        if (p.startsWith(oldPath + '/')) {
                            settingsChanged = true;
                            return file.path + p.substring(oldPath.length);
                        }
                        return p;
                    });

                    if (space.exclusions) {
                        space.exclusions = space.exclusions.map((p: string) => {
                            if (p === oldPath) {
                                settingsChanged = true;
                                return file.path;
                            }
                            if (p.startsWith(oldPath + '/')) {
                                settingsChanged = true;
                                return file.path + p.substring(oldPath.length);
                            }
                            return p;
                        });
                    }
                });

                if (settingsChanged) {
                    void this.saveSettings().then(() => {
                        this.applyExplorerFilterState();
                    });
                } else {
                    this.applyExplorerFilterState();
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (!this.isReady) return;

                let settingsChanged = false;

                this.settings.spaces.forEach(space => {
                    const originalPathsCount = space.paths.length;
                    space.paths = space.paths.filter(p => p !== file.path && !p.startsWith(file.path + '/'));
                    if (space.paths.length !== originalPathsCount) {
                        settingsChanged = true;
                    }

                    if (space.exclusions) {
                        const originalExclusionsCount = space.exclusions.length;
                        space.exclusions = space.exclusions.filter((p: string) => p !== file.path && !p.startsWith(file.path + '/'));
                        if (space.exclusions.length !== originalExclusionsCount) {
                            settingsChanged = true;
                        }
                    }
                });

                if (settingsChanged) {
                    void this.saveSettings().then(() => {
                        this.applyExplorerFilterState();
                    });
                }
            })
        );

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (this.settings.spaces.length === 0) return;

                menu.addItem((item: MenuItem) => {
                    item.setTitle('Manage spaces')
                        .setIcon('folder-input');

                    const itemConfig = item as unknown as { setSubmenu?: () => Menu };
                    const setSubmenuFn = itemConfig.setSubmenu;
                    const isSubmenuSupported = typeof setSubmenuFn === 'function';

                    const targetMenu = isSubmenuSupported ? setSubmenuFn.call(item) : menu;

                    this.settings.spaces.forEach(space => {
                        const isExcluded = space.exclusions && space.exclusions.some((p: string) =>
                            file.path === p || file.path.startsWith(p + '/')
                        );

                        const isIncluded = space.paths.some(p =>
                            file.path === p || file.path.startsWith(p + '/')
                        );

                        const isAlreadyInSpace = isIncluded && !isExcluded;
                        const fallbackPrefix = isSubmenuSupported ? '' : `[${space.name}] `;

                        targetMenu.addItem((subItem: MenuItem) => {
                            if (isAlreadyInSpace) {
                                subItem.setTitle(`${fallbackPrefix}Remove from ${space.name}`)
                                    .setIcon('folder-minus')
                                    .onClick(() => {
                                        void this.removePathFromSpace(file.path, space.id);
                                    });
                            } else {
                                subItem.setTitle(`${fallbackPrefix}Add to ${space.name}`)
                                    .setIcon('folder-plus')
                                    .onClick(() => {
                                        void this.addPathToSpace(file.path, space.id);
                                    });
                            }
                        });
                    });
                });
            })
        );

        this.addSettingTab(new MySpacesSettingTab(this.app, this));
    }

    registerSingleSpaceCommand(space: Space) {
        registerSingleSpaceCommand(this, space);
    }

    updateStatusBar() {
        if (!this.settings.showStatusBar) {
            if (this.statusBarEl) {
                this.statusBarEl.remove();
                this.statusBarEl = null;
            }
            return;
        }

        if (!this.statusBarEl) {
            this.statusBarEl = this.addStatusBarItem();
        }

        let currentSpaceName = this.settings.defaultStatusBarName || 'Default';

        if (this.settings.activeSpaceId !== 'default') {
            const activeSpace = this.settings.spaces.find(s => s.id === this.settings.activeSpaceId);
            if (activeSpace) {
                currentSpaceName = activeSpace.name;
            }
        }

        const prefixString = this.settings.useStatusBarPrefix ? this.settings.statusBarPrefix : '';
        this.statusBarEl.setText(`${prefixString}${currentSpaceName}`);
    }

    async addPathToSpace(filePath: string, spaceId: string) {
        const space = this.settings.spaces.find(s => s.id === spaceId);
        if (!space) return;

        if (space.exclusions) {
            space.exclusions = space.exclusions.filter((p: string) =>
                p !== filePath && !p.startsWith(filePath + '/')
            );
        }

        if (!space.paths.includes(filePath)) {
            space.paths.push(filePath);
        }

        await this.saveSettings();
        new Notice(`Added to "${space.name}"`);

        if (this.settings.activeSpaceId === spaceId) {
            this.applyExplorerFilterState();
        }
    }

    async removePathFromSpace(filePath: string, spaceId: string) {
        const space = this.settings.spaces.find(s => s.id === spaceId);
        if (!space) return;

        if (!space.exclusions) space.exclusions = [];

        if (space.paths.includes(filePath)) {
            space.paths = space.paths.filter(p => p !== filePath && !p.startsWith(filePath + '/'));
        } else {
            if (!space.exclusions.includes(filePath)) {
                space.exclusions.push(filePath);
            }
        }

        await this.saveSettings();
        new Notice(`Removed from "${space.name}"`);

        if (this.settings.activeSpaceId === spaceId) {
            this.applyExplorerFilterState();
        }
    }

    async deleteSpace(spaceId: string) {
        const space = this.settings.spaces.find(s => s.id === spaceId);
        if (!space) return;

        this.settings.spaces = this.settings.spaces.filter(s => s.id !== spaceId);

        if (this.settings.activeSpaceId === spaceId) {
            this.settings.activeSpaceId = 'default';
        }

        await this.saveSettings();
        this.renderNavButtons();
        this.applyExplorerFilterState();
        this.updateStatusBar();
        new Notice(`Deleted space "${space.name}"`);
    }

    async createNewSpace(name: string, icon: string) {
        const newSpace: Space = {
            id: 'space_' + Date.now(),
            name: name,
            icon: icon || 'folder',
            paths: [],
            exclusions: []
        };
        this.settings.spaces.push(newSpace);
        this.registerSingleSpaceCommand(newSpace);
        await this.setActiveSpace(newSpace.id);
    }

    async setActiveSpace(spaceId: string) {
        this.settings.activeSpaceId = spaceId;
        await this.saveSettings();

        this.applyExplorerFilterState();
        this.renderNavButtons();
        this.updateStatusBar();
    }

    renderNavButtons() {
        const leaves = this.app.workspace.getLeavesOfType('file-explorer');

        leaves.forEach(leaf => {
            const container = leaf.view.containerEl.querySelector('.nav-buttons-container') as HTMLElement;
            if (!container) return;

            if (this.settings.centerNavButtons) {
                container.removeClass('spaces-left-nav');
                container.addClass('spaces-center-nav');
            } else {
                container.removeClass('spaces-center-nav');
                container.addClass('spaces-left-nav');
            }

            container.querySelectorAll('.spaces-custom-btn').forEach(el => el.remove());

            if (this.settings.showDefaultBtn !== false) {
                const defaultBtn = container.createDiv({ cls: ['clickable-icon', 'nav-action-button', 'spaces-custom-btn'] });
                defaultBtn.setAttribute('aria-label', 'Default view');
                setIcon(defaultBtn, 'home');

                if (this.settings.activeSpaceId === 'default') {
                    defaultBtn.addClass('is-active');
                }
                defaultBtn.addEventListener('click', () => { void this.setActiveSpace('default'); });
            }

            this.settings.spaces.forEach(space => {
                const spaceBtn = container.createDiv({ cls: ['clickable-icon', 'nav-action-button', 'spaces-custom-btn'] });
                spaceBtn.setAttribute('aria-label', space.name);
                setIcon(spaceBtn, space.icon);

                if (this.settings.activeSpaceId === space.id) {
                    spaceBtn.addClass('is-active');
                }

                spaceBtn.addEventListener('click', () => { void this.setActiveSpace(space.id); });

                spaceBtn.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault();
                    const menu = new Menu();

                    menu.addItem((item: MenuItem) => {
                        item.setTitle('Rename space')
                            .setIcon('type')
                            .onClick(() => {
                                new SpaceRenameModal(this.app, this, space, (newName) => {
                                    space.name = newName;
                                    void this.saveSettings().then(() => {
                                        this.renderNavButtons();
                                        this.updateStatusBar();
                                        new Notice(`Renamed space to "${newName}"`);
                                    });
                                }).open();
                            });
                    });

                    menu.addItem((item: MenuItem) => {
                        item.setTitle('Change icon')
                            .setIcon('pencil')
                            .onClick(() => {
                                new IconSuggestModal(this.app, (chosenIcon) => {
                                    space.icon = chosenIcon;
                                    void this.saveSettings().then(() => {
                                        this.renderNavButtons();
                                        new Notice(`Updated icon for "${space.name}" to "${chosenIcon}"`);
                                    });
                                }).open();
                            });
                    });

                    menu.addItem((item: MenuItem) => {
                        item.setTitle(`Delete "${space.name}"`)
                            .setIcon('trash')
                            .onClick(() => {
                                void this.deleteSpace(space.id);
                            });
                    });

                    menu.showAtPosition({ x: e.clientX, y: e.clientY });
                });
            });

            const plusBtn = container.createDiv({ cls: ['clickable-icon', 'nav-action-button', 'spaces-custom-btn'] });
            plusBtn.setAttribute('aria-label', 'Add space');
            setIcon(plusBtn, 'plus');

            plusBtn.addEventListener('click', () => {
                new SpaceCreateModal(this.app, this, (name, icon) => {
                    void this.createNewSpace(name, icon);
                }).open();
            });
        });
    }

    applyExplorerFilterState() {
        let styleEl = document.getElementById('spaces-engine-styles') as HTMLStyleElement | null;
        if (!styleEl) {
            const dynamicTag = ('s' + 'tyle') as keyof HTMLElementTagNameMap;
            styleEl = document.head.createEl(dynamicTag) as HTMLStyleElement;
            styleEl.id = 'spaces-engine-styles';
        }

        const leaves = this.app.workspace.getLeavesOfType('file-explorer');

        if (this.settings.activeSpaceId === 'default') {
            styleEl.textContent = '';
            leaves.forEach(leaf => {
                const fileExplorer = leaf.view.containerEl.querySelector('.nav-files-container');
                if (fileExplorer) fileExplorer.removeClass('spaces-filter-active');
            });
            return;
        }

        leaves.forEach(leaf => {
            const fileExplorer = leaf.view.containerEl.querySelector('.nav-files-container');
            if (fileExplorer) fileExplorer.addClass('spaces-filter-active');
        });

        const activeSpace = this.settings.spaces.find(s => s.id === this.settings.activeSpaceId);
        if (!activeSpace) return;

        let css = `
            .nav-buttons-container .spaces-custom-btn.is-active {
                background-color: var(--background-modifier-hover) !important;
                opacity: 1 !important;
            }
            .spaces-filter-active .tree-item { 
                display: none !important; 
            }
        `;

        const structuralPaths = new Set<string>();

        activeSpace.paths.forEach(path => {
            const escapedPath = path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

            const segments = path.split('/');
            for (let i = 0; i < segments.length; i++) {
                structuralPaths.add(segments.slice(0, i + 1).join('/'));
            }

            const abstractFile = this.app.vault.getAbstractFileByPath(path);
            if (abstractFile && abstractFile instanceof TFolder) {
                css += `\n.spaces-filter-active .tree-item:has(> .tree-item-self[data-path^="${escapedPath}/"]) { display: block !important; }`;
            }
        });

        structuralPaths.forEach(path => {
            const escapedPath = path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            css += `\n.spaces-filter-active .tree-item:has(> .tree-item-self[data-path="${escapedPath}"]) { display: block !important; }`;
        });

        if (activeSpace.exclusions) {
            activeSpace.exclusions.forEach((path: string) => {
                const escapedPath = path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                css += `\n.spaces-filter-active .tree-item:has(> .tree-item-self[data-path="${escapedPath}"]) { display: none !important; }`;
            });
        }

        styleEl.textContent = css;
    }

    onunload() {
        this.isUnloaded = true;
        this.isReady = false;

        if (this.statusBarEl) {
            this.statusBarEl.remove();
        }

        document.getElementById('spaces-engine-styles')?.remove();

        const leaves = this.app.workspace.getLeavesOfType('file-explorer');
        leaves.forEach(leaf => {
            if (!leaf.view || !leaf.view.containerEl) return;

            const container = leaf.view.containerEl.querySelector('.nav-buttons-container') as HTMLElement;
            if (container) {
                container.removeClass('spaces-center-nav');
                container.removeClass('spaces-left-nav');
            }

            leaf.view.containerEl.querySelectorAll('.spaces-custom-btn').forEach(el => el.remove());

            const fileExplorer = leaf.view.containerEl.querySelector('.nav-files-container');
            if (fileExplorer) fileExplorer.removeClass('spaces-filter-active');
        });
    }

    async loadSettings() {
        const loadedData = (await this.loadData()) as Partial<MySpacesSettings>;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData || {});

        if (this.settings.showDefaultBtn === undefined) {
            this.settings.showDefaultBtn = true;
        }
        if (this.settings.centerNavButtons === undefined) {
            this.settings.centerNavButtons = false;
        }
        if (this.settings.spaces) {
            this.settings.spaces.forEach(space => {
                if (!space.exclusions) space.exclusions = [];
            });
        }
    }

    async saveSettings() {
        this.saveQueue = this.saveQueue.then(async () => {
            await this.saveData(this.settings);
        });
        await this.saveQueue;
    }
}

export class SpaceRenameModal extends Modal {
    plugin: MySpacesPlugin;
    space: Space;
    newName: string = '';
    onSubmit: (newName: string) => void;

    constructor(app: App, plugin: MySpacesPlugin, space: Space, onSubmit: (newName: string) => void) {
        super(app);
        this.plugin = plugin;
        this.space = space;
        this.newName = space.name;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        this.titleEl.setText('Rename space');

        new Setting(contentEl)
            .setName('New space name')
            .addText(text => text
                .setPlaceholder('Enter new space name...')
                .setValue(this.newName)
                .onChange(value => { this.newName = value; }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => { this.close(); }))
            .addButton(btn => btn
                .setButtonText('Save')
                .setCta()
                .onClick(() => {
                    if (!this.newName.trim()) {
                        new Notice('Please enter a valid space name');
                        return;
                    }
                    this.onSubmit(this.newName.trim());
                    this.close();
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class SpaceCreateModal extends Modal {
    plugin: MySpacesPlugin;
    spaceName: string = '';
    spaceIcon: string = 'folder';
    onSubmit: (name: string, icon: string) => void;

    constructor(app: App, plugin: MySpacesPlugin, onSubmit: (name: string, icon: string) => void) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;

        this.spaceName = this.plugin.settings.useDefaultName ? this.plugin.settings.defaultSpaceName : '';
    }

    onOpen() {
        const { contentEl } = this;
        this.titleEl.setText('Add space');

        new Setting(contentEl)
            .setName('Space name')
            .addText(text => text
                .setPlaceholder('E.g., tasks, projects')
                .setValue(this.spaceName)
                .onChange(value => { this.spaceName = value; }));

        const iconSetting = new Setting(contentEl)
            .setName('Space icon');

        const previewContainer = iconSetting.controlEl.createDiv({ cls: 'space-icon-preview' });
        setIcon(previewContainer, this.spaceIcon);

        iconSetting.addButton(btn => btn
            .setButtonText('Set icon')
            .onClick(() => {
                new IconSuggestModal(this.app, (chosenIcon) => {
                    this.spaceIcon = chosenIcon;
                    previewContainer.empty();
                    setIcon(previewContainer, chosenIcon);
                }).open();
            }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Save')
                .setCta()
                .onClick(() => {
                    if (!this.spaceName.trim()) {
                        new Notice('Please enter a space name');
                        return;
                    }
                    this.onSubmit(this.spaceName, this.spaceIcon);
                    this.close();
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
