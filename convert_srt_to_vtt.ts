#!/usr/bin/env bun
/**
 * Simple SRT → VTT converter
 */

import { Glob } from "bun";
import { mkdir } from "node:fs/promises";

function stripBOM(input: string): string {
  return input.replace(/^\uFEFF/, "");
}

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n?|\n/g, "\n");
}

function isTimeRange(line: string): boolean {
  // Examples:
  // 00:00:20,000 --> 00:00:24,400
  // 00:00:20.000 --> 00:00:24.400  position:0%,line:90%
  return /\d{2}:\d{2}:\d{2}[\.,]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[\.,]\d{3}/.test(
    line
  );
}

/** Core conversion: SRT string → VTT string */
function convertSrtToVtt(srt: string): string {
  let text = stripBOM(normalizeNewlines(srt)).trim();

  const lines = text.split("\n");
  const out: string[] = ["WEBVTT", ""]; // header + blank line

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If this line is just an index (digits only) and the next one is a time range, skip it.
    if (
      /^\d+$/.test(line) &&
      i + 1 < lines.length &&
      isTimeRange(lines[i + 1])
    ) {
      continue;
    }

    if (isTimeRange(line)) {
      // Replace comma milliseconds with dot for WebVTT compliance
      out.push(line.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2"));
      continue;
    }

    // Preserve cue text (basic HTML like <i>, <b>, <u> is fine for VTT)
    out.push(line);
  }

  // Ensure trailing newline
  return out.join("\n").replace(/\n?$/, "\n");
}

async function convertSrtToVttFile(input: string, output: string) {
  try {
    const srtText = await Bun.file(input).text();
    const vttText = convertSrtToVtt(srtText);
    await Bun.write(output, vttText);
  } catch (err) {
    console.error(`Failed: ${(err as Error)?.message || String(err)}`);
  }
}

async function main() {
  // go through all files in srt folder, in both en and jp subfolders
  // convert each file in those folders from srt to vtt
  // save them to a newly created folder if needed called vtt with the same structure as the srt folder - en and jp subfolders

  // Use script location as base for resolving paths.
  const srtDirs = ["en", "jp"];
  const inputRoot = new URL("./srt/", import.meta.url);
  const outputRoot = new URL("./vtt/", import.meta.url);

  let count = 0;
  for (const lang of srtDirs) {
    const inDir = new URL(`./${lang}/`, inputRoot);
    const outDir = new URL(`./${lang}/`, outputRoot);

    // Ensure output directory exists
    await mkdir(outDir.pathname, { recursive: true });

    // Collect all .srt files using Bun's Glob
    const glob = new Glob("*.srt");
    for await (const file of glob.scan(inDir.pathname)) {
      const inputPath = new URL(`./${file}`, inDir);
      const vttFile = file.replace(/\.srt$/i, ".vtt");
      const outputPath = new URL(`./${vttFile}`, outDir);
      await convertSrtToVttFile(inputPath.pathname, outputPath.pathname);
      count++;
    }
  }
  console.log(`Converted ${count} .srt files to .vtt`);
}

main();
