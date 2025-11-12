#!/bin/sh

NAME=MaximizeToEmptyWorkspace-gnome49@kyleross.com
rm -rf ~/.local/share/gnome-shell/extensions/$NAME
cp -r $NAME ~/.local/share/gnome-shell/extensions/.
