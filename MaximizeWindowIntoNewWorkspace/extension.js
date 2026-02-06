/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const _windowidsMaximized = {};
const _windowidsSizeChange = {};
const _windowidsPendingStartup = {};
const _windowidsPendingOverview = {};
const _windowidsPendingStability = {};
let _startupComplete = false;

export default class Extension {
    // First free workspace on the specified monitor
    getFirstFreeMonitor(manager, mMonitor) {
        const n = manager.get_n_workspaces();
        for (let i = 0; i < n; i++) {
            const winCount = manager.get_workspace_by_index(i).list_windows().filter(w => !w.is_always_on_all_workspaces() && w.get_monitor() === mMonitor).length;
            if (winCount < 1)
                return i;
        }
        return -1;
    }

    // last occupied workspace on the specified monitor
    getLastOcupiedMonitor(manager, nCurrent, mMonitor) {
        for (let i = nCurrent - 1; i >= 0; i--) {
            const winCount = manager.get_workspace_by_index(i).list_windows().filter(w => !w.is_always_on_all_workspaces() && w.get_monitor() === mMonitor).length;
            if (winCount > 0)
                return i;
        }
        const n = manager.get_n_workspaces();
        for (let i = nCurrent + 1; i < n; i++) {
            const winCount = manager.get_workspace_by_index(i).list_windows().filter(w => !w.is_always_on_all_workspaces() && w.get_monitor() === mMonitor).length;
            if (winCount > 0)
                return i;
        }
        return -1;
    }

    placeOnWorkspace(win) {
        // Don't reorder workspaces if overview is visible (prevents triggering overview at login)
        if (Main.overview.visible) {
            _windowidsPendingOverview[win.get_id()] = win;
            return;
        }
        // Filter out transient/hidden windows
        if (win.skip_taskbar || !win.showing_on_its_workspace() || win.get_transient_for())
            return;
        // bMap true - new windows to end of workspaces
        const bMap = false;

        // Idea: don't move the coresponding window to an other workspace (it may be not fully active yet)
        // Reorder the workspaces and move all other window

        const mMonitor = win.get_monitor();
        const wList = win.get_workspace().list_windows().filter(w => w !== win && !w.is_always_on_all_workspaces() && w.get_monitor() === mMonitor);
        if (wList.length >= 1) {
            const manager = win.get_display().get_workspace_manager();
            const current = manager.get_active_workspace_index();
            if (this._mutterSettings.get_boolean('workspaces-only-on-primary')) {
                const mPrimary = win.get_display().get_primary_monitor();
                // Only primary monitor is relevant, others don't have multiple workspaces
                if (mMonitor !== mPrimary)
                    return;
                const firstfree = this.getFirstFreeMonitor(manager, mMonitor);
                // No free monitor: do nothing
                if (firstfree === -1)
                    return;
                if (current < firstfree) {
                    if (bMap) {
                        // show new window on next free monitor (last on dynamic workspaces)
                        manager.reorder_workspace(manager.get_workspace_by_index(firstfree), current);
                        manager.reorder_workspace(manager.get_workspace_by_index(current + 1), firstfree);
                        // move the other windows to their old places
                        wList.forEach(w => {
                            w.change_workspace_by_index(current, false);
                        });
                    } else {
                        // insert existing window on next monitor (each other workspace is moved one index further)
                        manager.reorder_workspace(manager.get_workspace_by_index(firstfree), current);
                        // move the other windows to their old places
                        wList.forEach(w => {
                            w.change_workspace_by_index(current, false);
                        });
                    }
                    // remember reordered window
                    _windowidsMaximized[win.get_id()] = 'reorder';
                } else if (current > firstfree) {
                    // show window on next free monitor (doesn't happen with dynamic workspaces)
                    manager.reorder_workspace(manager.get_workspace_by_index(current), firstfree);
                    manager.reorder_workspace(manager.get_workspace_by_index(firstfree + 1), current);
                    // move the other windows to their old places
                    wList.forEach(w => {
                        w.change_workspace_by_index(current, false);
                    });
                    // remember reordered window
                    _windowidsMaximized[win.get_id()] = 'reorder';
                }
            } else {
                // All monitors have workspaces
                // search the workspaces for a free monitor on the same index
                const firstfree = this.getFirstFreeMonitor(manager, mMonitor);
                // No free monitor: do nothing
                if (firstfree === -1)
                    return;
                // show the window on the workspace with the empty monitor
                const wListcurrent = win.get_workspace().list_windows().filter(w => w !== win && !w.is_always_on_all_workspaces());
                const wListfirstfree = manager.get_workspace_by_index(firstfree).list_windows().filter(w => w !== win && !w.is_always_on_all_workspaces());
                if (current < firstfree) {
                    manager.reorder_workspace(manager.get_workspace_by_index(firstfree), current);
                    manager.reorder_workspace(manager.get_workspace_by_index(current + 1), firstfree);
                    // move the other windows to their old places
                    wListcurrent.forEach(w => {
                        w.change_workspace_by_index(current, false);
                    });
                    wListfirstfree.forEach(w => {
                        w.change_workspace_by_index(firstfree, false);
                    });
                    // remember reordered window
                    _windowidsMaximized[win.get_id()] = 'reorder';
                } else if (current > firstfree) {
                    manager.reorder_workspace(manager.get_workspace_by_index(current), firstfree);
                    manager.reorder_workspace(manager.get_workspace_by_index(firstfree + 1), current);
                    // move the other windows to their old places
                    wListcurrent.forEach(w => {
                        w.change_workspace_by_index(current, false);
                    });
                    wListfirstfree.forEach(w => {
                        w.change_workspace_by_index(firstfree, false);
                    });
                    // remember reordered window
                    _windowidsMaximized[win.get_id()] = 'reorder';
                }
            }
        }
    }

