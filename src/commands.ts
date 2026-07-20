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
                plugin.showNotice('Switched to default view');
            });
        }
    });

    // Command to trigger the Add space modal
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
                plugin.showNotice('Default view button hidden');
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
                plugin.showNotice('Default view button visible');
            });
        }
    });

    // Command to hide all created space buttons
    plugin.addCommand({
        id: 'hide-space-buttons',
        name: 'Hide all space buttons',
        callback: () => {
            plugin.settings.showSpacesBtns = false;
            void plugin.saveSettings().then(() => {
                plugin.renderNavButtons();
                plugin.showNotice('All space buttons hidden');
            });
        }
    });

    // Command to show all created space buttons
    plugin.addCommand({
        id: 'show-space-buttons',
        name: 'Show all space buttons',
        callback: () => {
            plugin.settings.showSpacesBtns = true;
            void plugin.saveSettings().then(() => {
                plugin.renderNavButtons();
                plugin.showNotice('All space buttons visible');
            });
        }
    });
}

/**
 * Registers an individual hotkey command for a single space using checkCallback.
 */
export function registerSingleSpaceCommand(plugin: MySpacesPlugin, space: Space) {
    plugin.addCommand({
        id: `switch_space_${space.id}`,
        name: `Switch to space: ${space.name}`,
        checkCallback: (checking: boolean) => {
            if (!plugin.settings.registerHotkeys) return false;

            const spaceExists = plugin.settings.spaces.some(s => s.id === space.id);
            if (!spaceExists) return false;

            if (!checking) {
                void plugin.setActiveSpace(space.id).then(() => {
                    plugin.showNotice(`Switched to space: ${space.name}`);
                });
            }
            return true;
        }
    });
}

/**
 * Registers commands for all configured spaces.
 */
export function registerSpaceCommands(plugin: MySpacesPlugin) {
    plugin.settings.spaces.forEach(space => {
        registerSingleSpaceCommand(plugin, space);
    });
}
