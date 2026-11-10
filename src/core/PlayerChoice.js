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

// Which media player the Music Pill follows. Kept free of GNOME imports so
// it can be unit tested.
//
// Browsers keep one MPRIS player alive for the whole browser, so closing a
// YouTube tab leaves an empty player behind. Players with something loaded
// therefore win over empty ones, so a paused Spotify is not forgotten.


function mostRecent(players) {
    return players.reduce((best, player) =>
        (!best || (player.lastActive || 0) > (best.lastActive || 0) ? player : best), null);
}

/**
 * @param {{busName: string, isPlaying: boolean, hasTrack: boolean, lastActive?: number}[]} players
 * @param {{currentBus?: string|null, pinnedBus?: string|null}} state
 *   currentBus: the player shown now; pinnedBus: the player the user picked
 * @returns {string|null} bus name of the player to show
 */
export function choosePlayer(players, { currentBus = null, pinnedBus = null } = {}) {
    if (players.length === 0) return null;

    const byBus = bus => players.find(player => player.busName === bus) || null;
    const pinned = byBus(pinnedBus);
    const current = byBus(currentBus);

    // The user's pick stays while it still has something to show.
    if (pinned && (pinned.isPlaying || pinned.hasTrack)) return pinned.busName;

    // Something playing always wins; keep the current one if it is playing.
    if (current && current.isPlaying) return current.busName;
    const playing = players.filter(player => player.isPlaying);
    if (playing.length > 0) return mostRecent(playing).busName;

    // Nothing plays: stay on a paused player with a track, else the one
    // with a track that played most recently.
    if (current && current.hasTrack) return current.busName;
    const loaded = players.filter(player => player.hasTrack);
    if (loaded.length > 0) return mostRecent(loaded).busName;

    return (current || players[0]).busName;
}
