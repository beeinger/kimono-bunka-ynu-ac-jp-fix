bun run convert_srt_to_vtt.ts
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
zip -r kimono-bunka-ynu-fix-${VERSION}.zip manifest.json content-script.js icons/ PRIVACY_POLICY.md vtt/