    // back to last workspace
    backto(win) {
        if (!_startupComplete)
            return;

        // Idea: don't move the coresponding window to an other workspace (it may be not fully active yet)
        // Reorder the workspaces and move all other window

        if (!(win.get_id() in _windowidsMaximized)) {
            // no new screen is used in the past: do nothing
            return;
        }

        // this is not longer maximized
        delete _windowidsMaximized[win.get_id()];


        const mMonitor = win.get_monitor();
        const wList = win.get_workspace().list_windows().filter(w => w !== win && !w.is_always_on_all_workspaces() && w.get_monitor() === mMonitor);
        if (wList.length === 0) {
            const manager = win.get_display().get_workspace_manager();
            const current = manager.get_active_workspace_index();
            if (this._mutterSettings.get_boolean('workspaces-only-on-primary')) {
                const mPrimary = win.get_display().get_primary_monitor();
                // Only primary monitor is relevant, others don't have multiple workspaces
                if (mMonitor !== mPrimary)
                    return;
                const lastocupied = this.getLastOcupiedMonitor(manager, current, mMonitor);
                // No occupied monitor: do nothing
                if (lastocupied === -1)
                    return;
                const wListlastoccupied = manager.get_workspace_by_index(lastocupied).list_windows().filter(w => w !== win && !w.is_always_on_all_workspaces() && w.get_monitor() === mMonitor);
                // switch workspace position to last with windows and move all windows there
                manager.reorder_workspace(manager.get_workspace_by_index(current), lastocupied);
                wListlastoccupied.forEach(w => {
                    w.change_workspace_by_index(lastocupied, false);
                });
            } else {
                const lastocupied = this.getLastOcupiedMonitor(manager, current, mMonitor);
                // No occupied monitor: do nothing
                if (lastocupied === -1)
                    return;
                const wListcurrent = win.get_workspace().list_windows().filter(w => w !== win && !w.is_always_on_all_workspaces());
                if (wListcurrent.length > 0)
                    return;
                const wListlastoccupied = manager.get_workspace_by_index(lastocupied).list_windows().filter(w => w !== win && !w.is_always_on_all_workspaces());
                // switch workspace position to last with windows and move all windows there
                manager.reorder_workspace(manager.get_workspace_by_index(current), lastocupied);
                wListlastoccupied.forEach(w => {
                    w.change_workspace_by_index(lastocupied, false);
                });
            }
        }
    }

    window_manager_map(act) {
        const win = act.meta_window;
        if (win.window_type !== Meta.WindowType.NORMAL)
            return;
        const isMaximized = win.maximized_horizontally && win.maximized_vertically;
        if (!isMaximized)
            return;
        if (win.is_always_on_all_workspaces())
            return;
        // Filter out transient/hidden windows immediately
        if (win.skip_taskbar || win.get_transient_for())
            return;
        if (!_startupComplete) {
            _windowidsPendingStartup[win.get_id()] = win;
            return;
        }
        // Add stability delay to filter out short-lived windows
        _windowidsPendingStability[win.get_id()] = setTimeout(() => {
            delete _windowidsPendingStability[win.get_id()];
            // Verify window is still valid, maximized, visible, and not transient
            if (win && !win.is_always_on_all_workspaces()) {
                const stillMaximized = win.maximized_horizontally && win.maximized_vertically;
                if (stillMaximized && win.showing_on_its_workspace() && !win.skip_taskbar && !win.get_transient_for())
                    this.placeOnWorkspace(win);
            }
        }, 500);
    }

    window_manager_destroy(act) {
        const win = act.meta_window;
        if (win.window_type !== Meta.WindowType.NORMAL)
            return;
        this.backto(win);
    }

