(function (global) {
  "use strict";

  class BinaryReader {
    constructor(bytes) {
      this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      this.position = 0;
    }

    get length() {
      return this.bytes.length;
    }

    seek(position) {
      this.position = position >>> 0;
    }

    readU8() {
      return this.bytes[this.position++] ?? 0;
    }

    readU16() {
      const v = this.bytes[this.position] | (this.bytes[this.position + 1] << 8);
      this.position += 2;
      return v >>> 0;
    }

    readU32() {
      const v = this.bytes[this.position]
        | (this.bytes[this.position + 1] << 8)
        | (this.bytes[this.position + 2] << 16)
        | (this.bytes[this.position + 3] << 24);
      this.position += 4;
      return v >>> 0;
    }

    readBytes(length) {
      const out = this.bytes.slice(this.position, this.position + length);
      this.position += length;
      return out;
    }
  }

  function decompressSelection(reader, fileEnd) {
    const compressionFlags = reader.readU32();
    const compressType = compressionFlags & 0x7;
    const decompressedSize = compressionFlags >>> 3;
    if (compressType === 0) {
      return reader.readBytes(decompressedSize);
    }
    if (compressType === 1) {
      return decompressA(reader, decompressedSize, fileEnd);
    }
    if (compressType === 2 || compressType === 3) {
      return decompressB(reader, decompressedSize, fileEnd, 1 << compressType);
    }
    if (compressType === 4) {
      return decompressC(reader, decompressedSize, fileEnd);
    }
    throw new Error(`Unsupported GP2 compression type: ${compressType}`);
  }

  function decompressA(reader, decompressedSize, compressedEnd) {
    const out = new Uint8Array(decompressedSize);
    let outPos = 0;
    let controlByte = 0;
    let controlByteBits = 0;
    let copyBackControl = 0;
    let copyBackByteCount = 3;
    const compressionType = 0;

    while (decompressedSize > 0) {
      while (controlByteBits !== 0) {
        if (compressedEnd - reader.position <= 0) {
          return out;
        }
        if ((controlByte & 0x80) === 0) {
          out[outPos++] = reader.readU8();
          decompressedSize--;
        } else {
          let brokeCompressionType = false;
          while (copyBackByteCount !== 0) {
            if (compressionType === 1) {
              copyBackByteCount--;
              if (copyBackByteCount !== 0) {
                if (copyBackByteCount !== 1) {
                  copyBackControl = reader.readU8();
                  if (copyBackControl & 0xE0) {
                    copyBackControl += 0x10;
                    copyBackByteCount = 0;
                    break;
                  } else {
                    let extraToAdd = 0x110;
                    if ((copyBackControl & 0x10) !== 0) {
                      extraToAdd += 0x1000;
                      copyBackControl = extraToAdd + ((copyBackControl & 0xF) << 16);
                    } else {
                      copyBackControl = extraToAdd + ((copyBackControl & 0xF) << 8);
                      copyBackByteCount = 1;
                    }
                  }
                } else {
                  copyBackControl += reader.readU8() << 8;
                }
              } else {
                copyBackControl += reader.readU8();
                break;
              }
              if (compressedEnd - reader.position <= 0) {
                return out;
              }
            } else {
              brokeCompressionType = true;
              break;
            }
          }
          if (brokeCompressionType) {
            copyBackControl = 0x30 + reader.readU8();
            copyBackByteCount = 0;
          }
          if (compressedEnd - reader.position <= 0) {
            return out;
          }
          const copyBackDistance = 1 + (((copyBackControl & 0xF) << 8) | reader.readU8());
          copyBackByteCount = 3;
          copyBackControl >>>= 4;
          while (copyBackControl > 0 && decompressedSize > 0) {
            out[outPos] = out[outPos - copyBackDistance] ?? 0;
            outPos++;
            decompressedSize--;
            copyBackControl--;
          }
        }
        if (decompressedSize === 0) {
          return out;
        }
        controlByte = (controlByte << 1) & 0xFF;
        controlByteBits--;
      }
      if (compressedEnd - reader.position <= 0) {
        break;
      }
      controlByte = reader.readU8();
      controlByteBits = 8;
    }

    return out;
  }

  function decompressB(reader, decompressedLength, compressedEnd, shiftAmount) {
    const out = new Uint8Array((decompressedLength + 3) & ~3);
    let outPos = 0;
    let shiftRegister = 0;
    let cumulative = 0;
    let currBlockPos = 1;

    while (outPos < decompressedLength && reader.position < compressedEnd) {
      const rawBlockSize = reader.readU8();
      const currBlockSize = ((rawBlockSize + 1) << 1) - 1;
      const currBlock = new Uint8Array(currBlockSize + 1);
      for (let i = 1; i <= currBlockSize; i++) {
        currBlock[i] = reader.readU8();
      }
      currBlock[0] = rawBlockSize;

      while (outPos < decompressedLength && reader.position + 4 <= compressedEnd) {
        let currPack = reader.readU32();
        for (let i = 0; i < 32; i++) {
          let offs = currBlock[currBlockPos];
          currBlockPos &= ~1;
          currBlockPos += ((offs & 0x3F) + 1) << 1;
          const highBit = (currPack & 0x80000000) !== 0;
          currBlockPos += highBit ? 1 : 0;
          offs = (offs << (highBit ? 1 : 0)) & 0xFF;
          currPack = (currPack << 1) >>> 0;

          if (offs & 0x80) {
            const currValue = currBlock[currBlockPos];
            cumulative >>>= shiftAmount;
            cumulative = (cumulative | (currValue << (32 - shiftAmount))) >>> 0;
            currBlockPos = 1;
            shiftRegister += shiftAmount;
            if (((outPos - decompressedLength) >>> 0) < (shiftRegister >> 3)) {
              cumulative >>>= 32 - shiftRegister;
              shiftRegister = 32;
            }
            if (shiftRegister === 32) {
              out[outPos++] = cumulative & 0xFF;
              out[outPos++] = (cumulative >>> 8) & 0xFF;
              out[outPos++] = (cumulative >>> 16) & 0xFF;
              out[outPos++] = (cumulative >>> 24) & 0xFF;
              shiftRegister = 0;
              cumulative = 0;
              if (outPos >= decompressedLength) {
                return out.slice(0, decompressedLength);
              }
            }
          }
        }
      }
    }

    return out.slice(0, decompressedLength);
  }

  function decompressC(reader, decompressedSize, compressedEnd) {
    const out = new Uint8Array(decompressedSize);
    let outPos = 0;

    while (outPos < decompressedSize && reader.position < compressedEnd - 1) {
      const control = reader.readU8();
      if ((control & 0x80) === 0) {
        for (let i = 0; i <= (control & 0x7F) && outPos < decompressedSize; i++) {
          out[outPos++] = reader.readU8();
        }
      } else {
        const copyCount = (control & 0x7F) + 2;
        const value = reader.readU8();
        for (let i = 0; i <= copyCount && outPos < decompressedSize; i++) {
          out[outPos++] = value;
        }
      }
    }

    return out;
  }

  function readNullString(bytes, offset) {
    let end = offset;
    while (end < bytes.length && bytes[end] !== 0) {
      end++;
    }
    return {
      value: String.fromCharCode(...bytes.slice(offset, end)),
      next: end + 1,
    };
  }

  // Optional exact-path Set: skip unrequested payload decompression.
  function parseGp2(bytes, selectedPaths = null) {
    const reader = new BinaryReader(bytes);
    const magic = reader.readU32();
    if (magic !== 0x32435047) {
      throw new Error("GP2 magic not found");
    }

    const header = {
      packedFileCount: reader.readU16(),
      headerLength: reader.readU16(),
      fileInfoLength: reader.readU16(),
      firstFileOffs: reader.readU16(),
      decompressedFileInfoLength: reader.readU16(),
      decompressedFilenameLength: reader.readU16(),
      totalFileSize: reader.readU32(),
    };
    const fileCount = header.packedFileCount & 0xFFF;
    const firstFileOffs = header.firstFileOffs * 4;

    reader.seek(header.headerLength << 2);
    const fileInfoTree = decompressSelection(reader, header.fileInfoLength * 4);

    reader.seek(header.fileInfoLength * 4);
    const fileNames = decompressSelection(reader, firstFileOffs);

    const entries = [];
    const info = new BinaryReader(fileInfoTree);
    for (let i = 0; i < fileCount; i++) {
      entries.push({
        hash: info.readU32(),
        offs: info.readU32(),
        size: info.readU32(),
      });
    }
    entries.sort((a, b) => (a.offs & 0xFFFFFF) - (b.offs & 0xFFFFFF));

    const names = [];
    let nameOffset = 0;
    for (let i = 0; i < fileCount; i++) {
      const read = readNullString(fileNames, nameOffset);
      names.push(read.value);
      nameOffset = read.next;
    }

    const compressedFiles = (header.totalFileSize & 0x10000000) === 0;
    const files = [];
    for (let i = 0; i < fileCount; i++) {
      if (selectedPaths && !selectedPaths.has(names[i])) continue;
      const entry = entries[i];
      const fileOffset = (entry.offs & 0xFFFFFF) * 4;
      reader.seek(fileOffset + firstFileOffs);
      let data;
      if (!compressedFiles) {
        data = reader.readBytes(entry.size & 0xFFFFFF);
      } else {
        reader.readU32();
        reader.seek(fileOffset + firstFileOffs);
        data = decompressSelection(reader, fileOffset + firstFileOffs + (entry.size & 0xFFFFFF));
      }
      files.push({
        path: names[i],
        data,
      });
    }

    return files;
  }

  global.NdsFontGp2 = {
    BinaryReader,
    parseGp2,
    decompressSelection,
  };
})(globalThis);
