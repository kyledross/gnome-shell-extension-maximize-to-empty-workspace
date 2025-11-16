#!/bin/sh

NAME=MaximizeWindowIntoNewWorkspace
rm -rf ~/.local/share/gnome-shell/extensions/$NAME
cp -r $NAME ~/.local/share/gnome-shell/extensions/.
