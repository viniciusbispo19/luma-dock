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


import Gtk from 'gi://Gtk';

import { buildBlurPage } from './src/prefs/BlurPage.js';
import { buildPresetsPage } from './src/prefs/PresetsPage.js';
import { buildPanelPage } from './src/prefs/PanelPage.js';
import { buildAboutPage } from './src/prefs/AboutPage.js';
import { buildLayoutPage } from './src/prefs/LayoutPage.js';
import { buildModulesPage } from './src/prefs/ModulesPage.js';
import { buildBehaviorPage } from './src/prefs/BehaviorPage.js';
import { migrateSettings } from './src/core/SettingsMigration.js';
import { buildMusicPillPage } from './src/prefs/MusicPillPage.js';
import { buildAppearancePage } from './src/prefs/AppearancePage.js';
import { disconnectSettingSignals } from './src/prefs/SettingsSignals.js';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


// Below 600px wide, Adw.PreferencesWindow moves the page tabs to a bottom bar.
const NARROW_WIDTH = 590;
const MAX_SCREEN_WIDTH_SHARE = 0.9;
const SCREEN_HEIGHT_SHARE = 0.85;
const MAX_HEIGHT = 900;

function smallestMonitorSize(display) {
    const monitors = display.get_monitors();
    let width = Infinity;
    let height = Infinity;
    for (let i = 0; i < monitors.get_n_items(); i++) {
        const geometry = monitors.get_item(i).get_geometry();
        width = Math.min(width, geometry.width);
        height = Math.min(height, geometry.height);
    }
    return Number.isFinite(width) ? { width, height } : null;
}

// Opens wide enough for every tab title to fit in the header bar (so the close button is not
// pushed out), or narrow enough for the tabs to move to the bottom bar when that is not possible.
function fitWindowToScreen(window) {
    const screen = smallestMonitorSize(window.get_display());
    if (!screen) return;

    const [, naturalWidth] = window.measure(Gtk.Orientation.HORIZONTAL, -1);
    const width = naturalWidth <= screen.width * MAX_SCREEN_WIDTH_SHARE ? naturalWidth : NARROW_WIDTH;
    const height = Math.min(MAX_HEIGHT, Math.floor(screen.height * SCREEN_HEIGHT_SHARE));
    window.set_default_size(width, height);
}

export default class LumaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        migrateSettings(settings, this.metadata['version-name']);

        buildPresetsPage(window, settings);
        buildLayoutPage(window, settings);
        buildPanelPage(window, settings);
        buildAppearancePage(window, settings);
        buildBlurPage(window, settings);
        buildBehaviorPage(window, settings);
        buildModulesPage(this, window, settings);
        buildMusicPillPage(window, settings);
        buildAboutPage(this, window);
        window.set_search_enabled(true);
        fitWindowToScreen(window);

        window.connect('close-request', () => {
            disconnectSettingSignals();
            return false;
        });
    }
}