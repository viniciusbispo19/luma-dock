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


import { test, assertEqual } from './lib/assert.js';
import { choosePlayer } from '../src/core/PlayerChoice.js';


const spotify = (extra = {}) => ({ busName: 'spotify', isPlaying: false, hasTrack: true, lastActive: 100, ...extra });
const browser = (extra = {}) => ({ busName: 'brave', isPlaying: false, hasTrack: false, lastActive: 200, ...extra });

test('choosePlayer: no players means nothing to show', () => {
    assertEqual(choosePlayer([]), null);
});

test('choosePlayer: after closing the video tab, a paused Spotify wins over the empty browser', () => {
    assertEqual(choosePlayer([spotify(), browser()], { currentBus: 'brave' }), 'spotify');
});

test('choosePlayer: a playing player always wins', () => {
    assertEqual(choosePlayer([spotify(), browser({ isPlaying: true, hasTrack: true })], { currentBus: 'spotify' }), 'brave');
});

test('choosePlayer: keeps the current player while it plays', () => {
    const players = [spotify({ isPlaying: true }), browser({ isPlaying: true, hasTrack: true, lastActive: 999 })];
    assertEqual(choosePlayer(players, { currentBus: 'spotify' }), 'spotify');
});

test('choosePlayer: among several playing players, the most recent one wins', () => {
    const players = [spotify({ isPlaying: true, lastActive: 10 }), browser({ isPlaying: true, hasTrack: true, lastActive: 50 })];
    assertEqual(choosePlayer(players, { currentBus: null }), 'brave');
});

test('choosePlayer: a paused current player with a track is kept', () => {
    const players = [spotify({ lastActive: 10 }), browser({ hasTrack: true, lastActive: 50 })];
    assertEqual(choosePlayer(players, { currentBus: 'spotify' }), 'spotify');
});

test('choosePlayer: the user pick stays only while it has something to show', () => {
    const players = [spotify(), browser({ hasTrack: true })];
    assertEqual(choosePlayer(players, { currentBus: 'spotify', pinnedBus: 'brave' }), 'brave');
    assertEqual(choosePlayer([spotify(), browser()], { currentBus: 'brave', pinnedBus: 'brave' }), 'spotify');
});

test('choosePlayer: with nothing loaded anywhere, stays on the current player', () => {
    const players = [spotify({ hasTrack: false }), browser()];
    assertEqual(choosePlayer(players, { currentBus: 'brave' }), 'brave');
    assertEqual(choosePlayer(players, { currentBus: null }), 'spotify');
});
