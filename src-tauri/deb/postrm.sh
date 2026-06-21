#!/bin/bash
# postrm script for The Club .deb package
# Removes user data directory after uninstall

set -e

# During upgrades, dpkg calls postrm with "upgrade" — skip cleanup to preserve data.
# Only clean on full removal ("remove" or "purge").
if [ "$1" = "upgrade" ] || [ "$1" = "failed-upgrade" ]; then
    exit 0
fi

# Remove app data directory (Tauri stores under ~/.local/share/com.the.club or ~/.config/com.the.club)
if [ -d "$HOME/.local/share/com.the.club" ]; then
    rm -rf "$HOME/.local/share/com.the.club"
fi

if [ -d "$HOME/.config/com.the.club" ]; then
    rm -rf "$HOME/.config/com.the.club"
fi

exit 0