    window_manager_size_change(act, change, rectold) {
        const win = act.meta_window;
        if (win.window_type !== Meta.WindowType.NORMAL)
            return;
        if (!_startupComplete)
            return;
        if (win.is_always_on_all_workspaces())
            return;
        if (change === Meta.SizeChange.MAXIMIZE) {
            const isMaximized = win.maximized_horizontally && win.maximized_vertically;
            if (isMaximized)
                _windowidsSizeChange[win.get_id()] = 'place';
        } else if (change  === Meta.SizeChange.FULLSCREEN) {
            _windowidsSizeChange[win.get_id()] = 'place';
        } else if (change === Meta.SizeChange.UNMAXIMIZE) {
            // do nothing if it was only partially maximized
            const rectmax = win.get_work_area_for_monitor(win.get_monitor());
            if (rectmax.equal(rectold))
                _windowidsSizeChange[win.get_id()] = 'back';
        } else if (change === Meta.SizeChange.UNFULLSCREEN) {
            const isMaximized = win.maximized_horizontally && win.maximized_vertically;
            if (!isMaximized)
                _windowidsSizeChange[win.get_id()] = 'back';
        }
    }

    window_manager_minimize(act) {
        const win = act.meta_window;
        if (win.window_type !== Meta.WindowType.NORMAL)
            return;
        if (win.is_always_on_all_workspaces())
            return;
        this.backto(win);
    }

    window_manager_unminimize(act) {
        const win = act.meta_window;
        if (win.window_type !== Meta.WindowType.NORMAL)
            return;
        if (!_startupComplete)
            return;
        const isMaximized = win.maximized_horizontally && win.maximized_vertically;
        if (!isMaximized)
            return;
        if (win.is_always_on_all_workspaces())
            return;
        // Filter out transient/hidden windows
        if (win.skip_taskbar || win.get_transient_for())
            return;
        this.placeOnWorkspace(win);
    }

    window_manager_size_changed(act) {
        const win = act.meta_window;
        const action = _windowidsSizeChange[win.get_id()];
        if (action) {
            if (action === 'place') {
                // Filter out transient/hidden windows
                if (!win.skip_taskbar && !win.get_transient_for())
                    this.placeOnWorkspace(win);
            } else if (action === 'back') {
                this.backto(win);
            }

            delete _windowidsSizeChange[win.get_id()];
        }
    }

    window_manager_switch_workspace() {
    }

    enable() {
        this._mutterSettings = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        _startupComplete = false;
        // Delay extension activation to prevent workspace reordering during session startup
        this._startupTimeoutId = setTimeout(() => {
            _startupComplete = true;
            this._startupTimeoutId = null;
            // Process any windows that arrived during startup
            for (const winId in _windowidsPendingStartup) {
                const win = _windowidsPendingStartup[winId];
                if (win && !win.is_always_on_all_workspaces()) {
                    const isMaximized = win.maximized_horizontally && win.maximized_vertically;
                    // Filter out transient/hidden windows
                    if (isMaximized && win.showing_on_its_workspace() && !win.skip_taskbar && !win.get_transient_for())
                        this.placeOnWorkspace(win);
                }
            }
            // Clear the pending list
            for (const winId in _windowidsPendingStartup)
                delete _windowidsPendingStartup[winId];
        }, 10000);
        // Listen for overview hidden to process pending windows
        Main.overview.connectObject('hidden', () => {
            for (const winId in _windowidsPendingOverview) {
                const win = _windowidsPendingOverview[winId];
                if (win && !win.is_always_on_all_workspaces()) {
                    const isMaximized = win.maximized_horizontally && win.maximized_vertically;
                    // Filter out transient/hidden windows
                    if (isMaximized && win.showing_on_its_workspace() && !win.skip_taskbar && !win.get_transient_for())
                        this.placeOnWorkspace(win);
                }
            }
            // Clear the pending list
            for (const winId in _windowidsPendingOverview)
                delete _windowidsPendingOverview[winId];
        }, this);
        // Trigger new window with maximize size and if the window is maximized
        global.window_manager.connectObject(
            'minimize', (_, act) => {
                this.window_manager_minimize(act);
            },
            'unminimize', (_, act) => {
                this.window_manager_unminimize(act);
            },
            'size-changed', (_, act) => {
                this.window_manager_size_changed(act);
            },
            'switch-workspace', _ => {
                this.window_manager_switch_workspace();
            },
            'map', (_, act) => {
                this.window_manager_map(act);
            },
            'destroy', (_, act) => {
                this.window_manager_destroy(act);
            },
            'size-change', (_, act, change, rectold) => {
                this.window_manager_size_change(act, change, rectold);
            },
            this
        );
    }

    disable() {
        if (this._startupTimeoutId) {
            clearTimeout(this._startupTimeoutId);
            this._startupTimeoutId = null;
        }

        // Clear any pending stability timeouts
        for (const winId in _windowidsPendingStability) {
            clearTimeout(_windowidsPendingStability[winId]);
            delete _windowidsPendingStability[winId];
        }

        Main.overview.disconnectObject(this);
        global.window_manager.disconnectObject(this);

        _startupComplete = false;
        this._mutterSettings = null;
    }
}
