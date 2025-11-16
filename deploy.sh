#!/bin/sh

NAME=MaximizeWindowIntoNewWorkspace
UUID=MaximizeWindowIntoNewWorkspace@kyleross.com
rm -rf ~/.local/share/gnome-shell/extensions/$UUID
cp -r $NAME ~/.local/share/gnome-shell/extensions/$UUID
