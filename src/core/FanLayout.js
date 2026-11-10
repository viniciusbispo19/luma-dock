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

// Pure math for the folder "fan": which files to show and where each one
// goes on the arc. Kept free of GNOME imports so it can be unit tested.


export const FAN_MIN_ITEMS = 5;
export const FAN_MAX_ITEMS = 15;

// Radius of the circle the fan follows. Bigger = straighter fan.
const ARC_RADIUS = 1400;
// Share of the arc angle applied as item tilt (the full angle looks too steep).
const TILT_RATIO = 0.6;

export function clampFanItems(count) {
    const value = Number.isFinite(count) ? Math.round(count) : 10;
    return Math.min(FAN_MAX_ITEMS, Math.max(FAN_MIN_ITEMS, value));
}

/**
 * Picks the newest `max` entries ({name, time}) and drops hidden files.
 * Index 0 is the newest one, which is drawn closest to the dock.
 */
export function selectFanEntries(entries, max) {
    return entries
        .filter(entry => entry && entry.name && !entry.name.startsWith('.'))
        .sort((a, b) => (b.time || 0) - (a.time || 0) || a.name.localeCompare(b.name))
        .slice(0, clampFanItems(max));
}

/** Sideways shift of a point `rise` pixels up a circle of radius `radius`. */
function arcOffset(rise, radius) {
    const clamped = Math.min(Math.abs(rise), radius);
    return radius - Math.sqrt(radius * radius - clamped * clamped);
}

/**
 * Where each fan item sits, relative to the anchor point (the middle of the
 * folder icon, on the dock's inner edge).
 *
 * @param {object} opts
 * @param {number} opts.count     number of items (index 0 = closest to the dock)
 * @param {number} opts.step      distance between item centres along the fan
 * @param {number} opts.gap       distance from the anchor to the first item
 * @param {'BOTTOM'|'TOP'} opts.edge  dock edge; the fan grows away from it
 * @param {1|-1} opts.direction   1 curves to the right, -1 to the left
 * @returns {{dx: number, dy: number, angle: number}[]} angle in degrees
 */
export function computeFanLayout({ count, step, gap, edge = 'BOTTOM', direction = 1, radius = ARC_RADIUS }) {
    const away = edge === 'TOP' ? 1 : -1;
    const layout = [];
    for (let i = 0; i < count; i++) {
        const rise = gap + step * i + step / 2;
        const theta = Math.asin(Math.min(1, rise / radius));
        layout.push({
            dx: direction * arcOffset(rise, radius),
            dy: away * rise,
            // Clutter's z-rotation is clockwise for positive angles. On a bottom
            // dock curving right, items lean right (clockwise); a top dock or a
            // left curve mirrors that.
            angle: -away * direction * (theta * 180 / Math.PI) * TILT_RATIO,
        });
    }
    return layout;
}

/**
 * Curves to the right unless the outermost item would leave the monitor;
 * in that case it curves to the left.
 */
export function chooseFanDirection({ anchorX, maxShift, rightMargin, monitorX, monitorWidth }) {
    const fitsRight = anchorX + maxShift + rightMargin <= monitorX + monitorWidth;
    return fitsRight ? 1 : -1;
}
