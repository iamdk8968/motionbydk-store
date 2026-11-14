#!/usr/bin/env bash

# MotionByDk AEworkflow - macOS Installer
# Compatible with macOS Intel & Apple Silicon (M1/M2/M3/M4)

set -e

echo "========================================================================="
echo "                 MOTIONBYDK AEWORKFLOW INSTALLER (macOS)                 "
echo "========================================================================="
echo ""

# 1. Enable PlayerDebugMode for all CSXS versions
echo "[1/3] Enabling PlayerDebugMode for Adobe CSXS versions..."
for v in 9 10 11 12 13 14 15 16 17; do
    defaults write "com.adobe.CSXS.${v}" PlayerDebugMode 1 2>/dev/null || true
    echo "  [+] Enabled com.adobe.CSXS.${v} PlayerDebugMode"
done
echo ""

# 2. Setup CEP extensions directory
CEP_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
TARGET_DIR="${CEP_DIR}/MotionByDk AE Workflow"

echo "[2/3] Preparing Adobe CEP extensions directory..."
echo "  Target: ${TARGET_DIR}"
mkdir -p "${CEP_DIR}"

# 3. Clean and Copy ONLY Core Extension Files
echo ""
echo "[3/3] Installing core extension components (CSXS, client, host, .debug)..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If TARGET_DIR is a symlink or existing directory, remove it cleanly first
if [ -L "${TARGET_DIR}" ] || [ -d "${TARGET_DIR}" ]; then
    rm -rf "${TARGET_DIR}"
fi
mkdir -p "${TARGET_DIR}"

# Copy only main extension folders and files
cp -R "${SCRIPT_DIR}/CSXS" "${TARGET_DIR}/"
echo "  [+] Copied CSXS directory"

cp -R "${SCRIPT_DIR}/client" "${TARGET_DIR}/"
echo "  [+] Copied client directory"

cp -R "${SCRIPT_DIR}/host" "${TARGET_DIR}/"
echo "  [+] Copied host directory"

if [ -f "${SCRIPT_DIR}/.debug" ]; then
    cp "${SCRIPT_DIR}/.debug" "${TARGET_DIR}/"
    echo "  [+] Copied .debug file"
fi

# 4. Install Liquid Glass Plugin (if extra_plugins/Mac exists)
if [ -d "${SCRIPT_DIR}/extra_plugins/Mac/ToolsForMotion" ]; then
    echo ""
    echo "[4/4] Installing Liquid Glass native plugin..."
    for ae_dir in /Applications/Adobe\ After\ Effects\ *; do
        if [ -d "${ae_dir}/Plug-ins" ]; then
            echo "  [+] Installing to: ${ae_dir}/Plug-ins/ToolsForMotion"
            mkdir -p "${ae_dir}/Plug-ins/ToolsForMotion" 2>/dev/null || true
            cp -R "${SCRIPT_DIR}/extra_plugins/Mac/ToolsForMotion/LiquidGlass.plugin" "${ae_dir}/Plug-ins/ToolsForMotion/" 2>/dev/null || true
            xattr -dr com.apple.quarantine "${ae_dir}/Plug-ins/ToolsForMotion/LiquidGlass.plugin" 2>/dev/null || true
        fi
    done
fi

# Clean any residual junk like .DS_Store from target
find "${TARGET_DIR}" -name ".DS_Store" -delete 2>/dev/null || true

echo ""
echo "========================================================================="
echo "                        INSTALLATION COMPLETED!                          "
echo "========================================================================="
echo ""
echo "Installed cleanly into Adobe CEP extensions folder."
echo "(Only main extension folders/files installed; docs and scripts excluded)."
echo ""
echo "IMPORTANT NEXT STEPS:"
echo "  1. Restart Adobe After Effects."
echo "  2. Go to: After Effects > Settings/Preferences > Scripting & Expressions"
echo "  3. CHECK: [✔] 'Allow Scripts to Write Files and Access Network'"
echo "  4. Open: Window > Extensions > MotionByDk AEworkflow"
echo ""
echo "For any help or queries: motionbydk@gmail.com"
echo "Enjoy your motion design workflow!"
echo "========================================================================="
echo ""
