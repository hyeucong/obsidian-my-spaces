import { Notice } from 'obsidian';
import MySpacesPlugin, { SpaceCreateModal } from './main';
import { Space } from './settings';

/**
 * Registers global static commands for the plugin.
 */
export function registerGlobalCommands(plugin: MySpacesPlugin) {
    // Command to switch to the default view
    plugin.addCommand({
        id: 'go-to-default-view',
        name: 'Go to default view',
        callback: () => {
            void plugin.setActiveSpace('default').then(() => {
                new Notice('Switched to default view');
            });
        }
    });

    // NEW: Command to trigger the Add Space modal
    plugin.addCommand({
        id: 'open-add-space-modal',
        name: 'Add new space',
        callback: () => {
            new SpaceCreateModal(plugin.app, plugin, (name, icon) => {
                void plugin.createNewSpace(name, icon);
            }).open();
        }
    });

    // Command to hide default view button
    plugin.addCommand({
        id: 'hide-default-view-button',
        name: 'Hide default view button',
        callback: () => {
            plugin.settings.showDefaultBtn = false;
            void plugin.saveSettings().then(() => {
                plugin.renderNavButtons();
                new Notice('Default view button hidden');
            });
        }
    });

    // Command to show default view button
    plugin.addCommand({
        id: 'show-default-view-button',
        name: 'Show default view button',
        callback: () => {
            plugin.settings.showDefaultBtn = true;
            void plugin.saveSettings().then(() => {
                plugin.renderNavButtons();
                new Notice('Default view button visible');
            });
        }
    });
}

/**
 * Registers an individual hotkey command for a single space.
 */
export function registerSingleSpaceCommand(plugin: MySpacesPlugin, space: Space) {
    if (!plugin.settings.registerHotkeys) return;
    plugin.addCommand({
        id: `switch_space_${space.id}`,
        name: `Switch to space: ${space.name}`,
        callback: () => {
            if (plugin.settings.spaces.some(s => s.id === space.id)) {
                void plugin.setActiveSpace(space.id).then(() => {
                    new Notice(`Switched to space: ${space.name}`);
                });
            }
        }
    });
}

/**
 * Registers commands for all configured spaces.
 */
export function registerSpaceCommands(plugin: MySpacesPlugin) {
    if (!plugin.settings.registerHotkeys) return;
    plugin.settings.spaces.forEach(space => {
        registerSingleSpaceCommand(plugin, space);
    });
}
