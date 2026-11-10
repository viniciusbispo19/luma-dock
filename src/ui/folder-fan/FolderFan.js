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

// The folder "fan": clicking a folder on the dock shows its newest files on
// an arc rising from the icon. It lives in the dock's activeFolderMenu slot,
// so the dock stays visible while it is open and closes it like any menu.


import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import Pango from 'gi://Pango';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { isActorAlive } from '../../core/Utils.js';
import { Settings } from '../../core/SettingsManager.js';
import { thumbnail } from '../startmenu/StartMenuWidgets.js';
import { setMagnifierPauseState } from '../magnifier/MagnifierState.js';
import { selectFanEntries, computeFanLayout, chooseFanDirection } from '../../core/FanLayout.js';


const FILE_ATTRIBUTES = [
    'standard::name', 'standard::display-name', 'standard::content-type', 'standard::icon',
    'standard::type', 'standard::is-hidden', 'standard::is-backup', 'thumbnail::path', 'time::modified',
].join(',');
const ENUMERATE_BATCH = 200;
// Stop reading huge folders: the newest files are what matters and the
// Shell must stay responsive.
const MAX_SCANNED = 5000;

const THUMB_SIZE = 40;
const THUMB_RADIUS = 8;
const ITEM_STEP = 48;
const FIRST_GAP = 16;
const LABEL_WIDTH = 240;
const LABEL_SPACING = 10;
const ITEM_WIDTH = LABEL_WIDTH + LABEL_SPACING + THUMB_SIZE;
const EDGE_MARGIN = 12;

const OPEN_DURATION = 260;
const OPEN_STAGGER = 18;
const CLOSE_DURATION = 150;
const CLOSE_STAGGER = 8;
const START_SCALE = 0.4;

const PAUSE_KEY = 'folder-fan';
const FILE_MANAGER_ID = 'org.gnome.Nautilus.desktop';

/** True for dock edges the fan supports (it grows up or down from the dock). */
export function canShowFolderFan(dockPosition) {
    return dockPosition === 'BOTTOM' || dockPosition === 'TOP';
}

export default class FolderFan {
    /**
     * @param {object} dockUI
     * @param {{path: string, name: string}} folder
     * @param {St.Widget} buttonActor  the folder button on the dock
     * @param {Function} openInFiles  opens the folder in the file manager
     */
    constructor(dockUI, folder, buttonActor, openInFiles) {
        this.dockUI = dockUI;
        this.folder = folder;
        this.buttonActor = buttonActor;
        this._openInFiles = openInFiles;
        this._cancellable = new Gio.Cancellable();
        this._items = [];
        this._grab = null;
        this._isClosing = false;

        this.actor = new St.Widget({ reactive: true, can_focus: true });
        this._fan = new St.Widget();
        this.actor.add_child(this._fan);

        this.actor.connectObject(
            'button-release-event', () => {
                this.hide();
                return Clutter.EVENT_STOP;
            },
            'key-press-event', (_actor, event) => {
                if (event.get_key_symbol() !== Clutter.KEY_Escape) return Clutter.EVENT_PROPAGATE;
                this.hide();
                return Clutter.EVENT_STOP;
            },
            'destroy', () => this._onDestroy(),
            this);

        if (isActorAlive(this.buttonActor))
            this.buttonActor.connectObject('destroy', () => this.hide(), this);
    }

    /** True when this fan belongs to the given folder button. */
    isFor(buttonActor) {
        return this.buttonActor === buttonActor;
    }

    show() {
        Main.uiGroup.add_child(this.actor);
        Main.uiGroup.set_child_above_sibling(this.actor, null);
        this.actor.set_position(0, 0);
        this.actor.set_size(global.stage.width, global.stage.height);

        // A modal grab gives the fan the keyboard (for Esc) and turns any
        // click outside the items into "close".
        this._grab = Main.pushModal(this.actor, { actionMode: Shell.ActionMode.POPUP });
        this.actor.grab_key_focus();

        if (this.dockUI.autoHideManager) this.dockUI.autoHideManager.show();
        if (isActorAlive(this.dockUI.actor)) setMagnifierPauseState(this.dockUI.actor, PAUSE_KEY, true);

        this._readFolder(entries => this._build(entries));
    }

