#!/usr/bin/env bash
# Checks which YouTube URLs are forced to a browser and which may open in the
# YouTube app. Needs only a JDK -- no Android SDK, no device.
#
#   ./tools/routing-check/run.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

javac -nowarn -d "$out" \
  $(find "$here/stubs" -name '*.java') \
  "$root/android/app/src/main/java/app/narrowcast/focus/ExternalLinks.java" \
  "$here/RoutingTest.java"

java -cp "$out" RoutingTest
