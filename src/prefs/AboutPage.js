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
*
* Luma Dock is a fork of Dhruva. Modified in 2026 by viniciusbispo19:
* the About page was rewritten to credit the original project.
*/


import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


const FORK_REPO = 'viniciusbispo19/luma-dock';
const ORIGINAL_REPO = 'NarkAgni/dhruva';


export function buildAboutPage(prefs, window) {
    const page = new Adw.PreferencesPage({
        title: _('About'),
        icon_name: 'help-about-symbolic'
    });
    window.add(page);

    buildAboutHero(prefs, page);
    buildAboutLinks(page, window);
    buildAboutAuthor(prefs, page);
}

function buildAboutHero(prefs, page) {
    const group = new Adw.PreferencesGroup();
    page.add(group);

    const heroBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
        halign: Gtk.Align.CENTER,
        margin_top: 24,
        margin_bottom: 12
    });

    const logo = Gtk.Image.new_from_file(`${prefs.path}/icons/logo.png`);
    logo.set_pixel_size(128);
    heroBox.append(logo);

    heroBox.append(new Gtk.Label({
        label: '<span size="xx-large" weight="bold">Luma Dock</span>',
        use_markup: true,
        margin_top: 8
    }));
    heroBox.append(new Gtk.Label({
        label: _('A beautifully crafted, highly customisable dock for GNOME Shell'),
        css_classes: ['dim-label'],
        margin_bottom: 4
    }));
    heroBox.append(new Gtk.Label({
        label: `${_('Version')} ${prefs.metadata['version-name']}  •  GPL-3.0`,
        css_classes: ['dim-label', 'caption']
    }));

    const row = new Adw.ActionRow();
    row.set_child(heroBox);
    group.add(row);
}

function buildAboutLinks(page, window) {
    const group = new Adw.PreferencesGroup({
        title: _('Links')
    });
    page.add(group);

    const addLink = (title, repo, icon) => {
        const row = new Adw.ActionRow({
            title,
            subtitle: `github.com/${repo}`,
            icon_name: icon,
            activatable: true
        });
        row.add_suffix(new Gtk.Image({
            icon_name: 'adw-external-link-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['dim-label']
        }));

        row.connect('activated', () => {
            Gio.AppInfo.launch_default_for_uri(
                `https://github.com/${repo}`,
                window.get_display().get_app_launch_context());
        });
        group.add(row);
    };

    addLink(_('GitHub Repository'), FORK_REPO, 'system-software-install-symbolic');
    addLink(_('Original Project'), ORIGINAL_REPO, 'emblem-shared-symbolic');
}

function buildAboutAuthor(prefs, page) {
    const group = new Adw.PreferencesGroup({
        title: _('Credits')
    });
    page.add(group);

    group.add(new Adw.ActionRow({
        title: 'viniciusbispo19',
        subtitle: _('Luma Dock Maintainer'),
        icon_name: 'avatar-default-symbolic'
    }));

    group.add(new Adw.ActionRow({
        title: 'NarkAgni',
        subtitle: _('Author of Dhruva, the original project'),
        icon_name: 'avatar-default-symbolic'
    }));

    group.add(new Adw.ActionRow({
        title: _('Features'),
        subtitle: _('Per-app running indicators · Hover zoom magnification · Window minimize effects (Magic Lamp, Snake, Vortex &amp; more) · Icon click animations (Bounce, Jelly, Heartbeat &amp; 20+ styles) · Intelligent auto-hide with edge pressure reveal · Chameleon theme (wallpaper colour matching) · Full-width dock mode · Multi-monitor support · Custom folders, Trash, Desktop button &amp; App Grid · Workspace isolation · Aero Peek window previews · Lock icons to prevent accidental reorder'),
        icon_name: 'starred-symbolic'
    }));

    group.add(new Adw.ActionRow({
        title: _('Disclaimer'),
        subtitle: _('Luma Dock is an independent fork of Dhruva, released under the GPL-3.0 license, and is not an official release of the original project.'),
        icon_name: 'dialog-information-symbolic'
    }));
}