    hide() {
        if (this._isClosing) return;
        this._isClosing = true;

        if (this.dockUI && this.dockUI.activeFolderMenu === this) this.dockUI.activeFolderMenu = null;
        this._cancellable.cancel();
        this._releaseGrab();
        if (isActorAlive(this.dockUI.actor)) setMagnifierPauseState(this.dockUI.actor, PAUSE_KEY, false);
        if (!isActorAlive(this.actor)) return;
        this.actor.reactive = false;

        const items = this._items.filter(({ actor }) => isActorAlive(actor));
        if (items.length === 0 || !this.actor.get_stage()) {
            this.actor.destroy();
            return;
        }

        let pending = items.length;
        const done = () => {
            pending--;
            if (pending === 0 && isActorAlive(this.actor)) this.actor.destroy();
        };
        items.forEach(({ actor, offset }, index) => {
            actor.remove_all_transitions();
            actor.ease({
                translation_x: -offset.dx,
                translation_y: -offset.dy,
                scale_x: START_SCALE,
                scale_y: START_SCALE,
                rotation_angle_z: 0,
                opacity: 0,
                delay: (items.length - 1 - index) * CLOSE_STAGGER,
                duration: CLOSE_DURATION,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onStopped: done,
            });
        });
    }

    _releaseGrab() {
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
    }

    _onDestroy() {
        this._cancellable.cancel();
        this._releaseGrab();
        if (isActorAlive(this.buttonActor)) this.buttonActor.disconnectObject(this);
        if (this.dockUI && this.dockUI.activeFolderMenu === this) this.dockUI.activeFolderMenu = null;
        this._items = [];
        this.actor = null;
    }

    _readFolder(done) {
        const dir = Gio.File.new_for_path(this.folder.path);
        const cancellable = this._cancellable;
        const isCancelled = error => error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);

