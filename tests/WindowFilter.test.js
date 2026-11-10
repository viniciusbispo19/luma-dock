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


import { test, assertTrue, assertFalse, assertDeepEqual } from './lib/assert.js';
import {
    parsePatterns, patternToRegExp, isIgnoredWindow, isUnreadyWindow, isHiddenFromDock,
} from '../src/core/WindowFilter.js';


function fakeWindow(wmClass, gtkAppId = null, { title = null, hidden = false, minimized = false } = {}) {
    return {
        minimized,
        get_wm_class: () => wmClass,
        get_gtk_application_id: () => gtkAppId,
        get_title: () => title,
        is_hidden: () => hidden,
    };
}

test('parsePatterns: splits on commas, semicolons and spaces, lower-cases, drops blanks', () => {
    assertDeepEqual(parsePatterns(' OpenLogi-*, foo ;bar  baz,,'), ['openlogi-*', 'foo', 'bar', 'baz']);
    assertDeepEqual(parsePatterns(''), []);
    assertDeepEqual(parsePatterns(null), []);
});

test('patternToRegExp: "*" is a wildcard and the match is anchored', () => {
    assertTrue(patternToRegExp('openlogi-*').test('openlogi-lock-key-osd'));
    assertFalse(patternToRegExp('openlogi-*').test('org.openlogi.openlogi'));
    assertFalse(patternToRegExp('osd').test('openlogi-osd'));
    assertTrue(patternToRegExp('*osd').test('openlogi-osd'));
});

test('patternToRegExp: regex characters in the pattern are taken literally', () => {
    assertTrue(patternToRegExp('org.example.app').test('org.example.app'));
    assertFalse(patternToRegExp('org.example.app').test('orgXexampleXapp'));
});

test('isIgnoredWindow: matches the window class case-insensitively', () => {
    assertTrue(isIgnoredWindow(fakeWindow('openlogi-lock-key-osd'), 'openlogi-*'));
    assertTrue(isIgnoredWindow(fakeWindow('OpenLogi-Backlight-OSD'), 'openlogi-*'));
});

test('isIgnoredWindow: keeps OpenLogi\'s main window visible', () => {
    assertFalse(isIgnoredWindow(fakeWindow('org.openlogi.openlogi'), 'openlogi-*'));
});

test('isIgnoredWindow: also checks the GTK application id', () => {
    assertTrue(isIgnoredWindow(fakeWindow(null, 'com.example.Osd'), 'com.example.*'));
});

test('isIgnoredWindow: empty setting or missing class ignores nothing', () => {
    assertFalse(isIgnoredWindow(fakeWindow('openlogi-lock-key-osd'), ''));
    assertFalse(isIgnoredWindow(fakeWindow(null), 'openlogi-*'));
    assertFalse(isIgnoredWindow(null, 'openlogi-*'));
});

test('isIgnoredWindow: picks up a changed setting', () => {
    const win = fakeWindow('foo');
    assertFalse(isIgnoredWindow(win, 'bar'));
    assertTrue(isIgnoredWindow(win, 'bar, foo'));
});

test('isUnreadyWindow: a hidden window with no class and no title is still being set up', () => {
    assertTrue(isUnreadyWindow(fakeWindow(null, null, { hidden: true })));
});

test('isUnreadyWindow: once drawn on screen, a classless window counts as a real app', () => {
    assertFalse(isUnreadyWindow(fakeWindow(null, null, { hidden: false })));
});

test('isUnreadyWindow: minimized windows are never treated as unready', () => {
    assertFalse(isUnreadyWindow(fakeWindow(null, null, { hidden: true, minimized: true })));
});

test('isUnreadyWindow: a class or a title means the window is ready', () => {
    assertFalse(isUnreadyWindow(fakeWindow('org.gnome.Ptyxis', null, { hidden: true })));
    assertFalse(isUnreadyWindow(fakeWindow(null, null, { hidden: true, title: 'Terminal' })));
    assertFalse(isUnreadyWindow(null));
});

test('isHiddenFromDock: follows the OpenLogi OSD from birth to display', () => {
    // Sequence seen in the logs: born without a class, then named, then shown.
    assertTrue(isHiddenFromDock(fakeWindow(null, null, { hidden: true }), 'openlogi-*'));
    assertTrue(isHiddenFromDock(fakeWindow('openlogi-lock-key-osd', null, { hidden: true }), 'openlogi-*'));
    assertTrue(isHiddenFromDock(fakeWindow('openlogi-lock-key-osd', null, { hidden: false }), 'openlogi-*'));
    assertFalse(isHiddenFromDock(fakeWindow('org.gnome.Ptyxis', null, { hidden: false }), 'openlogi-*'));
});
