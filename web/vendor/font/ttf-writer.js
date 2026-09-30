(function (global) {
  "use strict";

  const { PIXEL_UNITS, PUA_START, PUA_END } = global.NdsFontConstants;
  const { cp } = global.NdsFontParser;
  const textEncoder = new TextEncoder();

  function ascii(s) {
    return Array.from(s, (ch) => ch.charCodeAt(0) & 0xFF);
  }

  function p16(v) {
    v &= 0xFFFF;
    return [(v >>> 8) & 0xFF, v & 0xFF];
  }

  function pS16(v) {
    if (v < 0) {
      v += 0x10000;
    }
    return p16(v);
  }

  function p32(v) {
    v >>>= 0;
    return [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF];
  }

  function pS32(v) {
    if (v < 0) {
      v += 0x100000000;
    }
    return p32(v);
  }

  function fixed(v) {
    return pS32(Math.round(v * 65536));
  }

  function concatParts(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  function bytes(parts) {
    return concatParts(parts.map((part) => part instanceof Uint8Array ? part : Uint8Array.from(part)));
  }

  function pad4(data) {
    data = data instanceof Uint8Array ? data : Uint8Array.from(data);
    const extra = (4 - (data.length % 4)) % 4;
    if (extra === 0) {
      return data;
    }
    const out = new Uint8Array(data.length + extra);
    out.set(data);
    return out;
  }

  function checksum(data) {
    data = pad4(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const part = ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0;
      sum = (sum + part) >>> 0;
    }
    return sum >>> 0;
  }

  function buildGlyphData(rows, pixelUnits) {
    const height = rows.length;
    const width = height > 0 ? rows[0].length : 0;
    const contours = [];
    let xMin = width * pixelUnits;
    let yMin = height * pixelUnits;
    let xMax = 0;
    let yMax = 0;

    for (let y = 0; y < rows.length; y++) {
      const line = rows[y];
      let x = 0;
      while (x < line.length) {
        while (x < line.length && line[x] !== "#") {
          x++;
        }
        if (x >= line.length) {
          break;
        }
        const start = x;
        while (x < line.length && line[x] === "#") {
          x++;
        }
        const end = x;
        const x0 = start * pixelUnits;
        const x1 = end * pixelUnits;
        const y0 = (height - y - 1) * pixelUnits;
        const y1 = (height - y) * pixelUnits;
        contours.push([[x0, y0], [x0, y1], [x1, y1], [x1, y0]]);
        xMin = Math.min(xMin, x0);
        yMin = Math.min(yMin, y0);
        xMax = Math.max(xMax, x1);
        yMax = Math.max(yMax, y1);
      }
    }

    if (contours.length === 0) {
      return { data: new Uint8Array(), contours: 0, points: 0, xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
    }

    const points = [];
    const endPts = [];
    for (const contour of contours) {
      for (const point of contour) {
        points.push(point);
      }
      endPts.push(...p16(points.length - 1));
    }

    const flags = new Uint8Array(points.length);
    flags.fill(0x01);
    const xs = [];
    const ys = [];
    let prevX = 0;
    let prevY = 0;
    for (const [x, y] of points) {
      xs.push(...pS16(x - prevX));
      ys.push(...pS16(y - prevY));
      prevX = x;
      prevY = y;
    }

    const data = bytes([
      pS16(contours.length),
      pS16(xMin),
      pS16(yMin),
      pS16(xMax),
      pS16(yMax),
      endPts,
      p16(0),
      flags,
      xs,
      ys,
    ]);

    return {
      data,
      contours: contours.length,
      points: points.length,
      xMin,
      yMin,
      xMax,
      yMax,
    };
  }

  function buildSfnt(tables) {
    const tags = Object.keys(tables).sort();
    const numTables = tags.length;
    const entrySelector = Math.floor(Math.log2(numTables));
    const searchRange = 16 * (1 << entrySelector);
    const rangeShift = numTables * 16 - searchRange;
    let offset = 12 + numTables * 16;
    const records = [];
    const body = [];
    let headOffset = null;

    for (const tag of tags) {
      const data = tables[tag];
      records.push(...ascii(tag), ...p32(checksum(data)), ...p32(offset), ...p32(data.length));
      if (tag === "head") {
        headOffset = offset;
      }
      const padded = pad4(data);
      body.push(padded);
      offset += padded.length;
    }

    const font = bytes([
      p32(0x00010000),
      p16(numTables),
      p16(searchRange),
      p16(entrySelector),
      p16(rangeShift),
      records,
      ...body,
    ]);
    if (headOffset === null) {
      throw new Error("missing head table");
    }
    const adjustment = (0xB1B0AFBA - checksum(font)) >>> 0;
    font.set(p32(adjustment), headOffset + 8);
    return font;
  }

  function buildTrueType(glyphs, familyName, cellWidth, cellHeight) {
    glyphs = [...glyphs].sort((a, b) => a.assignedCodepoint - b.assignedCodepoint);
    const unitsPerEm = Math.max(64, cellHeight * PIXEL_UNITS);
    const advance = cellWidth * PIXEL_UNITS;
    const ascent = cellHeight * PIXEL_UNITS;
    const descent = 0;

    const glyphDatas = [new Uint8Array()];
    const glyphStats = [{ contours: 0, points: 0, xMin: 0, yMin: 0, xMax: 0, yMax: 0 }];
    for (const glyph of glyphs) {
      const built = buildGlyphData(glyph.rows, PIXEL_UNITS);
      glyphDatas.push(built.data);
      glyphStats.push(built);
    }

    const glyfParts = [];
    const loca = [];
    let glyfLength = 0;
    for (const data of glyphDatas) {
      loca.push(...p32(glyfLength));
      const padded = pad4(data);
      glyfParts.push(padded);
      glyfLength += padded.length;
    }
    loca.push(...p32(glyfLength));

    const numGlyphs = glyphDatas.length;
    const maxContours = Math.max(...glyphStats.map((s) => s.contours));
    const maxPoints = Math.max(...glyphStats.map((s) => s.points));
    const xMaxExtent = Math.max(...glyphStats.map((s) => s.xMax));
    const maxY = Math.max(...glyphStats.map((s) => s.yMax));

    const hmtx = [];
    for (let i = 0; i < numGlyphs; i++) {
      hmtx.push(...p16(advance), ...pS16(0));
    }

    const hhea = bytes([
      fixed(1.0), pS16(ascent), pS16(descent), pS16(0), p16(advance), pS16(0), pS16(0), pS16(xMaxExtent),
      pS16(1), pS16(0), pS16(0), pS16(0), pS16(0), pS16(0), pS16(0), pS16(0), p16(numGlyphs),
    ]);

    const head = bytes([
      fixed(1.0), fixed(1.0), p32(0), p32(0x5F0F3CF5), p16(0x000B), p16(unitsPerEm),
      new Uint8Array(16), pS16(0), pS16(0), pS16(xMaxExtent), pS16(maxY), p16(0), p16(8), pS16(2), pS16(1), pS16(0),
    ]);

    const maxp = bytes([
      fixed(1.0), p16(numGlyphs), p16(maxPoints), p16(maxContours), p16(0), p16(0), p16(2), p16(0),
      p16(0), p16(0), p16(0), p16(0), p16(0), p16(0), p16(0),
    ]);

    const cmap = buildCmap(glyphs);
    const name = buildName(familyName);
    const post = bytes([fixed(3.0), fixed(0.0), pS16(0), pS16(0), p32(0), p32(0), p32(0), p32(0), p32(0)]);
    const os2 = buildOs2(glyphs, advance, ascent, descent, cellHeight * PIXEL_UNITS);

    return buildSfnt({
      "OS/2": os2,
      cmap,
      glyf: concatParts(glyfParts),
      head,
      hhea,
      hmtx: Uint8Array.from(hmtx),
      loca: Uint8Array.from(loca),
      maxp,
      name,
      post,
    });
  }

  function buildCmap(glyphs) {
    const segments = [];
    glyphs.forEach((glyph, i) => {
      const gid = i + 1;
      const codepoint = glyph.assignedCodepoint;
      if (codepoint <= 0xFFFF) {
        segments.push([codepoint, codepoint, (gid - codepoint) & 0xFFFF]);
      }
    });
    segments.push([0xFFFF, 0xFFFF, 1]);

    const segCount = segments.length;
    const entrySelector = Math.floor(Math.log2(segCount));
    const searchRange = 2 * (1 << entrySelector);
    const rangeShift = 2 * segCount - searchRange;
    const endCodes = [];
    const startCodes = [];
    const idDeltas = [];
    const idRangeOffsets = [];
    for (const [start, end, delta] of segments) {
      endCodes.push(...p16(end));
      startCodes.push(...p16(start));
      idDeltas.push(...p16(delta));
      idRangeOffsets.push(...p16(0));
    }

    const format4 = bytes([
      p16(4), p16(16 + 8 * segCount), p16(0), p16(segCount * 2), p16(searchRange), p16(entrySelector), p16(rangeShift),
      endCodes, p16(0), startCodes, idDeltas, idRangeOffsets,
    ]);
    return bytes([p16(0), p16(1), p16(3), p16(1), p32(12), format4]);
  }

  function utf16be(value) {
    const out = [];
    for (const ch of value) {
      const code = ch.codePointAt(0);
      if (code <= 0xFFFF) {
        out.push(...p16(code));
      } else {
        const n = code - 0x10000;
        out.push(...p16(0xD800 + (n >> 10)), ...p16(0xDC00 + (n & 0x3FF)));
      }
    }
    return Uint8Array.from(out);
  }

  function buildName(familyName) {
    const records = new Map([
      [1, familyName],
      [2, "Regular"],
      [3, `${familyName} Regular 1.0`],
      [4, `${familyName} Regular`],
      [5, "Version 1.0"],
      [6, `${familyName.replace(/[^A-Za-z0-9-]/g, "")}-Regular`],
    ]);
    const count = records.size;
    const stringOffset = 6 + count * 12;
    const recordBytes = [];
    const strings = [];
    let stringsLength = 0;
    for (const [nameId, value] of records) {
      const encoded = utf16be(value);
      recordBytes.push(...p16(3), ...p16(1), ...p16(0x0409), ...p16(nameId), ...p16(encoded.length), ...p16(stringsLength));
      strings.push(encoded);
      stringsLength += encoded.length;
    }
    return bytes([p16(0), p16(count), p16(stringOffset), recordBytes, ...strings]);
  }

  function buildOs2(glyphs, advance, ascent, descent, capHeight) {
    const codepoints = glyphs.map((glyph) => glyph.assignedCodepoint);
    const first = Math.min(...codepoints);
    const last = Math.max(...codepoints);
    return bytes([
      p16(4), pS16(advance), p16(400), p16(5), p16(0),
      pS16(0), pS16(0), pS16(0), pS16(0), pS16(0), pS16(0), pS16(0), pS16(0),
      pS16(Math.max(1, Math.floor(capHeight / 16))), pS16(Math.floor(capHeight / 2)), pS16(0),
      new Uint8Array(10),
      p32(0xFFFFFFFF), p32(0xFFFFFFFF), p32(0xFFFFFFFF), p32(0xFFFFFFFF),
      ascii("CODX"),
      p16(0x0040), p16(first), p16(last), pS16(ascent), pS16(descent), pS16(0), p16(ascent), p16(Math.abs(descent)),
      p32(0), p32(0), pS16(Math.floor(capHeight / 2)), pS16(capHeight), p16(0), p16(32), p16(1),
    ]);
  }

  function jsonFile(value) {
    return `${JSON.stringify(value, null, 4)}\n`;
  }

  function writeMapping(sizeKey, glyphs, ttfName) {
    const jsonGlyphs = glyphs.map((glyph) => ({
      char: glyph.assignedChar,
      sourceChar: glyph.char,
      originalCodepoint: cp(glyph.originalCodepoint),
      assignedCodepoint: cp(glyph.assignedCodepoint),
      cp932: glyph.cp932Hex,
      label: glyph.label,
      description: glyph.description,
      mappingKind: glyph.mappingKind,
      aliases: glyph.aliases,
      pua: glyph.assignedCodepoint >= PUA_START && glyph.assignedCodepoint <= PUA_END,
      source: glyph.source,
      sourceIndex: glyph.sourceIndex,
    }));

    const base = `font_${sizeKey}_codepoints`;
    const json = jsonFile({
      format: "bitmap-ttf-codepoint-map",
      version: 1,
      size: sizeKey,
      ttf: ttfName,
      puaStart: cp(PUA_START),
      glyphs: jsonGlyphs,
    });

    const lines = [];
    lines.push(`# ${sizeKey} TTF Codepoint Map`, "", `- TTF: \`${ttfName}\``, "- PUA glyphs are assigned from `U+E000` upward.", "");
    lines.push("| Char | Source char | Assigned | Original | CP932 | Kind | Label | Description | Aliases | Source |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const glyph of glyphs) {
      const source = `\`${glyph.source}#${glyph.sourceIndex}\``;
      const label = glyph.label ?? "";
      const aliases = glyph.aliases.length === 0 ? "" : glyph.aliases.map((s) => `\`${s}\``).join(", ");
      lines.push(`| ${glyph.assignedChar} | ${glyph.char} | \`${cp(glyph.assignedCodepoint)}\` | \`${cp(glyph.originalCodepoint)}\` | \`${glyph.cp932Hex}\` | \`${glyph.mappingKind}\` | ${label} | ${glyph.description} | ${aliases} | ${source} |`);
    }

    return [
      { name: `${base}.json`, data: textEncoder.encode(json) },
      { name: `${base}.md`, data: textEncoder.encode(`${lines.join("\n")}\n`) },
    ];
  }

  function writeTextAliases(glyphsBySize) {
    const aliasesBySize = {};
    for (const sizeKey of Object.keys(glyphsBySize).sort()) {
      for (const glyph of glyphsBySize[sizeKey]) {
        for (const alias of glyph.aliases) {
          aliasesBySize[sizeKey] ??= {};
          aliasesBySize[sizeKey][alias] = {
            replacement: glyph.assignedChar,
            assignedCodepoint: cp(glyph.assignedCodepoint),
            label: glyph.label,
            description: glyph.description,
          };
        }
      }
    }
    for (const sizeKey of Object.keys(aliasesBySize)) {
      const sorted = {};
      for (const alias of Object.keys(aliasesBySize[sizeKey]).sort((a, b) => b.length - a.length || a.localeCompare(b))) {
        sorted[alias] = aliasesBySize[sizeKey][alias];
      }
      aliasesBySize[sizeKey] = sorted;
    }

    const json = jsonFile({
      format: "bitmap-ttf-text-aliases",
      version: 1,
      description: "Replace these strings before calling imagettftext() so multi-character source text can use single custom glyphs.",
      sizes: aliasesBySize,
    });

    const phpMap = {};
    for (const [sizeKey, aliases] of Object.entries(aliasesBySize)) {
      phpMap[sizeKey] = {};
      for (const [alias, info] of Object.entries(aliases)) {
        phpMap[sizeKey][alias] = info.replacement;
      }
    }
    const php = [
      "<?php",
      "",
      "declare(strict_types=1);",
      "",
      "/**",
      " * Replace text aliases such as +1, ＋１, Lv, and Ｌｖ with single",
      " * mapped glyphs before passing the string to imagettftext().",
      " */",
      "function mes_bitmap_font_normalize_text(string $text, string $sizeKey): string",
      "{",
      `    static $aliasesBySize = ${phpArrayExport(phpMap, 1)};`,
      "",
      "    return strtr($text, $aliasesBySize[$sizeKey] ?? []);",
      "}",
      "",
    ].join("\n");

    return [
      { name: "font_text_aliases.json", data: textEncoder.encode(json) },
      { name: "font_text_aliases.php", data: textEncoder.encode(php) },
    ];
  }

  function phpArrayExport(value, indentLevel) {
    const indent = "  ".repeat(indentLevel);
    const nextIndent = "  ".repeat(indentLevel + 1);
    if (typeof value === "string") {
      return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    }
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "array ()";
    }
    const lines = ["array ("];
    for (const [key, item] of entries) {
      lines.push(`${nextIndent}${phpArrayExport(String(key), 0)} => ${phpArrayExport(item, indentLevel + 1)},`);
    }
    lines.push(`${indent})`);
    return lines.join("\n");
  }

  function writeIndex(glyphsBySize) {
    const lines = [];
    lines.push("# Generated Bitmap TTF Fonts", "");
    lines.push("Generated by `build_ttf_fonts.php`. These TTF files encode each bitmap pixel as a square outline so PHP GD can render them through `imagettftext()`.", "");
    lines.push("| Size | TTF | Glyphs | Mapping JSON | Mapping MD |");
    lines.push("| --- | --- | ---: | --- | --- |");
    for (const sizeKey of Object.keys(glyphsBySize).sort()) {
      lines.push(`| \`${sizeKey}\` | \`font_${sizeKey}.ttf\` | ${glyphsBySize[sizeKey].length} | \`font_${sizeKey}_codepoints.json\` | \`font_${sizeKey}_codepoints.md\` |`);
    }
    lines.push("");
    lines.push("Text aliases for multi-character glyphs are written to `font_text_aliases.json` and `font_text_aliases.php`.");
    lines.push("Usage example: load the mapped character from the JSON file, then pass the TTF path to `imagettftext()`.");
    lines.push("");
    return { name: "font_ttf_index.md", data: textEncoder.encode(lines.join("\n")) };
  }

  function generateFontFiles(glyphsBySize) {
    const files = [];
    for (const sizeKey of Object.keys(glyphsBySize).sort()) {
      const glyphs = glyphsBySize[sizeKey];
      if (glyphs.length === 0) {
        continue;
      }
      const [cellWidth, cellHeight] = sizeKey.split("x").map((v) => parseInt(v, 10));
      const familyName = `MesBitmap${sizeKey.replace("x", "X")}`;
      const ttfName = `font_${sizeKey}.ttf`;
      files.push({ name: ttfName, data: buildTrueType(glyphs, familyName, cellWidth, cellHeight) });
      files.push(...writeMapping(sizeKey, glyphs, ttfName));
    }
    files.push(...writeTextAliases(glyphsBySize));
    files.push(writeIndex(glyphsBySize));
    return files;
  }

  global.NdsFontTtf = {
    buildTrueType,
    generateFontFiles,
  };
})(globalThis);
