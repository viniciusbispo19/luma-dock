/*
* Dhruva GNOME Extension
* Copyright (C) 2026 NarkAgni
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program. If not, see <https://www.gnu.org/licenses/>.
*/


import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { destroyUtils } from './src/core/Utils.js';
import { Settings } from './src/core/SettingsManager.js';
import { migrateLegacyPaths } from './src/core/DataPaths.js';
import { TimeoutTracker } from './src/core/TimeoutTracker.js';
import { migrateSettings } from './src/core/SettingsMigration.js';
import QuickLaunchManager from './src/core/QuickLaunchManager.js';
import MultiMonitorController from './src/core/MultiMonitorController.js';


const SHORTCUT_KEY = 'toggle-independent-dock-shortcut';
const MONITORS_SETTLE_MS = 500;

const RELOAD_KEYS = ['dock-position', 'independent-dock', 'full-width', 'hybrid-panel-mode', 'start-menu'];

export default class LumaExtension extends Extension {
    enable() {
        this._isRunning = false;

        // With "unlock-dialog" in metadata.json, GNOME Shell no longer disables
        // the extension when the screen locks, so it follows the session mode
        // itself: the whole dock is torn down while locked and rebuilt after
        // unlocking, exactly as if GNOME had called disable()/enable().
        Main.sessionMode.connectObject('updated', () => this._syncSessionMode(), this);
        this._syncSessionMode();
    }

    _syncSessionMode() {
        const { currentMode, parentMode } = Main.sessionMode;
        // Custom user modes (e.g. classic) report 'user' as their parent mode.
        const isUserSession = currentMode === 'user' || parentMode === 'user';

        if (isUserSession && !this._isRunning) this._start();
        else if (!isUserSession && this._isRunning) this._stop();
    }

    _start() {
        this._settings = this.getSettings();
        migrateLegacyPaths(this._settings);
        migrateSettings(this._settings, this.metadata['version-name']);
        Settings.init(this._settings);
        this._timers = new TimeoutTracker();
        this._isShortcutRegistered = false;
        this._monitorsChangedId = 0;

        this._monitorController = new MultiMonitorController(this._settings, () => this.openPreferences(), this.uuid);

        Main.layoutManager.connectObject('monitors-changed', () => {
            if (this._monitorsChangedId) {
                this._timers.remove(this._monitorsChangedId);
                this._monitorsChangedId = 0;
            }
            this._monitorsChangedId = this._timers.addTimeout(GLib.PRIORITY_DEFAULT, MONITORS_SETTLE_MS, () => {
                this._monitorsChangedId = 0;
                this._monitorController.handleMonitorsChanged();
                return GLib.SOURCE_REMOVE;
            });
        }, this);

        for (const key of RELOAD_KEYS)
            this._settings.connectObject(`changed::${key}`, () => this._monitorController.reloadDocks(), this);
        this._settings.connectObject(`changed::${SHORTCUT_KEY}`, () => this._syncShortcut(), this);

        this._syncShortcut();
        this._monitorController.reloadDocks();
        this._quickLaunchManager = new QuickLaunchManager(this._settings, () => this._monitorController.getQuickLaunchDock());
        this._isRunning = true;
    }

    _syncShortcut() {
        if (this._isShortcutRegistered) {
            Main.wm.removeKeybinding(SHORTCUT_KEY);
            this._isShortcutRegistered = false;
        }

        const [accelerator] = this._settings.get_strv(SHORTCUT_KEY);
        if (!accelerator || !accelerator.trim()) return;

        Main.wm.addKeybinding(SHORTCUT_KEY, this._settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => { Settings.independentDock = !Settings.independentDock; });
        this._isShortcutRegistered = true;
    }

    _stop() {
        this._isRunning = false;

        if (this._isShortcutRegistered) Main.wm.removeKeybinding(SHORTCUT_KEY);
        this._isShortcutRegistered = false;

        Main.layoutManager.disconnectObject(this);
        this._settings.disconnectObject(this);
        this._timers.destroy();
        this._timers = null;

        this._quickLaunchManager.destroy();
        this._quickLaunchManager = null;
        this._monitorController.destroy();
        this._monitorController = null;

        destroyUtils();
        Settings.destroy();
        this._settings = null;
    }

    // Why "unlock-dialog" is in session-modes: GNOME Shell enables extensions
    // one at a time and enables those that declare more session modes first.
    // With only "user", the dock is enabled after every other extension, often
    // in the middle of the login animation, so GNOME's own dash shows up for a
    // moment before the dock replaces it. Declaring "unlock-dialog" moves the
    // dock to the front of the queue. Nothing of the dock runs on the lock
    // screen: _syncSessionMode() tears everything down when the session locks
    // (including all keybindings, so no keyboard handlers stay connected) and
    // rebuilds it after unlocking.
    disable() {
        Main.sessionMode.disconnectObject(this);
        if (this._isRunning) this._stop();
    }
}
