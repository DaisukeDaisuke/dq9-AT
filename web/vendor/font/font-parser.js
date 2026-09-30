(function (global) {
  "use strict";

  const { PUA_START, PUA_END } = global.NdsFontConstants;
  const decoder = new TextDecoder("shift_jis", { fatal: false });

  class LogicalStream {
    constructor(data, base, padEvery, mode) {
      this.data = data;
      this.base = base;
      this.padEvery = padEvery;
      this.mode = mode;
    }

    length() {
      if (this.padEvery === 0) {
        return this.data.length - this.base;
      }
      let low = 0;
      let high = this.data.length - this.base;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (this.physicalOffset(mid) < this.data.length) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return high + 1;
    }

    byte(logicalOffset) {
      const physical = this.physicalOffset(logicalOffset);
      if (physical < 0 || physical >= this.data.length) {
        return 0;
      }
      return this.data[physical];
    }

    bytes(logicalOffset, length) {
      const out = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        out[i] = this.byte(logicalOffset + i);
      }
      return out;
    }

    physicalOffset(logicalOffset) {
      if (this.padEvery === 0) {
        return this.base + logicalOffset;
      }
      return this.base + logicalOffset + Math.floor(logicalOffset / this.padEvery);
    }
  }

  function u16le(stream, offset) {
    return stream.byte(offset) | (stream.byte(offset + 1) << 8);
  }

  function u32le(stream, offset) {
    return (u16le(stream, offset) | (u16le(stream, offset + 2) << 16)) >>> 0;
  }

  function cp(codepoint) {
    return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
  }

  function utf8Chr(codepoint) {
    return String.fromCodePoint(codepoint);
  }

  function utf8Ord(char) {
    return char.codePointAt(0) ?? 0;
  }

  function binHexUpper(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function splitEvery(bytes, width) {
    const out = [];
    for (let i = 0; i < bytes.length; i += width) {
      out.push(bytes.slice(i, i + width));
    }
    return out;
  }

  function plusNumberAliases(number) {
    const asciiDigit = String(number);
    const fullDigit = utf8Chr(0xFF10 + number);
    return [...new Set(["+", utf8Chr(0xFF0B)].flatMap((plus) => [asciiDigit, fullDigit].map((digit) => plus + digit)))];
  }

  function lvAliases() {
    const ls = ["L", "l", utf8Chr(0xFF2C), utf8Chr(0xFF4C)];
    const vs = ["V", "v", utf8Chr(0xFF36), utf8Chr(0xFF56)];
    const aliases = [];
    for (const l of ls) {
      for (const v of vs) {
        aliases.push(l + v);
      }
    }
    return aliases;
  }

  const EXPLICIT_MAP = {
    "8x8": {
      0x3349: { assignedCodepoint: 0x1D31, label: "modifier letter capital E", description: "modifier letter capital E, used by the source glyph decoded as square miri" },
      0x3314: { assignedCodepoint: 0x25B6, label: "black right triangle", description: "black right-pointing triangle" },
      0x3322: { assignedCodepoint: 0x25C0, label: "black left triangle", description: "black left-pointing triangle" },
      0x9319: { pua: true, label: "+1", description: "single-glyph plus one counter", aliasKind: "plusNumber", aliasValue: 1 },
      0x9322: { pua: true, label: "+2", description: "single-glyph plus two counter", aliasKind: "plusNumber", aliasValue: 2 },
      0x931A: { pua: true, label: "+3", description: "single-glyph plus three counter", aliasKind: "plusNumber", aliasValue: 3 },
      0x9323: { pua: true, label: "+4", description: "single-glyph plus four counter", aliasKind: "plusNumber", aliasValue: 4 },
      0x933A: { pua: true, label: "+5", description: "single-glyph plus five counter", aliasKind: "plusNumber", aliasValue: 5 },
      0x9335: { pua: true, label: "+6", description: "single-glyph plus six counter", aliasKind: "plusNumber", aliasValue: 6 },
      0x933B: { pua: true, label: "+7", description: "single-glyph plus seven counter", aliasKind: "plusNumber", aliasValue: 7 },
      0x935C: { pua: true, label: "+8", description: "single-glyph plus eight counter", aliasKind: "plusNumber", aliasValue: 8 },
      0x9360: { pua: true, label: "+9", description: "single-glyph plus nine counter", aliasKind: "plusNumber", aliasValue: 9 },
      0x937C: { assignedCodepoint: 0x2605, label: "black star", description: "black star" },
      0x9871: { assignedCodepoint: 0x21B5, label: "return arrow", description: "downwards arrow with corner leftwards" },
      0x9874: { pua: true, label: "left upper triangle", description: "left-shifted filled upper triangle" },
      0x9873: { pua: true, label: "left broken lower triangle", description: "left-shifted broken lower triangle" },
      0x98AA: { pua: true, label: "rotated F", description: "rotated F-shaped custom symbol" },
      0x98AF: { pua: true, label: "cut upper-left square", description: "small square missing the upper-left corner" },
      0x98B1: { pua: true, label: "cut upper-right square", description: "small square missing the upper-right corner" },
      0x98B6: { pua: true, label: "cut lower-left square", description: "small square missing the lower-left corner" },
      0x98C4: { pua: true, label: "cut lower-right square", description: "small square missing the lower-right corner" },
      0x98C3: { pua: true, label: "large cut lower-right square", description: "large square missing the lower-right corner" },
      0x98C6: { pua: true, label: "large cut lower-left square", description: "large square missing the lower-left corner" },
      0x98E9: { pua: true, label: "large cut upper-right square", description: "large square missing the upper-right corner" },
      0x98EB: { pua: true, label: "large cut upper-left square", description: "large square missing the upper-left corner" },
      0x9903: { pua: true, label: "large cut lower-right square alt", description: "large square missing the lower-right corner, alternate glyph" },
      0x9909: { pua: true, label: "large cut lower-left square alt", description: "large square missing the lower-left corner, alternate glyph" },
      0x9912: { pua: true, label: "large cut upper-left square alt", description: "large square missing the upper-left corner, alternate glyph" },
      0x9914: { pua: true, label: "large cut upper-right square alt", description: "large square missing the upper-right corner, alternate glyph" },
      0x9D5D: { assignedCodepoint: 0x2070, label: "superscript zero", description: "superscript digit zero" },
      0x9D5E: { assignedCodepoint: 0x00B9, label: "superscript one", description: "superscript digit one" },
      0x9D64: { assignedCodepoint: 0x00B2, label: "superscript two", description: "superscript digit two" },
      0x9D51: { assignedCodepoint: 0x00B3, label: "superscript three", description: "superscript digit three" },
      0x9D50: { assignedCodepoint: 0x2074, label: "superscript four", description: "superscript digit four" },
      0x9D59: { assignedCodepoint: 0x2075, label: "superscript five", description: "superscript digit five" },
      0x9D72: { assignedCodepoint: 0x2076, label: "superscript six", description: "superscript digit six" },
      0x9D89: { assignedCodepoint: 0x2077, label: "superscript seven", description: "superscript digit seven" },
      0x9D87: { assignedCodepoint: 0x2078, label: "superscript eight", description: "superscript digit eight" },
      0x9DAB: { assignedCodepoint: 0x2079, label: "superscript nine", description: "superscript digit nine" },
      0x9D6F: { assignedCodepoint: 0x2192, label: "right arrow", description: "rightwards arrow" },
    },
    "10x10": {
      0x9D5D: { pua: true, label: "Lv", description: "single-glyph level marker", aliasKind: "lv" },
    },
    "12x12": {
      0x2501: { pua: true, label: "sword", description: "equipment icon: sword angled down-left" },
      0x2503: { pua: true, label: "armor", description: "equipment icon: armor" },
      0x250F: { pua: true, label: "shield", description: "equipment icon: shield" },
      0x2513: { pua: true, label: "head gear", description: "equipment icon: head gear" },
      0x251B: { pua: true, label: "gauntlet", description: "equipment icon: gauntlet or glove" },
      0x2517: { pua: true, label: "pants", description: "equipment icon: pants" },
      0x2523: { pua: true, label: "foot gear", description: "equipment icon: foot gear" },
      0x2533: { pua: true, label: "accessory", description: "equipment icon: accessory or ring" },
      0x252B: { pua: true, label: "item", description: "item icon" },
      0x253B: { pua: true, label: "item 2", description: "second item icon" },
      0x253C: { assignedCodepoint: 0x23F5, label: "right triangle button", description: "black medium right-pointing triangle" },
      0x2534: { assignedCodepoint: 0x25B4, label: "small up triangle", description: "black up-pointing small triangle" },
      0x252C: { assignedCodepoint: 0x25BE, label: "small down triangle", description: "black down-pointing small triangle" },
    },
  };

  function explicitGlyphMapping(sizeKey, originalCodepoint) {
    const mapping = EXPLICIT_MAP[sizeKey]?.[originalCodepoint];
    if (!mapping) {
      return null;
    }
    let aliases = [];
    if (mapping.aliasKind === "plusNumber") {
      aliases = plusNumberAliases(mapping.aliasValue);
    } else if (mapping.aliasKind === "lv") {
      aliases = lvAliases();
    }
    return {
      assignedCodepoint: mapping.assignedCodepoint ?? null,
      pua: Boolean(mapping.pua),
      label: mapping.label ?? null,
      description: mapping.description,
      aliases,
      kind: mapping.assignedCodepoint !== undefined ? "unicode-override" : "pua-explicit",
    };
  }

  function isCp932PrivateUseBytes(bytes) {
    if (bytes.length !== 2) {
      return false;
    }
    const b0 = bytes[0];
    const b1 = bytes[1];
    return b0 >= 0xF0 && b0 <= 0xFC && ((b1 >= 0x40 && b1 <= 0x7E) || (b1 >= 0x80 && b1 <= 0xFC));
  }

  function shouldAssignPua(char, cp932Bytes) {
    const codepoint = utf8Ord(char);
    return isCp932PrivateUseBytes(cp932Bytes)
      || (codepoint >= PUA_START && codepoint <= PUA_END)
      || codepoint < 0x20
      || codepoint === 0xFFFD
      || (char === "?" && binHexUpper(cp932Bytes) !== "3F");
  }

  function tryParseFont(file) {
    const data = file.data;
    if (!data || data.length < 16) {
      return null;
    }

    const candidates = [
      new LogicalStream(data, 0, 0, "raw"),
      new LogicalStream(data, 5, 8, "pad8-base5"),
      new LogicalStream(data, 5, 0, "raw-base5"),
    ];

    for (const stream of candidates) {
      if (stream.length() < 16) {
        continue;
      }
      const glyphBytes = u16le(stream, 0x00);
      const width = stream.byte(0x02);
      const height = stream.byte(0x03);
      const charCount = u16le(stream, 0x06);
      const charTableOffset = u32le(stream, 0x08);
      const bitmapOffset = u32le(stream, 0x0C);

      if (width < 4 || width > 64 || height < 4 || height > 64) continue;
      if (glyphBytes !== Math.ceil((width * height) / 8)) continue;
      if (charCount < 1 || charCount > 10000) continue;
      if (charTableOffset < 0x10 || bitmapOffset <= charTableOffset) continue;

      const charTableSpan = bitmapOffset - charTableOffset;
      const charTableBytes = charCount * 2;
      if (charTableSpan < charTableBytes || charTableSpan > charTableBytes + 8) continue;
      if (bitmapOffset > stream.length()) continue;

      const charsRaw = stream.bytes(charTableOffset, charTableBytes);
      const chars = Array.from(decoder.decode(charsRaw));
      if (chars.length !== charCount) continue;

      const available = Math.max(0, stream.length() - bitmapOffset);
      const decodableGlyphs = Math.min(charCount, Math.floor(available / glyphBytes));
      return {
        path: file.path,
        stream,
        glyphBytes,
        width,
        height,
        charCount,
        bitmapOffset,
        chars,
        cp932Bytes: splitEvery(charsRaw, 2),
        complete: decodableGlyphs === charCount,
        decodableGlyphs,
        sizeKey: `${width}x${height}`,
      };
    }

    return null;
  }

  function renderGlyphRows(font, glyphIndex) {
    const bitBase = (font.bitmapOffset + glyphIndex * font.glyphBytes) * 8;
    const rows = [];
    for (let y = 0; y < font.height; y++) {
      let line = "";
      for (let x = 0; x < font.width; x++) {
        const bit = bitBase + y * font.width + x;
        const byte = font.stream.byte(Math.floor(bit / 8));
        line += ((byte >> (bit % 8)) & 1) !== 0 ? "#" : ".";
      }
      rows.push(line);
    }
    return rows;
  }

  function collectPrimaryGlyphsBySize(fonts) {
    const selectedBySize = new Map();
    const puaBySize = new Map();
    const nextPuaBySize = new Map();

    for (const font of fonts) {
      if (!font.complete) {
        continue;
      }
      const sizeKey = font.sizeKey;
      if (!selectedBySize.has(sizeKey)) selectedBySize.set(sizeKey, new Map());
      if (!puaBySize.has(sizeKey)) puaBySize.set(sizeKey, new Map());
      if (!nextPuaBySize.has(sizeKey)) nextPuaBySize.set(sizeKey, PUA_START);

      for (let i = 0; i < font.charCount; i++) {
        const char = font.chars[i];
        const cp932Bytes = font.cp932Bytes[i];
        const cp932Hex = binHexUpper(cp932Bytes);
        const originalCodepoint = utf8Ord(char);
        const explicit = explicitGlyphMapping(sizeKey, originalCodepoint);
        const label = explicit?.label ?? null;
        let description = explicit?.description ?? "";
        const aliases = explicit?.aliases ?? [];
        let mappingKind = explicit?.kind ?? "unicode";
        const assignPua = Boolean(explicit?.pua) || (explicit === null && shouldAssignPua(char, cp932Bytes));
        const puaKey = explicit !== null ? `explicit:${originalCodepoint}` : `cp932:${cp932Hex}`;
        let assignedCodepoint;

        if (explicit?.assignedCodepoint !== null && explicit?.assignedCodepoint !== undefined) {
          assignedCodepoint = explicit.assignedCodepoint;
        } else if (assignPua) {
          const puaMap = puaBySize.get(sizeKey);
          if (!puaMap.has(puaKey)) {
            const next = nextPuaBySize.get(sizeKey);
            if (next > PUA_END) {
              throw new Error(`PUA exhausted for ${sizeKey}`);
            }
            puaMap.set(puaKey, next);
            nextPuaBySize.set(sizeKey, next + 1);
          }
          assignedCodepoint = puaMap.get(puaKey);
          if (explicit === null) {
            mappingKind = "pua-auto";
            description = "automatically assigned custom glyph";
          }
        } else {
          assignedCodepoint = originalCodepoint;
        }

        if (assignedCodepoint > 0xFFFF) {
          throw new Error("only BMP codepoints are supported by this minimal TTF writer");
        }

        const priority = explicit !== null ? 100 : (assignPua ? 50 : 10);
        const selected = selectedBySize.get(sizeKey);
        const existing = selected.get(assignedCodepoint);
        if (existing && existing.priority >= priority) {
          continue;
        }

        selected.set(assignedCodepoint, {
          priority,
          glyph: {
            char,
            originalCodepoint,
            assignedChar: utf8Chr(assignedCodepoint),
            assignedCodepoint,
            cp932Hex,
            label,
            description,
            mappingKind,
            aliases,
            source: font.path,
            sourceIndex: i,
            rows: renderGlyphRows(font, i),
          },
        });
      }
    }

    const out = {};
    for (const sizeKey of [...selectedBySize.keys()].sort()) {
      out[sizeKey] = [...selectedBySize.get(sizeKey).entries()]
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1].glyph);
    }
    return out;
  }

  function parseFonts(files) {
    const candidates = files
      .filter((file) => /\.(mes|pac|NFTR)$/i.test(file.path))
      .sort((a, b) => a.path < b.path ? -1 : (a.path > b.path ? 1 : 0));
    const parsed = [];
    for (const file of candidates) {
      const font = tryParseFont(file);
      if (font) {
        parsed.push(font);
      }
    }
    return {
      parsed,
      glyphsBySize: collectPrimaryGlyphsBySize(parsed),
    };
  }

  global.NdsFontParser = {
    LogicalStream,
    cp,
    utf8Chr,
    utf8Ord,
    binHexUpper,
    tryParseFont,
    parseFonts,
    collectPrimaryGlyphsBySize,
  };
})(globalThis);
