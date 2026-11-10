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

// Windows the dock must pretend do not exist, matched by window class
// (the xdg-toplevel app_id on Wayland). Used for on-screen indicators that
// third-party apps open as ordinary windows, such as OpenLogi's Caps Lock OSD.
// Kept free of GNOME imports so it can be unit tested.


function escapeRegExp(text) {
    return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits "a, b c" into lower-cased glob patterns; blanks are dropped. */
export function parsePatterns(raw) {
    return (raw || '')
        .split(/[\s,;]+/)
        .map(pattern => pattern.trim().toLowerCase())
        .filter(pattern => pattern.length > 0);
}

/** Turns a glob ("*" = any run of characters) into an anchored RegExp. */
export function patternToRegExp(pattern) {
    const body = pattern.split('*').map(escapeRegExp).join('.*');
    return new RegExp(`^${body}$`, 'i');
}

export function classMatches(wmClass, regexps) {
    if (!wmClass) return false;
    return regexps.some(re => re.test(wmClass));
}

let _cachedRaw = null;
let _cachedRegexps = [];

function _regexpsFor(raw) {
    if (raw !== _cachedRaw) {
        _cachedRaw = raw;
        _cachedRegexps = parsePatterns(raw).map(patternToRegExp);
    }
    return _cachedRegexps;
}

/**
 * True when the window's class matches one of the patterns in `raw`
 * (the 'ignored-window-classes' setting). The compiled patterns are cached
 * while the setting text stays the same, because this runs on every render.
 */
export function isIgnoredWindow(win, raw) {
    const regexps = _regexpsFor(raw);
    if (!win || regexps.length === 0) return false;
    return classMatches(win.get_wm_class?.(), regexps) ||
        classMatches(win.get_gtk_application_id?.(), regexps);
}

/**
 * True for a window that is still being set up: no class, no title and not
 * shown on screen yet. Wayland clients may create the window before sending
 * its app_id (OpenLogi's OSD does), so for a moment it can't be matched
 * against the ignore list. Minimized windows are hidden too, hence the
 * `minimized` check. A real app that never sets a class still shows up
 * once its window is drawn, because it then stops being hidden.
 */
export function isUnreadyWindow(win) {
    if (!win) return false;
    return !win.get_wm_class?.() && !win.get_title?.() &&
        !win.minimized && Boolean(win.is_hidden?.());
}

/** Single entry point for the dock: ignored by the user's list, or not ready yet. */
export function isHiddenFromDock(win, raw) {
    return isUnreadyWindow(win) || isIgnoredWindow(win, raw);
}
