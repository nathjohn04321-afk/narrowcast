#!/usr/bin/env bash
# Creates the signing key for Narrowcast release builds.
#
# Run this on a machine you keep. The key is not in this repository and cannot be
# regenerated: Android identifies an app by package id AND signature, so an update
# signed with a different key is refused as a different app. Losing this file means
# uninstalling and losing saved focuses to move to a new build.
set -euo pipefail

OUT="${1:-$HOME/narrowcast-signing/narrowcast.keystore}"
ALIAS="${NARROWCAST_KEY_ALIAS:-narrowcast}"

mkdir -p "$(dirname "$OUT")"

if [ -e "$OUT" ]; then
  echo "Refusing to overwrite an existing keystore at $OUT" >&2
  exit 1
fi

keytool -genkeypair -v \
  -keystore "$OUT" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

chmod 600 "$OUT"

cat <<EOF

Keystore written to: $OUT
Alias:               $ALIAS

Next, either create android/keystore.properties from
android/keystore.properties.example pointing storeFile at the path above, or
export these before building:

  export NARROWCAST_KEYSTORE="$OUT"
  export NARROWCAST_KEYSTORE_PASSWORD='the password you just typed'
  export NARROWCAST_KEY_ALIAS="$ALIAS"

Back this file up somewhere you will still have in five years. There is no
recovery path if it is lost.
EOF
