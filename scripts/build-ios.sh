#!/bin/bash
# ── TravelUNU iOS Release Build & Upload Script ──
# Usage: ./scripts/build-ios.sh [--bump]
#   --bump: auto-increment build number

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$PROJECT_DIR/ios/App"
PBXPROJ="$IOS_DIR/App.xcodeproj/project.pbxproj"
ARCHIVE_PATH="$PROJECT_DIR/ios/build/TravelUNU.xcarchive"
EXPORT_PATH="$PROJECT_DIR/ios/build/export"
EXPORT_PLIST="$PROJECT_DIR/ios/ExportOptions.plist"

# Signing
CODE_SIGN_IDENTITY="Apple Distribution: Sungbin Hwang (6J8GJJRZN5)"
PROVISIONING_PROFILE="3ae73ce0-dc1e-4158-a2e2-f5b55216a4d0"
TEAM_ID="6J8GJJRZN5"

# App Store Connect API
API_KEY="97TCQF833U"
API_ISSUER="3ed3ac26-b1bd-4732-b0e6-c5e1d176a747"

echo "═══════════════════════════════════════"
echo "  TravelUNU iOS Release Build"
echo "═══════════════════════════════════════"

# ── Step 0: Auto-increment build number ──
if [[ "$1" == "--bump" ]]; then
  CURRENT_BUILD=$(grep 'CURRENT_PROJECT_VERSION' "$PBXPROJ" | head -1 | awk '{print $3}' | tr -d ';')
  NEW_BUILD=$((CURRENT_BUILD + 1))
  sed -i '' "s/CURRENT_PROJECT_VERSION = $CURRENT_BUILD;/CURRENT_PROJECT_VERSION = $NEW_BUILD;/g" "$PBXPROJ"
  echo "✓ Build number: $CURRENT_BUILD → $NEW_BUILD"
else
  CURRENT_BUILD=$(grep 'CURRENT_PROJECT_VERSION' "$PBXPROJ" | head -1 | awk '{print $3}' | tr -d ';')
  echo "ℹ Build number: $CURRENT_BUILD (use --bump to auto-increment)"
fi

# ── Step 1: Vite build ──
echo ""
echo "▶ Step 1/5: Vite build..."
cd "$PROJECT_DIR"
npx vite build 2>&1 | tail -3
echo "✓ Vite build complete"

# ── Step 2: Capacitor sync ──
echo ""
echo "▶ Step 2/5: Capacitor sync..."
npx cap sync ios 2>&1 | tail -3
echo "✓ Capacitor sync complete"

# ── Step 3: Archive ──
echo ""
echo "▶ Step 3/5: Xcode archive..."
xcodebuild -project "$IOS_DIR/App.xcodeproj" \
  -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="$CODE_SIGN_IDENTITY" \
  PROVISIONING_PROFILE="$PROVISIONING_PROFILE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  archive 2>&1 | tail -3
echo "✓ Archive complete"

# ── Step 4: Export IPA ──
echo ""
echo "▶ Step 4/5: Export IPA..."
rm -rf "$EXPORT_PATH"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST" 2>&1 | tail -3
echo "✓ Export complete"

# ── Step 5: Upload to App Store Connect ──
echo ""
echo "▶ Step 5/5: Upload to App Store Connect..."
xcrun altool --upload-app \
  -f "$EXPORT_PATH/App.ipa" \
  -t ios \
  --apiKey "$API_KEY" \
  --apiIssuer "$API_ISSUER" 2>&1
echo ""

IPA_SIZE=$(du -h "$EXPORT_PATH/App.ipa" | awk '{print $1}')
echo "═══════════════════════════════════════"
echo "  ✓ Build & Upload complete!"
echo "  IPA: $EXPORT_PATH/App.ipa"
echo "  Size: $IPA_SIZE"
echo "═══════════════════════════════════════"
