#!/bin/bash
# Setup script for local Gemini CLI development

set -e

echo "🧹 Cleaning up old installations..."

# Remove old global installation (requires sudo)
if [ -f /usr/local/bin/gemini ]; then
    echo "Removing old /usr/local/bin/gemini..."
    sudo rm -f /usr/local/bin/gemini
fi

if [ -d /usr/local/lib/node_modules/@google/gemini-cli ]; then
    echo "Removing old /usr/local/lib/node_modules/@google/gemini-cli..."
    sudo rm -rf /usr/local/lib/node_modules/@google/gemini-cli
fi

# Uninstall any npm global installations
echo "Checking for npm global installations..."
npm uninstall -g @google/gemini-cli 2>/dev/null || true
npm uninstall -g gemini-cli 2>/dev/null || true

echo ""
echo "✅ Old installations removed"
echo ""

# Build the project
echo "🔨 Building project..."
npm run build

echo ""
echo "🔗 Creating global symlink..."

# Link the local package globally
npm link

echo ""
echo "✅ Local development setup complete!"
echo ""
echo "Test it:"
echo "  gemini --version"
echo "  which gemini"
echo ""
echo "Your local build is now globally available as 'gemini'"
