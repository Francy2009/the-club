#!/bin/bash
# postrm script for The Club .deb package
# Removes user data directory after uninstall

set -e

# Remove app data directory (Tauri stores under ~/.local/share/com.the.club or ~/.config/com.the.club)
if [ -d "$HOME/.local/share/com.the.club" ]; then
    rm -rf "$HOME/.local/share/com.the.club"
fi

if [ -d "$HOME/.config/com.the.club" ]; then
    rm -rf "$HOME/.config/com.the.club"
fi

exit 0