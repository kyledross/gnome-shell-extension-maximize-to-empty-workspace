# Gnome Shell Extension Maximized Into Empty Workspace (Gnome 49+)

This is a fork of [balintbarna's version](https://github.com/balintbarna/gnome-shell-extension-maximize-to-empty-workspace), updated to support Gnome 49+.

New and maximized windows will be moved to empty workspaces. Supports multiple monitors.

## Changes in this fork

- Fixed `win.get_maximized()` API calls that were removed in Gnome 49
- Updated to use `win.maximized_horizontally` and `win.maximized_vertically` properties
- Changed extension UUID to avoid conflicts with the original

Maximize To Empty Workspace is based on [Maximize To Workspace With History](https://github.com/raonetwo/MaximizeToWorkspace)

