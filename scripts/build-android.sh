#!/bin/bash
# ── TravelUNU Android Release Build Script ──
# Usage: ./scripts/build-android.sh [--bump]
#   --bump: auto-increment versionCode

set -e

ANDROID_DIR="$(cd "$(dirname "$0")/../android" && pwd)"
BUILD_GRADLE="$ANDROID_DIR/app/build.gradle"
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export JAVA_HOME

echo "═══════════════════════════════════════"
echo "  TravelUNU Android Release Build"
echo "═══════════════════════════════════════"

# ── Step 0: Auto-increment versionCode ──
if [[ "$1" == "--bump" ]]; then
  CURRENT_CODE=$(grep 'versionCode' "$BUILD_GRADLE" | awk '{print $2}')
  NEW_CODE=$((CURRENT_CODE + 1))
  sed -i '' "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" "$BUILD_GRADLE"
  echo "✓ versionCode: $CURRENT_CODE → $NEW_CODE"
else
  CURRENT_CODE=$(grep 'versionCode' "$BUILD_GRADLE" | awk '{print $2}')
  echo "ℹ versionCode: $CURRENT_CODE (use --bump to auto-increment)"
fi

# ── Step 1: Vite build ──
echo ""
echo "▶ Step 1/3: Vite build..."
npx vite build 2>&1 | tail -3
echo "✓ Vite build complete"

# ── Step 2: Capacitor sync ──
echo ""
echo "▶ Step 2/3: Capacitor sync..."
npx cap sync android 2>&1 | tail -3
echo "✓ Capacitor sync complete"

# ── Step 3: Gradle bundleRelease ──
echo ""
echo "▶ Step 3/3: Gradle bundleRelease..."
cd "$ANDROID_DIR"
./gradlew bundleRelease 2>&1 | tail -5

AAB_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB_PATH" ]; then
  SIZE=$(du -h "$AAB_PATH" | awk '{print $1}')
  echo ""
  echo "═══════════════════════════════════════"
  echo "  ✓ Build successful!"
  echo "  File: $AAB_PATH"
  echo "  Size: $SIZE"
  echo "═══════════════════════════════════════"
  echo ""
  echo "→ Play Console에 업로드하세요"
else
  echo "✗ Build failed - AAB not found"
  exit 1
fi