        dir.enumerate_children_async(FILE_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT,
            cancellable, (_dir, result) => {
                let enumerator;
                try {
                    enumerator = dir.enumerate_children_finish(result);
                } catch (error) {
                    if (!isCancelled(error)) done([]);
                    return;
                }

                const entries = [];
                const finish = () => {
                    enumerator.close_async(GLib.PRIORITY_DEFAULT, null, null);
                    if (!cancellable.is_cancelled()) done(entries);
                };
                const readBatch = () => {
                    enumerator.next_files_async(ENUMERATE_BATCH, GLib.PRIORITY_DEFAULT, cancellable, (_enum, res) => {
                        let infos;
                        try {
                            infos = enumerator.next_files_finish(res);
                        } catch (error) {
                            if (isCancelled(error)) enumerator.close_async(GLib.PRIORITY_DEFAULT, null, null);
                            else finish();
                            return;
                        }
                        for (const info of infos) {
                            if (info.get_is_hidden() || info.get_is_backup()) continue;
                            entries.push({
                                name: info.get_name(),
                                time: info.get_attribute_uint64('time::modified'),
                                file: enumerator.get_child(info),
                                info,
                            });
                        }
                        if (infos.length === 0 || entries.length >= MAX_SCANNED) finish();
                        else readBatch();
                    });
                };
                readBatch();
            });
    }

    _build(entries) {
        if (this._isClosing || !isActorAlive(this.actor)) return;

        const items = selectFanEntries(entries, Settings.folderFanItems).map(({ file, info }) => {
            const isDirectory = info.get_file_type() === Gio.FileType.DIRECTORY;
            const preview = thumbnail({
                uri: file.get_uri(),
                gicon: info.get_icon(),
                contentType: info.get_content_type() || '',
                thumbnail: info.get_attribute_byte_string('thumbnail::path'),
                isDirectory,
            }, THUMB_SIZE, THUMB_SIZE, THUMB_RADIUS);
            return this._makeItem(info.get_display_name(), preview, () => this._launch(file.get_uri()));
        });

        if (items.length === 0) {
            const icon = new St.Icon({ icon_name: 'folder-symbolic', icon_size: Math.round(THUMB_SIZE * 0.6) });
            items.push(this._makeItem(_('This folder is empty'), icon, null));
        }
        items.push(this._makeItem(_('Open in Files'), this._fileManagerIcon(), () => this._openFolder()));

        this._place(items);
    }

    _fileManagerIcon() {
        const app = Shell.AppSystem.get_default().lookup_app(FILE_MANAGER_ID);
        if (app) return app.create_icon_texture(THUMB_SIZE);
        return new St.Icon({ icon_name: 'system-file-manager', icon_size: THUMB_SIZE });
    }

    _makeItem(text, preview, onActivate) {
        const label = new St.Label({ text, style_class: 'luma-fan-label', y_align: Clutter.ActorAlign.CENTER });
        label.clutter_text.set_ellipsize(Pango.EllipsizeMode.MIDDLE);

        const item = new St.BoxLayout({
            style_class: 'luma-fan-item',
            style: `spacing: ${LABEL_SPACING}px;`,
            width: ITEM_WIDTH,
            height: THUMB_SIZE,
            reactive: Boolean(onActivate),
            track_hover: Boolean(onActivate),
        });
        item.add_child(new St.Bin({ child: label, x_expand: true, x_align: Clutter.ActorAlign.END }));
        item.add_child(new St.Bin({
            child: preview,
            style_class: 'luma-fan-thumb',
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        // Rotate and grow around the picture, which is what sits on the arc.
        item.set_pivot_point((ITEM_WIDTH - THUMB_SIZE / 2) / ITEM_WIDTH, 0.5);

        if (onActivate) {
            item.connectObject(
                'button-press-event', () => Clutter.EVENT_STOP,
                'button-release-event', (_actor, event) => {
                    if (event.get_button() === Clutter.BUTTON_PRIMARY) onActivate();
                    return Clutter.EVENT_STOP;
                },
                this);
        }
        return item;
    }

    _place(actors) {
        if (!isActorAlive(this.buttonActor) || !isActorAlive(this.dockUI.bgActor)) {
            this.hide();
            return;
        }

        const edge = this.dockUI.dockPosition === 'TOP' ? 'TOP' : 'BOTTOM';
        const [buttonX] = this.buttonActor.get_transformed_position();
        const [buttonWidth] = this.buttonActor.get_transformed_size();
        const [, dockY] = this.dockUI.bgActor.get_transformed_position();
        const [, dockHeight] = this.dockUI.bgActor.get_transformed_size();
        const anchorX = buttonX + buttonWidth / 2;
        const anchorY = edge === 'TOP' ? dockY + dockHeight : dockY;

        const monitor = Main.layoutManager.findMonitorForActor(this.buttonActor) || Main.layoutManager.primaryMonitor;
        const shape = { count: actors.length, step: ITEM_STEP, gap: FIRST_GAP, edge };
        const outermost = computeFanLayout({ ...shape, direction: 1 })[actors.length - 1];
        const direction = chooseFanDirection({
            anchorX,
            maxShift: outermost ? outermost.dx : 0,
            rightMargin: THUMB_SIZE / 2 + EDGE_MARGIN,
            monitorX: monitor.x,
            monitorWidth: monitor.width,
        });
        const layout = computeFanLayout({ ...shape, direction });

        actors.forEach((actor, index) => {
            const offset = layout[index];
            this._fan.add_child(actor);
            actor.set_position(
                Math.round(anchorX + offset.dx - (ITEM_WIDTH - THUMB_SIZE / 2)),
                Math.round(anchorY + offset.dy - THUMB_SIZE / 2));
            actor.set({
                translation_x: -offset.dx,
                translation_y: -offset.dy,
                scale_x: START_SCALE,
                scale_y: START_SCALE,
                opacity: 0,
            });
            actor.ease({
                translation_x: 0,
                translation_y: 0,
                scale_x: 1,
                scale_y: 1,
                rotation_angle_z: offset.angle,
                opacity: 255,
                delay: index * OPEN_STAGGER,
                duration: OPEN_DURATION,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            });
            this._items.push({ actor, offset });
        });
    }

    _launch(uri) {
        try {
            Gio.AppInfo.launch_default_for_uri(uri, global.create_app_launch_context(0, -1));
        } catch (error) {
            console.warn(`Luma Dock: could not open ${uri}: ${error.message}`);
        }
        this.hide();
    }

    _openFolder() {
        this.hide();
        this._openInFiles();
    }
}
