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


import { test, assertEqual, assertTrue, assertDeepEqual } from './lib/assert.js';
import {
    clampFanItems, selectFanEntries, computeFanLayout, chooseFanDirection, FAN_MIN_ITEMS, FAN_MAX_ITEMS,
} from '../src/core/FanLayout.js';


test('clampFanItems: keeps the count inside the allowed range', () => {
    assertEqual(clampFanItems(10), 10);
    assertEqual(clampFanItems(1), FAN_MIN_ITEMS);
    assertEqual(clampFanItems(99), FAN_MAX_ITEMS);
    assertEqual(clampFanItems(NaN), 10);
});

test('selectFanEntries: newest first, hidden files dropped, capped', () => {
    const entries = [
        { name: 'old.txt', time: 10 },
        { name: '.hidden', time: 999 },
        { name: 'new.png', time: 50 },
        { name: 'mid.pdf', time: 30 },
    ];
    assertDeepEqual(selectFanEntries(entries, 10).map(e => e.name), ['new.png', 'mid.pdf', 'old.txt']);
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `f${i}`, time: i }));
    const picked = selectFanEntries(many, 8);
    assertEqual(picked.length, 8);
    assertEqual(picked[0].name, 'f29');
});

test('selectFanEntries: ties are broken by name so the order is stable', () => {
    const entries = [{ name: 'b', time: 5 }, { name: 'a', time: 5 }];
    assertDeepEqual(selectFanEntries(entries, 10).map(e => e.name), ['a', 'b']);
});

test('computeFanLayout: bottom dock grows upwards and drifts further right each step', () => {
    const layout = computeFanLayout({ count: 5, step: 50, gap: 10, edge: 'BOTTOM', direction: 1 });
    assertEqual(layout.length, 5);
    for (let i = 1; i < layout.length; i++) {
        assertTrue(layout[i].dy < layout[i - 1].dy, `item ${i} is higher:`);
        assertTrue(layout[i].dx > layout[i - 1].dx, `item ${i} is further right:`);
        assertTrue(layout[i].angle > layout[i - 1].angle, `item ${i} leans more:`);
    }
    assertTrue(layout[0].dy < 0 && layout[0].dx >= 0 && layout[0].angle >= 0);
});

test('computeFanLayout: top dock mirrors vertically, left curve mirrors sideways', () => {
    const base = computeFanLayout({ count: 3, step: 50, gap: 10, edge: 'BOTTOM', direction: 1 });
    const top = computeFanLayout({ count: 3, step: 50, gap: 10, edge: 'TOP', direction: 1 });
    const left = computeFanLayout({ count: 3, step: 50, gap: 10, edge: 'BOTTOM', direction: -1 });
    for (let i = 0; i < 3; i++) {
        assertEqual(top[i].dy, -base[i].dy);
        assertEqual(top[i].dx, base[i].dx);
        assertEqual(left[i].dx, -base[i].dx);
        assertEqual(left[i].angle, -base[i].angle);
    }
});

test('chooseFanDirection: curves left only when the right side has no room', () => {
    const monitor = { monitorX: 0, monitorWidth: 1920 };
    assertEqual(chooseFanDirection({ anchorX: 900, maxShift: 120, rightMargin: 40, ...monitor }), 1);
    assertEqual(chooseFanDirection({ anchorX: 1850, maxShift: 120, rightMargin: 40, ...monitor }), -1);
});
