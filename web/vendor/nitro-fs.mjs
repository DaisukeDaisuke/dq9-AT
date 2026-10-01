class BufferReader {
    constructor(buffer, start, length, littleEndian = true) {
        this.buffer = buffer;
        this.start = start;
        this.bufferLength = length;
        this.view = new DataView(buffer, start, length);
        this.littleEndian = littleEndian;
    }
    /**
     * Creates a new BufferReader instance from the specified ArrayBuffer.
     * @param buffer - The ArrayBuffer to read from.
     * @param littleEndian - Whether the buffer is little endian.
     * @returns The BufferReader instance.
     */
    static new(buffer, littleEndian = true) {
        return new BufferReader(buffer, 0, buffer.byteLength, littleEndian);
    }
    /**
     * Slices the buffer and returns a new BufferReader instance, without copying the underlying buffer.
     * @param start - The start offset.
     * @param end - The end offset.
     * @returns The new BufferReader instance.
     */
    slice(start, end) {
        if (end === undefined || end > this.bufferLength) {
            end = this.bufferLength;
        }
        return new BufferReader(this.buffer, this.start + start, end - start);
    }
    readUint8(offset) {
        return this.view.getUint8(offset);
    }
    readUint16(offset) {
        return this.view.getUint16(offset, this.littleEndian);
    }
    readUint24(offset) {
        return this.view.getUint8(offset) | (this.view.getUint8(offset + 1) << 8) | (this.view.getUint8(offset + 2) << 16);
    }
    readUint32(offset) {
        return this.view.getUint32(offset, this.littleEndian);
    }
    readInt8(offset) {
        return this.view.getInt8(offset);
    }
    readInt16(offset) {
        return this.view.getInt16(offset, this.littleEndian);
    }
    readInt24(offset) {
        return this.view.getInt8(offset) | (this.view.getInt8(offset + 1) << 8) | (this.view.getInt8(offset + 2) << 16);
    }
    readInt32(offset) {
        return this.view.getInt32(offset, this.littleEndian);
    }
    readFloat32(offset) {
        return this.view.getFloat32(offset, this.littleEndian);
    }
    readFloat64(offset) {
        return this.view.getFloat64(offset, this.littleEndian);
    }
    /**
     * Reads a string of the specified length from the buffer.
     * @param offset - The offset to start reading from.
     * @param length - The length of the string to read.
     */
    readChars(offset, length) {
        let result = "";
        for (let i = 0; i < length; i++) {
            result += String.fromCharCode(this.view.getUint8(offset + i));
        }
        return result;
    }
    /**
     * Reads a null-terminated string from the buffer.
     * @param offset - The offset to start reading from.
     */
    readString(offset) {
        let result = "";
        let i = 0;
        while (true) {
            let c = this.view.getUint8(offset + i);
            if (c === 0) {
                break;
            }
            result += String.fromCharCode(c);
            i++;
        }
        return result;
    }
    /**
     * Reads a variable-length integer from the buffer. Variable-length integers are encoded in groups of 7 bits,
     * with the 8th bit indicating whether another group of 7 bits follows.
     * @param offset - The offset to start reading from.
     * @returns An object containing the value and the length of the integer.
     */
    readVL(offset) {
        let result = 0;
        let i = 0;
        while (true) {
            const c = this.view.getUint8(offset + i);
            result <<= 7;
            result |= (c & 0x7F);
            if ((c & 0x80) === 0) {
                break;
            }
            i++;
        }
        return { value: result, length: i + 1 };
    }
    get length() {
        return this.bufferLength;
    }
    /**
     * Returns a copy of the underlying buffer.
     * @returns - A copy of the underlying buffer.
     */
    getBuffer() {
        return this.buffer.slice(this.start, this.start + this.bufferLength);
    }
}

class CartridgeHeader {
    constructor(raw) {
        // Game Title (0x00, 12 bytes, Uppercase ASCII, padded with 0x00)
        this.gameTitle = raw.readChars(0x00, 12).replace(/\0/g, "");
        // Game Code (0x0C, 4 bytes, Uppercase ASCII, padded with 0x00)
        this.gameCode = raw.readChars(0x0C, 4).replace(/\0/g, "");
        // FNT Offset (0x40, 4 bytes)
        this.fntOffset = raw.readUint32(0x40);
        // FNT Length (0x44, 4 bytes)
        this.fntLength = raw.readUint32(0x44);
        // FAT Offset (0x48, 4 bytes)
        this.fatOffset = raw.readUint32(0x48);
        // FAT Length (0x4C, 4 bytes)
        this.fatLength = raw.readUint32(0x4C);
        // Other fields are ignored for now
        // TODO: Maybe CRC later?
    }
}

class NitroFAT {
    constructor(raw) {
        this.entries = [];
        for (let i = 0; i < raw.length; i += 8) {
            const startAddress = raw.readUint32(i);
            const endAddress = raw.readUint32(i + 4);
            this.entries.push({
                startAddress,
                endAddress
            });
        }
    }
}

class NitroFNTMainTable {
    constructor(raw, numEntries) {
        this.totalDirCount = numEntries;
        this.entries = [];
        for (let i = 0; i < numEntries; i++) {
            const entryOffset = i * 8;
            const entryBuffer = raw.slice(entryOffset, entryOffset + 8);
            const entry = {
                subTableOffset: entryBuffer.readUint32(0x00),
                firstFileID: entryBuffer.readUint16(0x04),
                parentDirectoryID: entryBuffer.readUint16(0x06)
            };
            this.entries.push(entry);
        }
    }
}
class NitroFNTSubTable {
    constructor(raw) {
        this.entries = [];
        let i = 0;
        while (true) {
            const typeAndLength = raw.readUint8(i);
            i++;
            const { type, length } = this.seperateTypeAndLength(typeAndLength);
            if (type == NitroFNTSubtableEntryType.File) {
                const name = raw.readChars(i, length);
                i += length;
                this.entries.push({
                    type,
                    length,
                    name
                });
            }
            else if (type == NitroFNTSubtableEntryType.SubDirectory) {
                const name = raw.readChars(i, length);
                i += length;
                // ID of the subdirectory (2 bytes, little endian)
                const id = raw.readUint16(i) & 0xFFF;
                i += 2;
                this.entries.push({
                    type,
                    length,
                    name,
                    subDirectoryID: id
                });
            }
            else if (type == NitroFNTSubtableEntryType.EndOfSubTable) {
                break;
            }
            else if (type == NitroFNTSubtableEntryType.Reserved) {
                throw new Error("Reserved entry type found in NitroFNTSubTable");
            }
        }
    }
    seperateTypeAndLength(typeAndLength) {
        if (typeAndLength == 0x00) {
            return { type: NitroFNTSubtableEntryType.EndOfSubTable, length: 0 };
        }
        else if (typeAndLength == 0x80) {
            return { type: NitroFNTSubtableEntryType.Reserved, length: 0 };
        }
        else if (typeAndLength < 0x80) {
            return { type: NitroFNTSubtableEntryType.File, length: typeAndLength % 0x80 };
        }
        else {
            return { type: NitroFNTSubtableEntryType.SubDirectory, length: typeAndLength % 0x80 };
        }
    }
}
var NitroFNTSubtableEntryType;
(function (NitroFNTSubtableEntryType) {
    NitroFNTSubtableEntryType[NitroFNTSubtableEntryType["File"] = 0] = "File";
    NitroFNTSubtableEntryType[NitroFNTSubtableEntryType["SubDirectory"] = 1] = "SubDirectory";
    NitroFNTSubtableEntryType[NitroFNTSubtableEntryType["EndOfSubTable"] = 2] = "EndOfSubTable";
    NitroFNTSubtableEntryType[NitroFNTSubtableEntryType["Reserved"] = 3] = "Reserved";
})(NitroFNTSubtableEntryType || (NitroFNTSubtableEntryType = {}));

class NitroFNT {
    constructor(raw) {
        // First, read the main table
        // The number of entries is always stored at 0x06 and 0x07 (2 bytes, little endian)
        // Each entry is 8 bytes long, so the total size of the main table is 8 * numEntries
        const numEntries = raw.readUint16(0x06);
        const mainTableBuffer = raw.slice(0, 8 * numEntries);
        this.mainTable = new NitroFNTMainTable(mainTableBuffer, numEntries);
        // Next, read the subtables
        this.subTables = [];
        for (let i = 0; i < this.mainTable.entries.length; i++) {
            const subTableOffset = this.mainTable.entries[i].subTableOffset;
            const subTable = new NitroFNTSubTable(raw.slice(subTableOffset));
            this.subTables.push(subTable);
        }
        // Build the directory tree
        this.tree = new NitroFNTDirectory("root");
        this.parseSubTable(this.subTables[0], this.tree, 0);
    }
    parseSubTable(subTable, parentDirectory, parentDirectoryID) {
        const mainTableEntry = this.mainTable.entries[parentDirectoryID];
        for (let i = 0; i < subTable.entries.length; i++) {
            const subTableEntry = subTable.entries[i];
            if (subTableEntry.type == NitroFNTSubtableEntryType.File) {
                const file = new NitroFNTFile(subTableEntry.name, mainTableEntry.firstFileID + i);
                parentDirectory.files.push(file);
            }
            else if (subTableEntry.type == NitroFNTSubtableEntryType.SubDirectory) {
                const directory = new NitroFNTDirectory(subTableEntry.name);
                parentDirectory.directories.push(directory);
                this.parseSubTable(this.subTables[subTableEntry.subDirectoryID], directory, subTableEntry.subDirectoryID);
            }
        }
    }
}
class NitroFNTDirectory {
    constructor(name) {
        this.name = name;
        this.files = [];
        this.directories = [];
    }
}
class NitroFNTFile {
    constructor(name, id) {
        this.name = name;
        this.id = id;
    }
}

/**
 * Class for reading files from the NitroFS.
 */
class NitroFS {
    /**
     * Creates a NitroFS instance from a ROM buffer.
     * @param rom - The ROM buffer.
     * @returns The NitroFS instance.
     */
    static fromRom(rom) {
        const nitroFS = new NitroFS();
        const reader = BufferReader.new(rom, true);
        // First, read the cartridge header
        const headerBuffer = reader.slice(0, 0x200);
        nitroFS.cartridgeHeader = new CartridgeHeader(headerBuffer);
        // Next, skip to the FNT and read it
        const fntBuffer = reader.slice(nitroFS.cartridgeHeader.fntOffset, nitroFS.cartridgeHeader.fntOffset + nitroFS.cartridgeHeader.fntLength);
        nitroFS.fnt = new NitroFNT(fntBuffer);
        // Then, skip to the FAT and read it
        const fatBuffer = reader.slice(nitroFS.cartridgeHeader.fatOffset, nitroFS.cartridgeHeader.fatOffset + nitroFS.cartridgeHeader.fatLength);
        const fat = new NitroFAT(fatBuffer);
        // Use file data directly instead of only addresses in order to save memory
        // Also, clone the file buffers so that the original buffer can be garbage collected
        // so that we only have to keep the file data in memory, not the entire ROM
        nitroFS.fileData = [];
        for (let i = 0; i < fat.entries.length; i++) {
            const entry = fat.entries[i];
            nitroFS.fileData[i] = reader.slice(entry.startAddress, entry.endAddress).getBuffer();
        }
        return nitroFS;
    }
    /**
     * Reads a file from the NitroFS.
     * @param path - The path to the file.
     * @returns A buffer containing the file data.
     */
    readFile(path) {
        const directoryParts = path.split("/");
        const fileName = directoryParts.pop();
        let currentDir = this.fnt.tree;
        for (let i = 0; i < directoryParts.length; i++) {
            currentDir = currentDir.directories.find(dir => dir.name == directoryParts[i]);
            if (!currentDir) {
                throw new Error(`Directory not found: ${directoryParts[i]}`);
            }
        }
        const file = currentDir.files.find(file => file.name == fileName);
        if (!file) {
            throw new Error(`File not found: ${fileName}`);
        }
        return this.fileData[file.id];
    }
    /**
     * Reads a directory from the NitroFS.
     * @param path - The path to the directory.
     * @returns An object containing the paths of every file and directory in the base directory.
     */
    readDir(path) {
        let directoryParts = path.split("/");
        // Remove every empty string from the array
        directoryParts = directoryParts.filter(dir => dir != "");
        let currentDir = this.fnt.tree;
        for (let i = 0; i < directoryParts.length; i++) {
            currentDir = currentDir.directories.find(dir => dir.name == directoryParts[i]);
            if (!currentDir) {
                throw new Error(`Directory not found: ${directoryParts[i]}`);
            }
        }
        let files = [];
        let directories = [];
        for (let i = 0; i < currentDir.files.length; i++) {
            files.push(currentDir.files[i].name);
        }
        for (let i = 0; i < currentDir.directories.length; i++) {
            directories.push(currentDir.directories[i].name);
        }
        return {
            files,
            directories
        };
    }
    /**
     * Checks if a file exists in the NitroFS.
     * @param path - The path to the file.
     * @returns Whether the file exists.
     */
    exists(path) {
        try {
            this.readFile(path);
            return true;
        }
        catch (e) {
            return false;
        }
    }
}

class CompressionHeader {
    constructor(raw) {
        // Byte 0: Compression Type
        this.compressionType = raw.readUint8(0x00);
        // Byte 1-3: Decompressed size
        this.decompressedSize = raw.readUint24(0x01);
    }
}
var CompressionType;
(function (CompressionType) {
    CompressionType[CompressionType["LZ10"] = 16] = "LZ10";
    CompressionType[CompressionType["LZ11"] = 17] = "LZ11";
})(CompressionType || (CompressionType = {}));

// https://github.com/magical/nlzss/blob/master/lzss3.py
class LZ10 {
    static decompress(indata, decompressedSize) {
        if (decompressedSize > indata.bufferLength * 9) throw new Error('LZ10 expanded size exceeds encoded capacity');
        let data = new Uint8Array(decompressedSize);
        let dataIndex = 0;
        let rawIndex = 0;
        const dispExtra = 1;
        function bits(byte) {
            return [
                (byte >> 7) & 1,
                (byte >> 6) & 1,
                (byte >> 5) & 1,
                (byte >> 4) & 1,
                (byte >> 3) & 1,
                (byte >> 2) & 1,
                (byte >> 1) & 1,
                (byte >> 0) & 1
            ];
        }
        function writeByte(byte) {
            data[dataIndex++] = byte;
        }
        function readByte() {
            return indata.readUint8(rawIndex++);
        }
        function readShort() {
            // big-endian
            const a = indata.readUint8(rawIndex++);
            const b = indata.readUint8(rawIndex++);
            return (a << 8) | b;
        }
        function copyByte() {
            writeByte(readByte());
        }
        while (dataIndex < decompressedSize) {
            const b = readByte();
            const flags = bits(b);
            for (let i = 0; i < 8; i++) {
                if (flags[i] === 0) {
                    copyByte();
                }
                else if (flags[i] === 1) {
                    const sh = readShort();
                    const count = (sh >> 0xC) + 3;
                    const disp = (sh & 0xFFF) + dispExtra;
                    if (disp > dataIndex) throw new Error('Invalid LZ10 back-reference');
                    for (let j = 0; j < count && dataIndex < decompressedSize; j++) {
                        const byte = data[dataIndex - disp];
                        writeByte(byte);
                    }
                }
                else {
                    throw new Error(`Invalid flag: ${flags[i]}`);
                }
                if (decompressedSize <= dataIndex) {
                    break;
                }
            }
        }
        return data;
    }
}

class Compression {
    static decompress(raw) {
        const header = new CompressionHeader(raw.slice(0, 4));
        switch (header.compressionType) {
            case CompressionType.LZ10:
                return LZ10.decompress(raw.slice(4), header.decompressedSize);
            default:
                throw new Error(`Unsupported compression type: ${header.compressionType}`);
        }
    }
}

class InfoSection {
    constructor(raw) {
        // Header
        // 0x00 (1 byte): Dummy
        // 0x01 (1 byte): Number of entries
        this.numberOfEntries = raw.readUint8(0x01);
        // 0x02 (2 bytes): Section Size
        this.sectionSize = raw.readUint16(0x02);
        // Unknown Block
        // Header is 8 bytes long
        // Then there are 4 bytes per entry
        // So the size of the unknown block is 8 + (4 * numberOfEntries)
        // this.unknownBlock = raw.slice(4, 8 + (4 * this.numberOfEntries) + 4);
        let offset = 8 + (4 * this.numberOfEntries) + 4;
        // Info Data Block
        // 0x00 (2 bytes): Header Size
        // 0x02 (2 bytes): Data Size
        this.dataSize = raw.readUint16(offset + 2);
        const dataSectionSize = (this.dataSize - 4) / this.numberOfEntries;
        offset += 4;
        for (let i = 0; i < this.numberOfEntries; i++) {
            this.parseEntry(raw.slice(offset, offset + dataSectionSize));
            offset += dataSectionSize;
        }
        // Name Block
        // No header, each name is 16 bytes long
        this.names = [];
        for (let i = 0; i < this.numberOfEntries; i++) {
            this.names.push(raw.readChars(offset, 16).replace(/\0/g, ""));
            offset += 16;
        }
    }
}

class PaletteInfoSection extends InfoSection {
    parseEntry(raw) {
        if (this.entries === undefined) {
            this.entries = [];
        }
        this.entries.push(new PaletteInfo(raw));
    }
}
class PaletteInfo {
    constructor(raw) {
        // 0x00 (2 bytes): Palette Offset, shift << 3, relative to the start of Palette Data
        this.paletteOffset = (raw.readUint16(0x00)) << 3;
        // Rest is unknown
    }
}

class TextureInfoSection extends InfoSection {
    parseEntry(raw) {
        if (this.entries === undefined) {
            this.entries = [];
        }
        this.entries.push(new TextureInfo(raw));
    }
}
class TextureInfo {
    constructor(raw) {
        // 0x00 (2 bytes): Texture Offset, shift << 3, relative to the start of Texture Data
        this.textureOffset = (raw.readUint16(0x00)) << 3;
        // 0x02 (2 bytes): Parameters
        // --CFFFHHHWWW----
        // C = First Color Transparent
        // F = Format
        // H = Height (8 << Height)
        // W = Width (8 << Width)
        const parameters = raw.readUint16(0x02);
        this.firstColorTransparent = (parameters & 8192) >> 13 === 1;
        this.format = (parameters & 7168) >> 10;
        this.height = (parameters & 896) >> 7;
        this.width = (parameters & 112) >> 4;
        // Width and Height are stored as right-shifted values (8 << Width or Height), so we need to shift them back
        this.width = 8 << this.width;
        this.height = 8 << this.height;
        // Rest is unknown
    }
}

// http://llref.emutalk.net/docs/?file=xml/btx0.xml#xml-doc
// https://github.com/scurest/apicula/blob/master/src/nitro/tex.rs
class TEX0Header {
    constructor(raw) {
        // 0x00 (4 bytes): Magic "TEX0"
        this.magic = raw.readChars(0x00, 4);
        // 0x04 (4 bytes): Section size
        this.sectionSize = raw.readUint32(0x04);
        // 0x08 (4 bytes): Padding
        // 0x0C (2 bytes): Texture Data Size
        this.textureDataSize = raw.readUint16(0x0C);
        // 0x0E (2 bytes): Texture Info Offset
        this.textureInfoOffset = raw.readUint16(0x0E);
        // 0x10 (4 bytes): Padding
        // 0x14 (4 bytes): Texture Data Offset
        this.textureDataOffset = raw.readUint32(0x14);
        // 0x18 (4 bytes): Padding
        // 0x1C (2 bytes): Compressed Texture Data Size
        this.compressedTextureDataSize = raw.readUint16(0x1C);
        // 0x1E (2 bytes): Compressed Texture Info Offset
        this.compressedTextureInfoOffset = raw.readUint16(0x1E);
        // 0x20 (4 bytes): Padding
        // 0x24 (4 bytes): Compressed Texture Data Offset
        this.compressedTextureDataOffset = raw.readUint32(0x24);
        // 0x28 (4 bytes): Compressed Texture Info Data Offset
        this.compressedTextureInfoDataOffset = raw.readUint32(0x28);
        // 0x2C (4 bytes): Padding
        // 0x30 (4 bytes): Palette Data Size
        this.paletteDataSize = raw.readUint16(0x30);
        // 0x34 (4 bytes): Palette Info Offset
        this.paletteInfoOffset = raw.readUint16(0x34);
        // 0x38 (4 bytes): Palette Data Offset
        this.paletteDataOffset = raw.readUint32(0x38);
    }
}

// I don't know how this works
// Thank you, MIT License
// https://github.com/magcius/noclip.website/blob/master/src/SuperMario64DS/nitro_tex.ts
function readTexture_CMPR_4x4(width, height, texData, palIdxData, palData) {
    function getPal16(offs) {
        //return offs < palView.byteLength ? palView.getUint16(offs, true) : 0;
        return offs < palView.length ? palData.readUint16(offs) : 0;
    }
    function buildColorTable(palBlock) {
        const palMode = palBlock >> 14;
        const palOffs = (palBlock & 0x3FFF) << 2;
        const colorTable = new Uint8Array(16);
        const p0 = getPal16(palOffs + 0x00);
        bgr5(colorTable, 0, p0);
        colorTable[3] = 0xFF;
        const p1 = getPal16(palOffs + 0x02);
        bgr5(colorTable, 4, p1);
        colorTable[7] = 0xFF;
        if (palMode === 0) {
            // PTY=0, A=0
            const p2 = getPal16(palOffs + 0x04);
            bgr5(colorTable, 8, p2);
            colorTable[11] = 0xFF;
            // Color4 is transparent black.
        }
        else if (palMode === 1) {
            // PTY=1, A=0
            // Color3 is a blend of Color1/Color2.
            colorTable[8] = (colorTable[0] + colorTable[4]) >>> 1;
            colorTable[9] = (colorTable[1] + colorTable[5]) >>> 1;
            colorTable[10] = (colorTable[2] + colorTable[6]) >>> 1;
            colorTable[11] = 0xFF;
            // Color4 is transparent black.
        }
        else if (palMode === 2) {
            // PTY=0, A=1
            const p2 = getPal16(palOffs + 0x04);
            bgr5(colorTable, 8, p2);
            colorTable[11] = 0xFF;
            const p3 = getPal16(palOffs + 0x06);
            bgr5(colorTable, 12, p3);
            colorTable[15] = 0xFF;
        }
        else {
            colorTable[8] = s3tcblend(colorTable[4], colorTable[0]);
            colorTable[9] = s3tcblend(colorTable[5], colorTable[1]);
            colorTable[10] = s3tcblend(colorTable[6], colorTable[2]);
            colorTable[11] = 0xFF;
            colorTable[12] = s3tcblend(colorTable[0], colorTable[4]);
            colorTable[13] = s3tcblend(colorTable[1], colorTable[5]);
            colorTable[14] = s3tcblend(colorTable[2], colorTable[6]);
            colorTable[15] = 0xFF;
        }
        return colorTable;
    }
    const pixels = new Uint8Array(width * height * 4);
    const texView = texData;
    const palIdxView = palIdxData;
    const palView = palData;
    let srcOffs = 0;
    for (let yy = 0; yy < height; yy += 4) {
        for (let xx = 0; xx < width; xx += 4) {
            // let texBlock = texView.getUint32((srcOffs * 0x04), true);
            let texBlock = texView.readUint32(srcOffs * 0x04);
            //const palBlock = palIdxView.getUint16((srcOffs * 0x02), true);
            const palBlock = palIdxView.readUint16(srcOffs * 0x02);
            const colorTable = buildColorTable(palBlock);
            for (let y = 0; y < 4; y++) {
                for (let x = 0; x < 4; x++) {
                    const colorIdx = texBlock & 0x03;
                    const dstOffs = 4 * (((yy + y) * width) + xx + x);
                    pixels[dstOffs + 0] = colorTable[colorIdx * 4 + 0];
                    pixels[dstOffs + 1] = colorTable[colorIdx * 4 + 1];
                    pixels[dstOffs + 2] = colorTable[colorIdx * 4 + 2];
                    pixels[dstOffs + 3] = colorTable[colorIdx * 4 + 3];
                    texBlock >>= 2;
                }
            }
            srcOffs++;
        }
    }
    return pixels;
}
function bgr5(pixels, dstOffs, p) {
    pixels[dstOffs + 0] = expand5to8(p & 0x1F);
    pixels[dstOffs + 1] = expand5to8((p >>> 5) & 0x1F);
    pixels[dstOffs + 2] = expand5to8((p >>> 10) & 0x1F);
}
function expand5to8(n) {
    return (n << (8 - 5)) | (n >>> (10 - 8));
}
function s3tcblend(a, b) {
    return (((a << 1) + a) + ((b << 2) + b)) >>> 3;
}

// http://problemkaputt.de/gbatek.htm#ds3dtextureformats
class TextureFormats {
    // Format 1
    static parseA3I5(texRaw, palRaw, width, height, firstColorTransparent) {
        // Texture Format: 8 bits per texel
        // IIIIIAAA
        // I: Palette Index
        // A: Alpha
        // Palette Format: RGBA5551, 2 bytes per texel
        const tex = new Uint8Array(width * height * 4);
        for (let i = 0; i < texRaw.length; i++) {
            const texel = texRaw.readUint8(i);
            const index = texel & 0b00011111;
            const alpha = (texel & 0b11100000) >> 5;
            const color = palRaw.readUint16(index * 2);
            tex[i * 4 + 0] = this.color5to8((color >> 0) & 0x1F);
            tex[i * 4 + 1] = this.color5to8((color >> 5) & 0x1F);
            tex[i * 4 + 2] = this.color5to8((color >> 10) & 0x1F);
            // The DS expands the 3-bit alpha value to 5 bits like this: alpha = (alpha * 4) + (alpha / 2)
            // Simplified: alpha = (9/2 * alpha)
            // In order to convert it to 8-bit alpha, we do something similar:
            // alpha = (255/7 * alpha)
            // This isn't 100% accurate due to rounding, but there's no way to get a perfect result
            tex[i * 4 + 3] = Math.floor((255 / 7) * alpha);
        }
        return tex;
    }
    // Format 2
    static parsePalette4(texRaw, palRaw, width, height, firstColorTransparent) {
        // Texture Format: 2 bits per texel
        // Palette Format: RGBA5551, 2 bytes per texel
        // Alpha values don't seem to be used
        const tex = new Uint8Array(width * height * 4);
        for (let i = 0; i < texRaw.length; i++) {
            const texels = texRaw.readUint8(i);
            const texel1 = texels & 0b00000011;
            const texel2 = (texels & 0b00001100) >> 2;
            const texel3 = (texels & 0b00110000) >> 4;
            const texel4 = (texels & 0b11000000) >> 6;
            const color1 = palRaw.readUint16(texel1 * 2);
            const color2 = palRaw.readUint16(texel2 * 2);
            const color3 = palRaw.readUint16(texel3 * 2);
            const color4 = palRaw.readUint16(texel4 * 2);
            tex[i * 16 + 0] = this.color5to8((color1 >> 0) & 0x1F);
            tex[i * 16 + 1] = this.color5to8((color1 >> 5) & 0x1F);
            tex[i * 16 + 2] = this.color5to8((color1 >> 10) & 0x1F);
            tex[i * 16 + 3] = 255;
            tex[i * 16 + 4] = this.color5to8((color2 >> 0) & 0x1F);
            tex[i * 16 + 5] = this.color5to8((color2 >> 5) & 0x1F);
            tex[i * 16 + 6] = this.color5to8((color2 >> 10) & 0x1F);
            tex[i * 16 + 7] = 255;
            tex[i * 16 + 8] = this.color5to8((color3 >> 0) & 0x1F);
            tex[i * 16 + 9] = this.color5to8((color3 >> 5) & 0x1F);
            tex[i * 16 + 10] = this.color5to8((color3 >> 10) & 0x1F);
            tex[i * 16 + 11] = 255;
            tex[i * 16 + 12] = this.color5to8((color4 >> 0) & 0x1F);
            tex[i * 16 + 13] = this.color5to8((color4 >> 5) & 0x1F);
            tex[i * 16 + 14] = this.color5to8((color4 >> 10) & 0x1F);
            tex[i * 16 + 15] = 255;
            if (firstColorTransparent) {
                if (texel1 === 0) {
                    tex[i * 16 + 3] = 0;
                }
                if (texel2 === 0) {
                    tex[i * 16 + 7] = 0;
                }
                if (texel3 === 0) {
                    tex[i * 16 + 11] = 0;
                }
                if (texel4 === 0) {
                    tex[i * 16 + 15] = 0;
                }
            }
        }
        return tex;
    }
    // Format 3
    static parsePalette16(texRaw, palRaw, width, height, firstColorTransparent) {
        // Texture Format: 4 bits per texel
        // Palette Format: RGBA5551, 2 bytes per texel
        // Alpha values don't seem to be used
        const tex = new Uint8Array(width * height * 4);
        for (let i = 0; i < texRaw.length; i++) {
            const texels = texRaw.readUint8(i);
            const texel1 = texels & 0x0F;
            const texel2 = (texels & 0xF0) >> 4;
            const color1 = palRaw.readUint16(texel1 * 2);
            const color2 = palRaw.readUint16(texel2 * 2);
            tex[i * 8 + 0] = this.color5to8((color1 >> 0) & 0x1F);
            tex[i * 8 + 1] = this.color5to8((color1 >> 5) & 0x1F);
            tex[i * 8 + 2] = this.color5to8((color1 >> 10) & 0x1F);
            tex[i * 8 + 3] = 255;
            if (firstColorTransparent && texel1 === 0) {
                tex[i * 8 + 3] = 0;
            }
            tex[i * 8 + 4] = this.color5to8((color2 >> 0) & 0x1F);
            tex[i * 8 + 5] = this.color5to8((color2 >> 5) & 0x1F);
            tex[i * 8 + 6] = this.color5to8((color2 >> 10) & 0x1F);
            tex[i * 8 + 7] = 255;
            if (firstColorTransparent && texel2 === 0) {
                tex[i * 8 + 7] = 0;
            }
        }
        return tex;
    }
    // Format 4
    static parsePalette256(texRaw, palRaw, width, height, firstColorTransparent) {
        // Texture Format: 8 bits per texel
        // Palette Format: RGBA5551, 2 bytes per texel
        // Alpha values don't seem to be used
        const tex = new Uint8Array(width * height * 4);
        for (let i = 0; i < texRaw.length; i++) {
            const texel = texRaw.readUint8(i);
            const color = palRaw.readUint16(texel * 2);
            tex[i * 4 + 0] = this.color5to8((color >> 0) & 0x1F);
            tex[i * 4 + 1] = this.color5to8((color >> 5) & 0x1F);
            tex[i * 4 + 2] = this.color5to8((color >> 10) & 0x1F);
            tex[i * 4 + 3] = 255;
            if (firstColorTransparent && texel === 0) {
                tex[i * 4 + 3] = 0;
            }
        }
        return tex;
    }
    // Format 5
    static parseCompressed4x4(texRaw, palRaw, palIdxData, width, height) {
        return readTexture_CMPR_4x4(width, height, texRaw, palIdxData, palRaw);
    }
    // Format 6
    static parseA5I3(texRaw, palRaw, width, height, firstColorTransparent) {
        // Texture Format: 8 bits per texel
        // IIIAAAAA
        // I: Palette Index
        // A: Alpha
        // Palette Format: RGBA5551, 2 bytes per texel
        const tex = new Uint8Array(width * height * 4);
        for (let i = 0; i < texRaw.length; i++) {
            const texel = texRaw.readUint8(i);
            const index = texel & 0b00000111;
            const alpha = (texel & 0b11111000) >> 3;
            const color = palRaw.readInt16(index * 2);
            tex[i * 4 + 0] = this.color5to8((color >> 0) & 0x1F);
            tex[i * 4 + 1] = this.color5to8((color >> 5) & 0x1F);
            tex[i * 4 + 2] = this.color5to8((color >> 10) & 0x1F);
            // Expand 5-bit alpha to 8-bit
            tex[i * 4 + 3] = Math.floor(255 / 31 * alpha);
        }
        return tex;
    }
    // Format 7
    static parseDirectColor(texRaw, width, height) {
        // Texture Format: RGBA5551, 2 bytes per texel
        const tex = new Uint8Array(width * height * 4);
        for (let i = 0; i < texRaw.length; i += 2) {
            const color = texRaw.readUint16(i);
            tex[i * 2 + 0] = this.color5to8((color >> 0) & 0x1F);
            tex[i * 2 + 1] = this.color5to8((color >> 5) & 0x1F);
            tex[i * 2 + 2] = this.color5to8((color >> 10) & 0x1F);
            tex[i * 2 + 3] = ((color >> 15) & 0x01) << 7;
        }
        return tex;
    }
    static color5to8(value) {
        return Math.floor(255 / 31 * value);
    }
}

class TEX0 {
    constructor(raw) {
        this.raw = raw;
        this.header = new TEX0Header(raw.slice(0, 0x40));
        if (this.header.magic !== "TEX0") {
            throw new Error("Invalid TEX0 magic");
        }
        this.textureInfo = new TextureInfoSection(raw.slice(this.header.textureInfoOffset));
        this.paletteInfo = new PaletteInfoSection(raw.slice(this.header.paletteInfoOffset));
    }
    parseTexture(texIndex, palIndex = texIndex) {
        const textureInfo = this.textureInfo.entries[texIndex];
        switch (textureInfo.format) {
            case 1: {
                // A3I5
                const texOffset = this.header.textureDataOffset + textureInfo.textureOffset;
                const texSize = textureInfo.width * textureInfo.height;
                const texRaw = this.raw.slice(texOffset, texOffset + texSize);
                const paletteInfo = this.paletteInfo.entries[palIndex];
                const paletteOffset = this.header.paletteDataOffset + paletteInfo.paletteOffset;
                const palRaw = this.raw.slice(paletteOffset, paletteOffset + 0x40);
                return TextureFormats.parseA3I5(texRaw, palRaw, textureInfo.width, textureInfo.height, textureInfo.firstColorTransparent);
            }
            case 2: {
                // 4-Color Palette
                const texOffset = this.header.textureDataOffset + textureInfo.textureOffset;
                const texSize = textureInfo.width * textureInfo.height / 4;
                const texRaw = this.raw.slice(texOffset, texOffset + texSize);
                const paletteInfo = this.paletteInfo.entries[palIndex];
                const paletteOffset = this.header.paletteDataOffset + paletteInfo.paletteOffset;
                const palRaw = this.raw.slice(paletteOffset, paletteOffset + 0x08);
                return TextureFormats.parsePalette4(texRaw, palRaw, textureInfo.width, textureInfo.height, textureInfo.firstColorTransparent);
            }
            case 3: {
                // 16-Color Palette
                const texOffset = this.header.textureDataOffset + textureInfo.textureOffset;
                const texSize = textureInfo.width * textureInfo.height / 2;
                const texRaw = this.raw.slice(texOffset, texOffset + texSize);
                const paletteInfo = this.paletteInfo.entries[palIndex];
                const paletteOffset = this.header.paletteDataOffset + paletteInfo.paletteOffset;
                const palRaw = this.raw.slice(paletteOffset, paletteOffset + 0x20);
                return TextureFormats.parsePalette16(texRaw, palRaw, textureInfo.width, textureInfo.height, textureInfo.firstColorTransparent);
            }
            case 4: {
                // 256-Color Palette
                const texOffset = this.header.textureDataOffset + textureInfo.textureOffset;
                const texSize = textureInfo.width * textureInfo.height;
                const texRaw = this.raw.slice(texOffset, texOffset + texSize);
                const paletteInfo = this.paletteInfo.entries[palIndex];
                const paletteOffset = this.header.paletteDataOffset + paletteInfo.paletteOffset;
                const palRaw = this.raw.slice(paletteOffset, paletteOffset + 0x200);
                return TextureFormats.parsePalette256(texRaw, palRaw, textureInfo.width, textureInfo.height, textureInfo.firstColorTransparent);
            }
            case 5: {
                // Compressed 4x4 Texel
                // Please don't ask me how this works because I don't know either
                // I just changed some values until it somehow worked
                const texOffset = this.header.textureDataOffset + textureInfo.textureOffset;
                const texSize = textureInfo.width * textureInfo.height / 2;
                const texRaw = this.raw.slice(texOffset, texOffset + texSize);
                const paletteInfo = this.paletteInfo.entries[palIndex];
                const paletteOffset = this.header.paletteDataOffset + paletteInfo.paletteOffset;
                const palRaw = this.raw.slice(paletteOffset);
                // Compressed 4x4 Texels have a second buffer after the texture data that contains the palette indices
                const palIdxOffset = this.header.compressedTextureInfoDataOffset + textureInfo.textureOffset / 2;
                const palIdxSize = (textureInfo.width * textureInfo.height) / 2;
                const palIdxData = this.raw.slice(palIdxOffset, palIdxOffset + palIdxSize);
                return TextureFormats.parseCompressed4x4(texRaw, palRaw, palIdxData, textureInfo.width, textureInfo.height);
            }
            case 6: {
                // A5I3
                const texOffset = this.header.textureDataOffset + textureInfo.textureOffset;
                const texSize = textureInfo.width * textureInfo.height;
                const texRaw = this.raw.slice(texOffset, texOffset + texSize);
                const paletteInfo = this.paletteInfo.entries[palIndex];
                const paletteOffset = this.header.paletteDataOffset + paletteInfo.paletteOffset;
                const palRaw = this.raw.slice(paletteOffset, paletteOffset + 0x10);
                return TextureFormats.parseA5I3(texRaw, palRaw, textureInfo.width, textureInfo.height, textureInfo.firstColorTransparent);
            }
            case 7: {
                // Direct Color
                const texOffset = this.header.textureDataOffset + textureInfo.textureOffset;
                const texSize = textureInfo.width * textureInfo.height * 2;
                const texRaw = this.raw.slice(texOffset, texOffset + texSize);
                return TextureFormats.parseDirectColor(texRaw, textureInfo.width, textureInfo.height);
            }
            default:
                throw new Error(`Unsupported texture format: ${textureInfo.format}`);
        }
    }
}

// http://llref.emutalk.net/docs/?file=xml/btx0.xml#xml-doc
class BTX0Header {
    constructor(raw) {
        // 0x00 (4 bytes): Magic "BTX0"
        this.magic = raw.readChars(0x00, 4);
        // 0x04 (4 bytes): Constant 0x0001FEFF
        // 0x08 (4 bytes): File size
        this.fileSize = raw.readUint32(0x08);
        // 0x0C (2 bytes): Header size (0x10)
        // 0x0E (2 bytes): Number of textures (0x01)
        // 0x10 (4 bytes): TEX0 offset
        this.texOffset = raw.readUint32(0x10);
    }
}

class BTX0 {
    constructor(raw) {
        this.header = new BTX0Header(raw.slice(0, 0x14));
        if (this.header.magic !== "BTX0") {
            throw new Error("Invalid BTX0 magic");
        }
        this.tex = new TEX0(raw.slice(this.header.texOffset));
    }
}

class NCL {
    constructor(raw, offset = 0) {
        this.raw = raw;
        this.offset = offset;
    }
    colorAt(index) {
        const color = this.raw.slice(index * 2 + this.offset, index * 2 + 2 + this.offset);
        const r = this.color5to8(color[0] & 0x1F);
        const g = this.color5to8((color[0] >> 5) | ((color[1] & 0x3) << 3));
        const b = this.color5to8(color[1] >> 2);
        return new Uint8Array([r, g, b, 255]);
    }
    colors() {
        const colors = new Uint8Array((this.raw.length - this.offset) / 2 * 4);
        for (let i = 0; i < this.raw.length / 2; i++) {
            const color = this.colorAt(i);
            colors[i * 4 + 0] = color[0];
            colors[i * 4 + 1] = color[1];
            colors[i * 4 + 2] = color[2];
            colors[i * 4 + 3] = color[3];
        }
        return colors;
    }
    get length() {
        return (this.raw.length - this.offset) / 2;
    }
    color5to8(value) {
        return Math.floor(255 / 31 * value);
    }
}

class NCG {
    constructor(raw, offset = 0) {
        this.raw = raw;
        this.offset = offset;
    }
    parse(ncl, paletteIndex = 0) {
        const image = new Uint8Array(this.raw.length - this.offset);
        for (let i = 0; i < image.length; i++) {
            const colorIndex = this.raw[i + this.offset];
            const color = ncl.colorAt(paletteIndex * 16 + colorIndex);
            image[i * 4 + 0] = color[0];
            image[i * 4 + 1] = color[1];
            image[i * 4 + 2] = color[2];
            image[i * 4 + 3] = color[3];
        }
        return image;
    }
    get length() {
        return this.raw.length - this.offset;
    }
}

// https://gota7.github.io/NitroStudio2/specs/common.html
class Block {
    constructor(raw, assertMagic) {
        // 0x00 (4 bytes) - Magic
        this.magic = raw.readChars(0x00, 4);
        if (assertMagic && this.magic !== assertMagic) {
            throw new Error(`Invalid magic: ${this.magic} (expected ${assertMagic})`);
        }
        // 0x04 (4 bytes) - Size
        this.size = raw.readUint32(0x04);
    }
}

// https://gota7.github.io/NitroStudio2/specs/common.html
class SoundFileHeader {
    constructor(raw, assertMagic) {
        // 0x00 (4 bytes) - Magic
        this.magic = raw.readChars(0x00, 4);
        if (assertMagic && this.magic !== assertMagic) {
            throw new Error(`Invalid magic: ${this.magic} (expected ${assertMagic})`);
        }
        // 0x04 (2 bytes) - Endianness (0xFEFF)
        this.endianness = raw.readUint16(0x04);
        // 0x06 (2 bytes) - Version (0x0100)
        // 0x08 (4 bytes) - File size
        this.fileSize = raw.readUint32(0x08);
        // 0x0C (2 bytes) - Header size
        this.headerSize = raw.readUint16(0x0C);
        // 0x0E (2 bytes) - Number of blocks
        this.blockCount = raw.readUint16(0x0E);
    }
}

class TableEntry {
    constructor(raw) {
    }
}
class Table {
    constructor(raw, type) {
        // Table header
        // 0x00 (4 bytes): Number of entries
        const entryCount = raw.readUint32(0x00);
        // Read entries
        this.entries = [];
        let offset = 4;
        for (let i = 0; i < entryCount; i++) {
            const entry = new type(raw.slice(offset));
            this.entries.push(entry);
            offset += entry.length;
        }
    }
}
class Uint32TableEntry extends TableEntry {
    constructor(raw) {
        super(raw);
        this.length = 0x04;
        // 0x00 (4 bytes): Value
        this.value = raw.readUint32(0x00);
    }
}

var EncodingType;
(function (EncodingType) {
    EncodingType[EncodingType["PCM8"] = 0] = "PCM8";
    EncodingType[EncodingType["PCM16"] = 1] = "PCM16";
    EncodingType[EncodingType["IMA_ADPCM"] = 2] = "IMA_ADPCM";
})(EncodingType || (EncodingType = {}));
class Encoding {
    static toPCM(raw, encoding) {
        switch (encoding) {
            case EncodingType.PCM8:
                return this.PCM8toPCM(raw);
            case EncodingType.PCM16:
                return this.PCM16toPCM(raw);
            case EncodingType.IMA_ADPCM:
                return this.IMA_ADPCMtoPCM(raw);
            default:
                throw new Error("Unknown encoding type");
        }
    }
    static PCM8toPCM(raw) {
        let buffer = new Float32Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
            buffer[i] = raw.readInt8(i) / 128;
        }
        return buffer;
    }
    static PCM16toPCM(raw) {
        let buffer = new Float32Array(raw.length / 2);
        for (let i = 0; i < raw.length / 2; i++) {
            buffer[i] = raw.readInt16(i * 2) / 32768;
        }
        return buffer;
    }
    static IMA_ADPCMtoPCM(raw) {
        let buffer = new Float32Array(raw.length * 2 - 8);
        let destOff = 0;
        let decompSample = raw.readInt16(0);
        let stepIndex = raw.readUint16(2) & 0x7F;
        let currentOffset = 4;
        buffer[destOff++] = decompSample / 32768;
        let compByte;
        while (currentOffset < raw.length) {
            compByte = raw.readUint8(currentOffset++);
            const result1 = this.processNibble(compByte & 0x0F, stepIndex, decompSample);
            decompSample = result1.decompSample;
            stepIndex = result1.stepIndex;
            buffer[destOff++] = decompSample / 32768;
            const result2 = this.processNibble((compByte & 0xF0) >> 4, stepIndex, decompSample);
            decompSample = result2.decompSample;
            stepIndex = result2.stepIndex;
            buffer[destOff++] = decompSample / 32768;
        }
        return buffer;
    }
    static processNibble(nibble, stepIndex, decompSample) {
        function min(sample) {
            return (sample > 0x7FFF) ? 0x7FFF : sample;
        }
        function max(sample) {
            return (sample < -0x7FFF) ? -0x7FFF : sample;
        }
        function minmax(index, min, max) {
            return (index > max) ? max : ((index < min) ? min : index);
        }
        let diff = Math.floor(this.adpcmStepTable[stepIndex] / 8);
        if (nibble & 1)
            diff += Math.floor(this.adpcmStepTable[stepIndex] / 4);
        if (nibble & 2)
            diff += Math.floor(this.adpcmStepTable[stepIndex] / 2);
        if (nibble & 4)
            diff += Math.floor(this.adpcmStepTable[stepIndex]);
        if ((nibble & 8) == 0) {
            decompSample = max(decompSample + diff);
        }
        if ((nibble & 8) == 8) {
            decompSample = min(decompSample - diff);
        }
        stepIndex = minmax(stepIndex + this.adpcmIndexTable[nibble & 7], 0, 88);
        return { decompSample, stepIndex };
    }
}
Encoding.adpcmIndexTable = [
    -1, -1, -1, -1, 2, 4, 6, 8
];
Encoding.adpcmStepTable = [
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17,
    19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
    50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
    130, 143, 157, 173, 190, 209, 230, 253, 279, 307,
    337, 371, 408, 449, 494, 544, 598, 658, 724, 796,
    876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066,
    2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358,
    5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899,
    15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767
];

// https://gota7.github.io/NitroStudio2/specs/soundData.html#info-block
class SequenceInfo {
    constructor(raw) {
        this.fileId = raw.readUint32(0x00);
        this.bankId = raw.readUint16(0x04);
        this.volume = raw.readUint8(0x06);
        this.channelPriority = raw.readUint8(0x07);
        this.playerPriority = raw.readUint8(0x08);
        this.playerId = raw.readUint8(0x09);
    }
}
class SequenceArchiveInfo {
    constructor(raw) {
        this.fileId = raw.readUint32(0x00);
    }
}
class BankInfo {
    constructor(raw) {
        this.fileId = raw.readUint32(0x00);
        this.waveArchives = new Array(4);
        this.waveArchives[0] = raw.readInt16(0x04);
        this.waveArchives[1] = raw.readInt16(0x06);
        this.waveArchives[2] = raw.readInt16(0x08);
        this.waveArchives[3] = raw.readInt16(0x0A);
    }
}
class WaveArchiveInfo {
    constructor(raw) {
        // File ID in form 0xLLFFFFFF where F is the file ID and L is a bool to indicate that the archive should be loaded individually
        const value = raw.readUint32(0x00);
        this.fileId = value & 0x00FFFFFF;
        this.loadIndividually = (value & 0xFF000000) !== 0;
    }
}
class PlayerInfo {
    constructor(raw) {
        this.maxVoices = raw.readUint16(0x00);
        this.channels = raw.readUint16(0x02);
        this.heapSize = raw.readUint32(0x04);
    }
}
class GroupInfo {
    constructor(raw) {
        const table = new Table(raw, GroupEntry);
        this.entries = table.entries;
    }
}
class GroupEntry extends TableEntry {
    constructor(raw) {
        super(raw);
        this.length = 0x08;
        this.type = raw.readUint8(0x00);
        this.load = raw.readUint8(0x01);
        // Padding (2 bytes)
        this.entryId = raw.readUint32(0x04);
    }
}
var GroupEntryType;
(function (GroupEntryType) {
    GroupEntryType[GroupEntryType["Sequence"] = 0] = "Sequence";
    GroupEntryType[GroupEntryType["Bank"] = 1] = "Bank";
    GroupEntryType[GroupEntryType["WaveArchive"] = 2] = "WaveArchive";
    GroupEntryType[GroupEntryType["SequenceArchive"] = 3] = "SequenceArchive";
})(GroupEntryType || (GroupEntryType = {}));
class StreamPlayerInfo {
    constructor(raw) {
        this.channelCount = raw.readUint8(0x00);
        this.leftOrMonoChannel = raw.readUint8(0x01);
        this.rightChannel = raw.readUint8(0x02);
    }
}
class StreamInfo {
    constructor(raw) {
        // File ID in form 0xLLFFFFFF where F is the file ID and L is a bool to indicate that the stream should be converted to stereo
        const value = raw.readUint32(0x00);
        this.fileId = value & 0x00FFFFFF;
        this.convertToStereo = (value & 0xFF000000) !== 0;
        this.volume = raw.readUint8(0x04);
        this.priority = raw.readUint8(0x05);
        this.playerId = raw.readUint8(0x06);
    }
}

// https://gota7.github.io/NitroStudio2/specs/soundData.html#info-block
class InfoBlock extends Block {
    constructor(raw) {
        super(raw, "INFO");
        function readTable(offset, fileInfoType) {
            const fileInfos = [];
            const tableOffset = raw.readUint32(offset);
            const table = new Table(raw.slice(tableOffset), Uint32TableEntry);
            for (let i = 0; i < table.entries.length; i++) {
                const entry = table.entries[i];
                if (entry.value === 0) {
                    continue;
                }
                const infoOffset = entry.value;
                const info = new fileInfoType(raw.slice(infoOffset));
                fileInfos[i] = info;
            }
            return fileInfos;
        }
        this.sequenceInfo = readTable(0x08, SequenceInfo);
        this.sequenceArchiveInfo = readTable(0x0C, SequenceArchiveInfo);
        this.bankInfo = readTable(0x10, BankInfo);
        this.waveArchiveInfo = readTable(0x14, WaveArchiveInfo);
        this.playerInfo = readTable(0x18, PlayerInfo);
        this.groupInfo = readTable(0x1C, GroupInfo);
        this.streamPlayerInfo = readTable(0x20, StreamPlayerInfo);
        this.streamInfo = readTable(0x24, StreamInfo);
    }
}

// https://gota7.github.io/NitroStudio2/specs/soundData.html#symbol-block
class SymbolBlock extends Block {
    constructor(raw) {
        super(raw, "SYMB");
        function getSymbols(offset, direct = false) {
            let symbols = [];
            let tableOffset;
            if (direct) {
                tableOffset = offset;
            }
            else {
                tableOffset = raw.readUint32(offset);
            }
            const table = new Table(raw.slice(tableOffset), Uint32TableEntry);
            for (let i = 0; i < table.entries.length; i++) {
                const entry = table.entries[i];
                if (entry.value === 0) {
                    continue;
                }
                const symbolOffset = entry.value;
                const symbol = raw.readString(symbolOffset);
                symbols[i] = symbol;
            }
            return symbols;
        }
        function getSSARSymbols(offset) {
            let symbols = [];
            const tableOffset = raw.readUint32(offset);
            const table = new Table(raw.slice(tableOffset), SSARSymbolEntry);
            for (let i = 0; i < table.entries.length; i++) {
                const entry = table.entries[i];
                if (entry.archiveSymbolOffset === 0 || entry.sequenceTableOffset === 0) {
                    continue;
                }
                let symbol = {
                    archiveName: raw.readString(entry.archiveSymbolOffset),
                    sequenceNames: getSymbols(entry.sequenceTableOffset, true)
                };
                symbols[i] = symbol;
            }
            return symbols;
        }
        this.sequenceSymbols = getSymbols(0x08);
        this.sequenceArchiveSymbols = getSSARSymbols(0x0C);
        this.bankSymbols = getSymbols(0x10);
        this.waveArchiveSymbols = getSymbols(0x14);
        this.playerSymbols = getSymbols(0x18);
        this.groupSymbols = getSymbols(0x1C);
        this.streamPlayerSymbols = getSymbols(0x20);
        this.streamSymbols = getSymbols(0x24);
    }
}
class SSARSymbolEntry extends TableEntry {
    constructor(raw) {
        super(raw);
        this.length = 0x08;
        // 0x00 (4 bytes): Archive Symbol Offset
        this.archiveSymbolOffset = raw.readUint32(0x00);
        // 0x04 (4 bytes): Sequence Symbol Table Offsets
        this.sequenceTableOffset = raw.readUint32(0x04);
    }
}

class FATBlock extends Block {
    constructor(raw) {
        super(raw, "FAT ");
        const table = new Table(raw.slice(0x08), FileTableEntry);
        this.entries = table.entries;
    }
}
class FileTableEntry extends TableEntry {
    constructor(raw) {
        super(raw);
        this.length = 0x10;
        this.offset = raw.readUint32(0x00);
        this.size = raw.readUint32(0x04);
    }
}

class SDATFS {
    constructor(raw, header) {
        let symbolBlock;
        if (header.symbolBlockSize > 0) {
            symbolBlock = new SymbolBlock(raw.slice(header.symbolBlockOffset, header.symbolBlockOffset + header.symbolBlockSize));
        }
        this.infoBlock = new InfoBlock(raw.slice(header.infoBlockOffset, header.infoBlockOffset + header.infoBlockSize));
        const fatBlock = new FATBlock(raw.slice(header.fileAllocationBlockOffset, header.fileAllocationBlockOffset + header.fileAllocationBlockSize));
        function collectFiles(symbols, infos) {
            let files = [];
            for (let i = 0; i < infos.length; i++) {
                const info = infos[i];
                if (info) {
                    const name = symbols ? symbols[i] : null;
                    const fatEntry = fatBlock.entries[info.fileId];
                    const buffer = raw.slice(fatEntry.offset, fatEntry.offset + fatEntry.size);
                    files.push(new SoundFile(name, info, i, buffer));
                }
            }
            return files;
        }
        function collectSSARFiles(symbols, infos) {
            let files = [];
            for (let i = 0; i < infos.length; i++) {
                const info = infos[i];
                if (info) {
                    const name = symbols ? symbols[i].archiveName : null;
                    const sequenceNames = symbols ? symbols[i].sequenceNames : null;
                    const fatEntry = fatBlock.entries[info.fileId];
                    const buffer = raw.slice(fatEntry.offset, fatEntry.offset + fatEntry.size);
                    files.push(new SequenceArchiveFile(name, info, i, buffer, sequenceNames));
                }
            }
            return files;
        }
        this.sequences = collectFiles(symbolBlock ? symbolBlock.sequenceSymbols : null, this.infoBlock.sequenceInfo);
        this.sequenceArchives = collectSSARFiles(symbolBlock ? symbolBlock.sequenceArchiveSymbols : null, this.infoBlock.sequenceArchiveInfo);
        this.banks = collectFiles(symbolBlock ? symbolBlock.bankSymbols : null, this.infoBlock.bankInfo);
        this.waveArchives = collectFiles(symbolBlock ? symbolBlock.waveArchiveSymbols : null, this.infoBlock.waveArchiveInfo);
        this.streams = collectFiles(symbolBlock ? symbolBlock.streamSymbols : null, this.infoBlock.streamInfo);
    }
}
class SoundFile {
    constructor(name, fileInfo, id, buffer) {
        this.name = name;
        this.fileInfo = fileInfo;
        this.id = id;
        this.buffer = buffer;
    }
}
class SequenceArchiveFile extends SoundFile {
    constructor(name, fileInfo, id, buffer, sequenceSymbols) {
        super(name, fileInfo, id, buffer);
        this.sequenceSymbols = sequenceSymbols;
    }
}

// https://gota7.github.io/NitroStudio2/specs/soundData.html
class SDATHeader extends SoundFileHeader {
    constructor(raw) {
        super(raw, "SDAT");
        // 0x10 (4 bytes) - Offset to Symbol block
        this.symbolBlockOffset = raw.readUint32(0x10);
        // 0x14 (4 bytes) - Symbol block size
        this.symbolBlockSize = raw.readUint32(0x14);
        // 0x18 (4 bytes) - Offset to Info block
        this.infoBlockOffset = raw.readUint32(0x18);
        // 0x1C (4 bytes) - Info block size
        this.infoBlockSize = raw.readUint32(0x1C);
        // 0x20 (4 bytes) - Offset to File Allocation block
        this.fileAllocationBlockOffset = raw.readUint32(0x20);
        // 0x24 (4 bytes) - File Allocation block size
        this.fileAllocationBlockSize = raw.readUint32(0x24);
        // 0x28 (4 bytes) - Offset to File block
        this.fileBlockOffset = raw.readUint32(0x28);
        // 0x2C (4 bytes) - File block size
        this.fileBlockSize = raw.readUint32(0x2C);
    }
}

/**
 * Sound Data, contains audio files.
 */
class SDAT {
    constructor(raw) {
        this.header = new SDATHeader(raw);
        this.fs = new SDATFS(raw, this.header);
    }
}

// https://gota7.github.io/NitroStudio2/specs/sequence.html#sequence-commands
// http://www.feshrine.net/hacking/doc/nds-sdat.php#sseq
var CommandType;
(function (CommandType) {
    CommandType[CommandType["Note"] = 0] = "Note";
    CommandType[CommandType["Wait"] = 128] = "Wait";
    CommandType[CommandType["ProgramChange"] = 129] = "ProgramChange";
    CommandType[CommandType["OpenTrack"] = 147] = "OpenTrack";
    CommandType[CommandType["Jump"] = 148] = "Jump";
    CommandType[CommandType["Call"] = 149] = "Call";
    CommandType[CommandType["Random"] = 160] = "Random";
    CommandType[CommandType["Variable"] = 161] = "Variable";
    CommandType[CommandType["If"] = 162] = "If";
    CommandType[CommandType["SetVariable"] = 176] = "SetVariable";
    CommandType[CommandType["AddVariable"] = 177] = "AddVariable";
    CommandType[CommandType["SubtractVariable"] = 178] = "SubtractVariable";
    CommandType[CommandType["MultiplyVariable"] = 179] = "MultiplyVariable";
    CommandType[CommandType["DivideVariable"] = 180] = "DivideVariable";
    CommandType[CommandType["ShiftVariable"] = 181] = "ShiftVariable";
    CommandType[CommandType["RandomVariable"] = 182] = "RandomVariable";
    CommandType[CommandType["CompareEqual"] = 184] = "CompareEqual";
    CommandType[CommandType["CompareGreaterOrEqual"] = 185] = "CompareGreaterOrEqual";
    CommandType[CommandType["CompareGreater"] = 186] = "CompareGreater";
    CommandType[CommandType["CompareLessOrEqual"] = 187] = "CompareLessOrEqual";
    CommandType[CommandType["CompareLess"] = 188] = "CompareLess";
    CommandType[CommandType["CompareNotEqual"] = 189] = "CompareNotEqual";
    CommandType[CommandType["Pan"] = 192] = "Pan";
    CommandType[CommandType["Volume"] = 193] = "Volume";
    CommandType[CommandType["MainVolume"] = 194] = "MainVolume";
    CommandType[CommandType["Transpose"] = 195] = "Transpose";
    CommandType[CommandType["PitchBend"] = 196] = "PitchBend";
    CommandType[CommandType["PitchBendRange"] = 197] = "PitchBendRange";
    CommandType[CommandType["Priority"] = 198] = "Priority";
    CommandType[CommandType["NoteWaitMode"] = 199] = "NoteWaitMode";
    CommandType[CommandType["Tie"] = 200] = "Tie";
    CommandType[CommandType["Portamento"] = 201] = "Portamento";
    CommandType[CommandType["ModulationDepth"] = 202] = "ModulationDepth";
    CommandType[CommandType["ModulationSpeed"] = 203] = "ModulationSpeed";
    CommandType[CommandType["ModulationType"] = 204] = "ModulationType";
    CommandType[CommandType["ModulationRange"] = 205] = "ModulationRange";
    CommandType[CommandType["PortamentoSwitch"] = 206] = "PortamentoSwitch";
    CommandType[CommandType["PortamentoTime"] = 207] = "PortamentoTime";
    CommandType[CommandType["Attack"] = 208] = "Attack";
    CommandType[CommandType["Decay"] = 209] = "Decay";
    CommandType[CommandType["Sustain"] = 210] = "Sustain";
    CommandType[CommandType["Release"] = 211] = "Release";
    CommandType[CommandType["LoopStart"] = 212] = "LoopStart";
    CommandType[CommandType["Volume2"] = 213] = "Volume2";
    CommandType[CommandType["PrintVariable"] = 214] = "PrintVariable";
    CommandType[CommandType["ModulationDelay"] = 224] = "ModulationDelay";
    CommandType[CommandType["Tempo"] = 225] = "Tempo";
    CommandType[CommandType["SweepPitch"] = 227] = "SweepPitch";
    CommandType[CommandType["LoopEnd"] = 252] = "LoopEnd";
    CommandType[CommandType["Return"] = 253] = "Return";
    CommandType[CommandType["AllocateTracks"] = 254] = "AllocateTracks";
    CommandType[CommandType["Fin"] = 255] = "Fin";
})(CommandType || (CommandType = {}));
// Thanks, Copilot
function commandTypeToString(type) {
    switch (type) {
        case CommandType.Note: return "Note";
        case CommandType.Wait: return "Wait";
        case CommandType.ProgramChange: return "ProgramChange";
        case CommandType.OpenTrack: return "OpenTrack";
        case CommandType.Jump: return "Jump";
        case CommandType.Call: return "Call";
        case CommandType.Random: return "Random";
        case CommandType.Variable: return "Variable";
        case CommandType.If: return "If";
        case CommandType.SetVariable: return "SetVariable";
        case CommandType.AddVariable: return "AddVariable";
        case CommandType.SubtractVariable: return "SubtractVariable";
        case CommandType.MultiplyVariable: return "MultiplyVariable";
        case CommandType.DivideVariable: return "DivideVariable";
        case CommandType.ShiftVariable: return "ShiftVariable";
        case CommandType.RandomVariable: return "RandomVariable";
        case CommandType.CompareEqual: return "CompareEqual";
        case CommandType.CompareGreaterOrEqual: return "CompareGreaterOrEqual";
        case CommandType.CompareGreater: return "CompareGreater";
        case CommandType.CompareLessOrEqual: return "CompareLessOrEqual";
        case CommandType.CompareLess: return "CompareLess";
        case CommandType.CompareNotEqual: return "CompareNotEqual";
        case CommandType.Pan: return "Pan";
        case CommandType.Volume: return "Volume";
        case CommandType.MainVolume: return "MainVolume";
        case CommandType.Transpose: return "Transpose";
        case CommandType.PitchBend: return "PitchBend";
        case CommandType.PitchBendRange: return "PitchBendRange";
        case CommandType.Priority: return "Priority";
        case CommandType.NoteWaitMode: return "NoteWaitMode";
        case CommandType.Tie: return "Tie";
        case CommandType.Portamento: return "PortamentoControl";
        case CommandType.ModulationDepth: return "ModulationDepth";
        case CommandType.ModulationSpeed: return "ModulationSpeed";
        case CommandType.ModulationType: return "ModulationType";
        case CommandType.ModulationRange: return "ModulationRange";
        case CommandType.PortamentoSwitch: return "PortamentoSwitch";
        case CommandType.PortamentoTime: return "PortamentoTime";
        case CommandType.Attack: return "Attack";
        case CommandType.Decay: return "Decay";
        case CommandType.Sustain: return "Sustain";
        case CommandType.Release: return "Release";
        case CommandType.LoopStart: return "LoopStart";
        case CommandType.Volume2: return "Volume2";
        case CommandType.PrintVariable: return "PrintVariable";
        case CommandType.ModulationDelay: return "ModulationDelay";
        case CommandType.Tempo: return "Tempo";
        case CommandType.SweepPitch: return "SweepPitch";
        case CommandType.LoopEnd: return "LoopEnd";
        case CommandType.Return: return "Return";
        case CommandType.AllocateTracks: return "AllocateTracks";
        case CommandType.Fin: return "Fin";
        default: return "Unknown";
    }
}

var ModType;
(function (ModType) {
    ModType[ModType["Pitch"] = 0] = "Pitch";
    ModType[ModType["Volume"] = 1] = "Volume";
    ModType[ModType["Pan"] = 2] = "Pan";
})(ModType || (ModType = {}));
class Command {
}
class OffsetCommand extends Command {
}
class NestedCommand extends Command {
}
var Commands;
(function (Commands) {
    // 0x00 - 0x7F (Note)
    class Note extends Command {
        constructor(length, note, velocity, duration) {
            super();
            this.length = length;
            this.note = note;
            this.velocity = velocity;
            this.duration = duration;
            this.type = CommandType.Note;
        }
    }
    Commands.Note = Note;
    // 0x80 (Wait)
    class Wait extends Command {
        constructor(length, duration) {
            super();
            this.length = length;
            this.duration = duration;
            this.type = CommandType.Wait;
        }
    }
    Commands.Wait = Wait;
    // 0x81 (Program Change)
    class ProgramChange extends Command {
        constructor(length, program) {
            super();
            this.length = length;
            this.program = program;
            this.type = CommandType.ProgramChange;
        }
    }
    Commands.ProgramChange = ProgramChange;
    // 0x93 (Open Track)
    class OpenTrack extends OffsetCommand {
        constructor(length, track, offset) {
            super();
            this.length = length;
            this.track = track;
            this.offset = offset;
            this.type = CommandType.OpenTrack;
        }
    }
    Commands.OpenTrack = OpenTrack;
    // 0x94 (Jump)
    class Jump extends OffsetCommand {
        constructor(offset) {
            super();
            this.offset = offset;
            this.type = CommandType.Jump;
            this.length = 0x04;
        }
    }
    Commands.Jump = Jump;
    // 0x95 (Call)
    class Call extends OffsetCommand {
        constructor(offset) {
            super();
            this.offset = offset;
            this.type = CommandType.Call;
            this.length = 0x04;
        }
    }
    Commands.Call = Call;
    // 0xA0 (Random)
    class Random extends NestedCommand {
        constructor(subCommand, min, max, length) {
            super();
            this.subCommand = subCommand;
            this.min = min;
            this.max = max;
            this.length = length;
            this.type = CommandType.Random;
        }
    }
    Commands.Random = Random;
    // 0xA1 (Variable)
    class Variable extends NestedCommand {
        constructor(subCommand, variable, length) {
            super();
            this.subCommand = subCommand;
            this.variable = variable;
            this.length = length;
            this.type = CommandType.Variable;
        }
    }
    Commands.Variable = Variable;
    // 0xA2 (If)
    class If extends NestedCommand {
        constructor(subCommand, length) {
            super();
            this.subCommand = subCommand;
            this.length = length;
            this.type = CommandType.If;
        }
    }
    Commands.If = If;
    // 0xB0 (SetVariable)
    class SetVariable extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.SetVariable;
            this.length = 0x04;
        }
    }
    Commands.SetVariable = SetVariable;
    // 0xB1 (AddVariable)
    class AddVariable extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.AddVariable;
            this.length = 0x04;
        }
    }
    Commands.AddVariable = AddVariable;
    // 0xB2 (SubtractVariable)
    class SubtractVariable extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.SubtractVariable;
            this.length = 0x04;
        }
    }
    Commands.SubtractVariable = SubtractVariable;
    // 0xB3 (MultiplyVariable)
    class MultiplyVariable extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.MultiplyVariable;
            this.length = 0x04;
        }
    }
    Commands.MultiplyVariable = MultiplyVariable;
    // 0xB4 (DivideVariable)
    class DivideVariable extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.DivideVariable;
            this.length = 0x04;
        }
    }
    Commands.DivideVariable = DivideVariable;
    // 0xB5 (ShiftVariable)
    class ShiftVariable extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.ShiftVariable;
            this.length = 0x04;
        }
    }
    Commands.ShiftVariable = ShiftVariable;
    // 0xB6 (RandomVariable)
    class RandomVariable extends Command {
        constructor(variable, max) {
            super();
            this.variable = variable;
            this.max = max;
            this.type = CommandType.RandomVariable;
            this.length = 0x04;
        }
    }
    Commands.RandomVariable = RandomVariable;
    // 0xB8 (CompareEqual)
    class CompareEqual extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.CompareEqual;
            this.length = 0x04;
        }
    }
    Commands.CompareEqual = CompareEqual;
    // 0xB9 (CompareGreaterOrEqual)
    class CompareGreaterOrEqual extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.CompareGreaterOrEqual;
            this.length = 0x04;
        }
    }
    Commands.CompareGreaterOrEqual = CompareGreaterOrEqual;
    // 0xBA (CompareGreater)
    class CompareGreater extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.CompareGreater;
            this.length = 0x04;
        }
    }
    Commands.CompareGreater = CompareGreater;
    // 0xBB (CompareLessOrEqual)
    class CompareLessOrEqual extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.CompareLessOrEqual;
            this.length = 0x04;
        }
    }
    Commands.CompareLessOrEqual = CompareLessOrEqual;
    // 0xBC (CompareLess)
    class CompareLess extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.CompareLess;
            this.length = 0x04;
        }
    }
    Commands.CompareLess = CompareLess;
    // 0xBD (CompareNotEqual)
    class CompareNotEqual extends Command {
        constructor(variable, value) {
            super();
            this.variable = variable;
            this.value = value;
            this.type = CommandType.CompareNotEqual;
            this.length = 0x04;
        }
    }
    Commands.CompareNotEqual = CompareNotEqual;
    // 0xC0 (Pan)
    class Pan extends Command {
        constructor(pan) {
            super();
            this.pan = pan;
            this.type = CommandType.Pan;
            this.length = 0x02;
        }
    }
    Commands.Pan = Pan;
    // 0xC1 (Volume)
    class Volume extends Command {
        constructor(volume) {
            super();
            this.volume = volume;
            this.type = CommandType.Volume;
            this.length = 0x02;
        }
    }
    Commands.Volume = Volume;
    // 0xC2 (Main Volume)
    class MainVolume extends Command {
        constructor(volume) {
            super();
            this.volume = volume;
            this.type = CommandType.MainVolume;
            this.length = 0x02;
        }
    }
    Commands.MainVolume = MainVolume;
    // 0xC3 (Transpose)
    class Transpose extends Command {
        constructor(transpose) {
            super();
            this.transpose = transpose;
            this.type = CommandType.Transpose;
            this.length = 0x02;
        }
    }
    Commands.Transpose = Transpose;
    // 0xC4 (Pitch Bend)
    class PitchBend extends Command {
        constructor(bend) {
            super();
            this.bend = bend;
            this.type = CommandType.PitchBend;
            this.length = 0x02;
        }
    }
    Commands.PitchBend = PitchBend;
    // 0xC5 (Pitch Bend Range)
    class PitchBendRange extends Command {
        constructor(range) {
            super();
            this.range = range;
            this.type = CommandType.PitchBendRange;
            this.length = 0x02;
        }
    }
    Commands.PitchBendRange = PitchBendRange;
    // 0xC6 (Priority)
    class Priority extends Command {
        constructor(priority) {
            super();
            this.priority = priority;
            this.type = CommandType.Priority;
            this.length = 0x02;
        }
    }
    Commands.Priority = Priority;
    // 0xC7 (Note Wait Mode)
    class NoteWaitMode extends Command {
        constructor(enabled) {
            super();
            this.enabled = enabled;
            this.type = CommandType.NoteWaitMode;
            this.length = 0x02;
        }
    }
    Commands.NoteWaitMode = NoteWaitMode;
    // 0xC8 (Tie)
    class Tie extends Command {
        constructor(enabled) {
            super();
            this.enabled = enabled;
            this.type = CommandType.Tie;
            this.length = 0x02;
        }
    }
    Commands.Tie = Tie;
    // 0xC9 (Portamento)
    class Portamento extends Command {
        constructor(key) {
            super();
            this.key = key;
            this.type = CommandType.Portamento;
            this.length = 0x02;
        }
    }
    Commands.Portamento = Portamento;
    // 0xCA (Modulation Depth)
    class ModulationDepth extends Command {
        constructor(depth) {
            super();
            this.depth = depth;
            this.type = CommandType.ModulationDepth;
            this.length = 0x02;
        }
    }
    Commands.ModulationDepth = ModulationDepth;
    // 0xCB (Modulation Speed)
    class ModulationSpeed extends Command {
        constructor(speed) {
            super();
            this.speed = speed;
            this.type = CommandType.ModulationSpeed;
            this.length = 0x02;
        }
    }
    Commands.ModulationSpeed = ModulationSpeed;
    // 0xCC (Modulation Type)
    class ModulationType extends Command {
        constructor(modType) {
            super();
            this.modType = modType;
            this.type = CommandType.ModulationType;
            this.length = 0x02;
        }
    }
    Commands.ModulationType = ModulationType;
    // 0xCD (Modulation Range)
    class ModulationRange extends Command {
        constructor(range) {
            super();
            this.range = range;
            this.type = CommandType.ModulationRange;
            this.length = 0x02;
        }
    }
    Commands.ModulationRange = ModulationRange;
    // 0xCE (Portamento Switch)
    class PortamentoSwitch extends Command {
        constructor(enabled) {
            super();
            this.enabled = enabled;
            this.type = CommandType.PortamentoSwitch;
            this.length = 0x02;
        }
    }
    Commands.PortamentoSwitch = PortamentoSwitch;
    // 0xCF (Portamento Time)
    class PortamentoTime extends Command {
        constructor(time) {
            super();
            this.time = time;
            this.type = CommandType.PortamentoTime;
            this.length = 0x02;
        }
    }
    Commands.PortamentoTime = PortamentoTime;
    // 0xD0 (Attack)
    class Attack extends Command {
        constructor(attack) {
            super();
            this.attack = attack;
            this.type = CommandType.Attack;
            this.length = 0x02;
        }
    }
    Commands.Attack = Attack;
    // 0xD1 (Decay)
    class Decay extends Command {
        constructor(decay) {
            super();
            this.decay = decay;
            this.type = CommandType.Decay;
            this.length = 0x02;
        }
    }
    Commands.Decay = Decay;
    // 0xD2 (Sustain)
    class Sustain extends Command {
        constructor(sustain) {
            super();
            this.sustain = sustain;
            this.type = CommandType.Sustain;
            this.length = 0x02;
        }
    }
    Commands.Sustain = Sustain;
    // 0xD3 (Release)
    class Release extends Command {
        constructor(release) {
            super();
            this.release = release;
            this.type = CommandType.Release;
            this.length = 0x02;
        }
    }
    Commands.Release = Release;
    // 0xD4 (Loop Start)
    class LoopStart extends Command {
        constructor(count) {
            super();
            this.count = count;
            this.type = CommandType.LoopStart;
            this.length = 0x02;
        }
    }
    Commands.LoopStart = LoopStart;
    // 0xD5 (Volume 2)
    class Volume2 extends Command {
        constructor(volume) {
            super();
            this.volume = volume;
            this.type = CommandType.Volume2;
            this.length = 0x02;
        }
    }
    Commands.Volume2 = Volume2;
    // 0xD6 (PrintVariable)
    class PrintVariable extends Command {
        constructor(variable) {
            super();
            this.variable = variable;
            this.type = CommandType.PrintVariable;
            this.length = 0x02;
        }
    }
    Commands.PrintVariable = PrintVariable;
    // 0xE0 (Modulation Delay)
    class ModulationDelay extends Command {
        constructor(delay) {
            super();
            this.delay = delay;
            this.type = CommandType.ModulationDelay;
            this.length = 0x03;
        }
    }
    Commands.ModulationDelay = ModulationDelay;
    // 0xE1 (Tempo)
    class Tempo extends Command {
        constructor(tempo) {
            super();
            this.tempo = tempo;
            this.type = CommandType.Tempo;
            this.length = 0x03;
        }
    }
    Commands.Tempo = Tempo;
    // 0xE2 (Sweep Pitch)
    class SweepPitch extends Command {
        constructor(pitch) {
            super();
            this.pitch = pitch;
            this.type = CommandType.SweepPitch;
            this.length = 0x03;
        }
    }
    Commands.SweepPitch = SweepPitch;
    // 0xED (Return)
    class Return extends Command {
        constructor() {
            super();
            this.length = 0x01;
            this.type = CommandType.Return;
        }
    }
    Commands.Return = Return;
    // 0xFC (Loop End)
    class LoopEnd extends Command {
        constructor() {
            super();
            this.length = 0x01;
            this.type = CommandType.LoopEnd;
        }
    }
    Commands.LoopEnd = LoopEnd;
    // 0xFE (Allocate Tracks)
    class AllocateTracks extends Command {
        constructor(tracks) {
            super();
            this.tracks = tracks;
            this.length = 0x03;
            this.type = CommandType.AllocateTracks;
        }
        isAllocated(track) {
            return (this.tracks & (1 << track)) != 0;
        }
    }
    Commands.AllocateTracks = AllocateTracks;
    // 0xFF (Fin)
    class Fin extends Command {
        constructor() {
            super();
            this.length = 0x01;
            this.type = CommandType.Fin;
        }
    }
    Commands.Fin = Fin;
})(Commands || (Commands = {}));

class CommandParser {
    static parseCommands(raw, length) {
        // Trim the end to remove any padding
        // Find last Fin command
        let lastFin = -1;
        for (let i = 0; i < length; i++) {
            if (raw.readUint8(i) === CommandType.Fin) {
                lastFin = i;
            }
        }
        if (lastFin !== -1) {
            length = lastFin + 1;
        }
        const commands = [];
        const offsetToIndexTable = [];
        let pos = 0;
        while (pos < length) {
            offsetToIndexTable[pos] = commands.length;
            const command = this.parseCommand(raw, pos);
            // console.log(`${pos} : ${commandTypeToString(command.type)} (${command.length})`);
            commands.push(command);
            pos += command.length;
            // Special case for Newer Super Mario Bros. DS
            // They have some data (appears to be junk data?) in between Jump and Fin commands
            // The junk data always starts with Jump, followed by 0x00
            // This needs to be skipped in order to parse the commands correctly
            if (command.type === CommandType.Jump && raw.readUint8(pos) === 0x00) {
                // Find next Fin command
                let nextFin = -1;
                for (let i = pos; i < length; i++) {
                    const commandType = raw.readUint8(i);
                    if (commandType === CommandType.Fin) {
                        nextFin = i;
                        break;
                    }
                }
                if (nextFin !== -1) {
                    // Skip the data
                    pos = nextFin;
                }
            }
        }
        // Resolve offsets
        function resolveOffset(command) {
            if (command instanceof OffsetCommand) {
                const offsetCommand = command;
                const o = offsetToIndexTable[offsetCommand.offset];
                if (o === undefined) {
                    throw new Error(`Failed to resolve offset ${offsetCommand.offset}`);
                }
                offsetCommand.offset = o;
            }
            if (command instanceof NestedCommand) {
                const nestedCommand = command;
                resolveOffset(nestedCommand.subCommand);
            }
        }
        for (let i = 0; i < commands.length; i++) {
            resolveOffset(commands[i]);
        }
        return commands;
    }
    static parseCommand(raw, pos) {
        const commandType = raw.readUint8(pos);
        // Special case for 0x00 - 0x7F (Note)
        if (commandType < 0x80) {
            const velocity = raw.readUint8(pos + 1);
            const duration = raw.readVL(pos + 2);
            return new Commands.Note(0x01 + 0x01 + duration.length, commandType, velocity, duration.value);
        }
        switch (commandType) {
            case CommandType.Wait: { // 0x80
                const wait = raw.readVL(pos + 1);
                return new Commands.Wait(0x01 + wait.length, wait.value);
            }
            case CommandType.ProgramChange: { // 0x81
                // TODO: Add bank change (is that even a thing?)
                const programAndBank = raw.readVL(pos + 1);
                // Apparently, only bits[0..7] are used for the program number
                const program = programAndBank.value & 0xFF;
                return new Commands.ProgramChange(0x01 + programAndBank.length, program);
            }
            case CommandType.OpenTrack: { // 0x93
                const track = raw.readUint8(pos + 1);
                const offset = raw.readUint24(pos + 2);
                return new Commands.OpenTrack(0x01 + 0x01 + 0x03, track, offset);
            }
            case CommandType.Jump: { // 0x94
                const offset = raw.readUint24(pos + 1);
                return new Commands.Jump(offset);
            }
            case CommandType.Call: { // 0x95
                const offset = raw.readUint24(pos + 1);
                return new Commands.Call(offset);
            }
            // TODO: Do some more testing on Random and Variable commands since I have not found them in the wild yet
            case CommandType.Random: { // 0xA0
                const subCommand = this.parseCommand(raw, pos + 1);
                const min = raw.readInt16(pos + subCommand.length + 1);
                const max = raw.readInt16(pos + subCommand.length + 3);
                return new Commands.Random(subCommand, min, max, subCommand.length + 0x04);
            }
            case CommandType.Variable: { // 0xA1
                const subCommand = this.parseCommand(raw, pos + 1);
                const variable = raw.readUint8(pos + 2);
                return new Commands.Variable(subCommand, variable, subCommand.length + 0x01);
            }
            case CommandType.If: { // 0xA2
                const subCommand = this.parseCommand(raw, pos + 1);
                return new Commands.If(subCommand, subCommand.length + 0x01);
            }
            case CommandType.SetVariable: { // 0xB0
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.SetVariable(variable, value);
            }
            case CommandType.AddVariable: { // 0xB1
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.AddVariable(variable, value);
            }
            case CommandType.SubtractVariable: { // 0xB2
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.SubtractVariable(variable, value);
            }
            case CommandType.MultiplyVariable: { // 0xB3
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.MultiplyVariable(variable, value);
            }
            case CommandType.DivideVariable: { // 0xB4
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.DivideVariable(variable, value);
            }
            case CommandType.ShiftVariable: { // 0xB5
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.ShiftVariable(variable, value);
            }
            case CommandType.RandomVariable: { // 0xB6
                const variable = raw.readUint8(pos + 1);
                const max = raw.readInt16(pos + 2);
                return new Commands.RandomVariable(variable, max);
            }
            case CommandType.CompareEqual: { // 0xB8
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.CompareEqual(variable, value);
            }
            case CommandType.CompareGreaterOrEqual: { // 0xB9
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.CompareGreaterOrEqual(variable, value);
            }
            case CommandType.CompareGreater: { // 0xBA
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.CompareGreater(variable, value);
            }
            case CommandType.CompareLessOrEqual: { // 0xBB
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.CompareLessOrEqual(variable, value);
            }
            case CommandType.CompareLess: { // 0xBC
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.CompareLess(variable, value);
            }
            case CommandType.CompareNotEqual: { // 0xBD
                const variable = raw.readUint8(pos + 1);
                const value = raw.readInt16(pos + 2);
                return new Commands.CompareNotEqual(variable, value);
            }
            case CommandType.Pan: { // 0xC0
                const pan = raw.readUint8(pos + 1);
                return new Commands.Pan(pan);
            }
            case CommandType.Volume: { // 0xC1
                const volume = raw.readUint8(pos + 1);
                return new Commands.Volume(volume);
            }
            case CommandType.MainVolume: { // 0xC2
                const volume = raw.readUint8(pos + 1);
                return new Commands.MainVolume(volume);
            }
            case CommandType.Transpose: { // 0xC3
                const transpose = raw.readInt8(pos + 1);
                return new Commands.Transpose(transpose);
            }
            case CommandType.PitchBend: { // 0xC4
                const bend = raw.readInt8(pos + 1);
                return new Commands.PitchBend(bend);
            }
            case CommandType.PitchBendRange: { // 0xC5
                const range = raw.readUint8(pos + 1);
                return new Commands.PitchBendRange(range);
            }
            case CommandType.Priority: { // 0xC6
                const priority = raw.readUint8(pos + 1);
                return new Commands.Priority(priority);
            }
            case CommandType.NoteWaitMode: { // 0xC7
                const enabled = raw.readUint8(pos + 1) !== 0;
                return new Commands.NoteWaitMode(enabled);
            }
            case CommandType.Tie: { // 0xC8
                const enabled = raw.readUint8(pos + 1) !== 0;
                return new Commands.Tie(enabled);
            }
            case CommandType.Portamento: { // 0xC9
                const key = raw.readUint8(pos + 1);
                return new Commands.Portamento(key);
            }
            case CommandType.ModulationDepth: { // 0xCA
                const depth = raw.readUint8(pos + 1);
                return new Commands.ModulationDepth(depth);
            }
            case CommandType.ModulationSpeed: { // 0xCB
                const speed = raw.readUint8(pos + 1);
                return new Commands.ModulationSpeed(speed);
            }
            case CommandType.ModulationType: { // 0xCC
                const type = raw.readUint8(pos + 1);
                return new Commands.ModulationType(type);
            }
            case CommandType.ModulationRange: { // 0xCD
                const range = raw.readUint8(pos + 1);
                return new Commands.ModulationRange(range);
            }
            case CommandType.PortamentoSwitch: { // 0xCE
                const enabled = raw.readUint8(pos + 1) !== 0;
                return new Commands.PortamentoSwitch(enabled);
            }
            case CommandType.PortamentoTime: { // 0xCF
                const time = raw.readUint8(pos + 1);
                return new Commands.PortamentoTime(time);
            }
            case CommandType.Attack: { // 0xD0
                const attack = raw.readUint8(pos + 1);
                return new Commands.Attack(attack);
            }
            case CommandType.Decay: { // 0xD1
                const decay = raw.readUint8(pos + 1);
                return new Commands.Decay(decay);
            }
            case CommandType.Sustain: { // 0xD2
                const sustain = raw.readUint8(pos + 1);
                return new Commands.Sustain(sustain);
            }
            case CommandType.Release: { // 0xD3
                const release = raw.readUint8(pos + 1);
                return new Commands.Release(release);
            }
            case CommandType.LoopStart: { // 0xD4
                const count = raw.readUint8(pos + 1);
                return new Commands.LoopStart(count);
            }
            case CommandType.Volume2: { // 0xD5
                const volume = raw.readUint8(pos + 1);
                return new Commands.Volume2(volume);
            }
            case CommandType.PrintVariable: { // 0xD6
                const variable = raw.readUint8(pos + 1);
                return new Commands.PrintVariable(variable);
            }
            case CommandType.ModulationDelay: { // 0xE0
                const delay = raw.readInt16(pos + 1);
                return new Commands.ModulationDelay(delay);
            }
            case CommandType.Tempo: { // 0xE1
                const tempo = raw.readInt16(pos + 1);
                return new Commands.Tempo(tempo);
            }
            case CommandType.SweepPitch: { // 0xE2
                const pitch = raw.readInt16(pos + 1);
                return new Commands.SweepPitch(pitch);
            }
            case CommandType.Return: { // 0xED
                return new Commands.Return();
            }
            case CommandType.LoopEnd: { // 0xFC
                return new Commands.LoopEnd();
            }
            case CommandType.AllocateTracks: { // 0xFE
                const tracks = raw.readUint16(pos + 1);
                return new Commands.AllocateTracks(tracks);
            }
            case CommandType.Fin: { // 0xFF
                return new Commands.Fin();
            }
            default: {
                throw new Error(`Unknown command type: ${commandType.toString(16)} at ${pos.toString(16)}`);
            }
        }
    }
}

class SSAR {
    constructor(raw) {
        new SoundFileHeader(raw, "SSAR");
        this.dataBlock = new SSARDataBlock(raw.slice(0x10));
        this.data = raw.slice(this.dataBlock.sequenceDataStartOffset);
    }
    getSequenceData(id) {
        const entry = this.dataBlock.sequenceTable.entries[id];
        if (!entry) {
            throw new Error(`Sequence ${id} not found`);
        }
        const buffer = this.data.slice(entry.sequenceDataOffset);
        const commands = CommandParser.parseCommands(buffer, buffer.length);
        return commands;
    }
}
class SSARDataBlock extends Block {
    constructor(raw) {
        super(raw, "DATA");
        // 0x08 (4 bytes): Offset to sequence data start
        this.sequenceDataStartOffset = raw.readUint32(0x08);
        // 0x0C: Sequence table
        this.sequenceTable = new Table(raw.slice(0x0C), SequenceArchiveEntry);
    }
}
class SequenceArchiveEntry extends TableEntry {
    constructor(raw) {
        super(raw);
        this.length = 0x0C;
        // 0x00 (4 bytes): Offset to sequence data
        this.sequenceDataOffset = raw.readUint32(0x00);
        // 0x04 (2 bytes): Bank id
        this.bankId = raw.readUint16(0x04);
        // 0x06 (1 bytes): Volume
        this.volume = raw.readUint8(0x06);
        // 0x07 (1 bytes): Channel Priority
        this.channelPriority = raw.readUint8(0x07);
        // 0x08 (1 bytes): Player Priority
        this.playerPriority = raw.readUint8(0x08);
        // 0x09 (1 bytes): Player id
        this.playerId = raw.readUint8(0x09);
        // 0x0A (2 bytes): Padding
    }
}

/**
 * Sound Sequence, contains sequence commands (similar to MIDI).
 */
class SSEQ {
    constructor(raw) {
        this.header = new SoundFileHeader(raw, "SSEQ");
        this.data = new SSEQDataBlock(raw.slice(0x10));
    }
}
class SSEQDataBlock extends Block {
    constructor(raw) {
        super(raw, "DATA");
        // 0x08 (4 bytes): Offset to sequence data
        // 0x0C (BlockSize - 0x0C bytes): Sequence commands
        const length = this.size - 0x0C;
        this.commands = CommandParser.parseCommands(raw.slice(0x0C), length);
    }
}

var Note;
(function (Note) {
    Note[Note["CNegative1"] = 0] = "CNegative1";
    Note[Note["CNegative1Sharp"] = 1] = "CNegative1Sharp";
    Note[Note["DNegative1"] = 2] = "DNegative1";
    Note[Note["DNegative1Sharp"] = 3] = "DNegative1Sharp";
    Note[Note["ENegative1"] = 4] = "ENegative1";
    Note[Note["FNegative1"] = 5] = "FNegative1";
    Note[Note["FNegative1Sharp"] = 6] = "FNegative1Sharp";
    Note[Note["GNegative1"] = 7] = "GNegative1";
    Note[Note["GNegative1Sharp"] = 8] = "GNegative1Sharp";
    Note[Note["ANegative1"] = 9] = "ANegative1";
    Note[Note["ANegative1Sharp"] = 10] = "ANegative1Sharp";
    Note[Note["BNegative1"] = 11] = "BNegative1";
    Note[Note["C0"] = 12] = "C0";
    Note[Note["C0Sharp"] = 13] = "C0Sharp";
    Note[Note["D0"] = 14] = "D0";
    Note[Note["D0Sharp"] = 15] = "D0Sharp";
    Note[Note["E0"] = 16] = "E0";
    Note[Note["F0"] = 17] = "F0";
    Note[Note["F0Sharp"] = 18] = "F0Sharp";
    Note[Note["G0"] = 19] = "G0";
    Note[Note["G0Sharp"] = 20] = "G0Sharp";
    Note[Note["A0"] = 21] = "A0";
    Note[Note["A0Sharp"] = 22] = "A0Sharp";
    Note[Note["B0"] = 23] = "B0";
    Note[Note["C1"] = 24] = "C1";
    Note[Note["C1Sharp"] = 25] = "C1Sharp";
    Note[Note["D1"] = 26] = "D1";
    Note[Note["D1Sharp"] = 27] = "D1Sharp";
    Note[Note["E1"] = 28] = "E1";
    Note[Note["F1"] = 29] = "F1";
    Note[Note["F1Sharp"] = 30] = "F1Sharp";
    Note[Note["G1"] = 31] = "G1";
    Note[Note["G1Sharp"] = 32] = "G1Sharp";
    Note[Note["A1"] = 33] = "A1";
    Note[Note["A1Sharp"] = 34] = "A1Sharp";
    Note[Note["B1"] = 35] = "B1";
    Note[Note["C2"] = 36] = "C2";
    Note[Note["C2Sharp"] = 37] = "C2Sharp";
    Note[Note["D2"] = 38] = "D2";
    Note[Note["D2Sharp"] = 39] = "D2Sharp";
    Note[Note["E2"] = 40] = "E2";
    Note[Note["F2"] = 41] = "F2";
    Note[Note["F2Sharp"] = 42] = "F2Sharp";
    Note[Note["G2"] = 43] = "G2";
    Note[Note["G2Sharp"] = 44] = "G2Sharp";
    Note[Note["A2"] = 45] = "A2";
    Note[Note["A2Sharp"] = 46] = "A2Sharp";
    Note[Note["B2"] = 47] = "B2";
    Note[Note["C3"] = 48] = "C3";
    Note[Note["C3Sharp"] = 49] = "C3Sharp";
    Note[Note["D3"] = 50] = "D3";
    Note[Note["D3Sharp"] = 51] = "D3Sharp";
    Note[Note["E3"] = 52] = "E3";
    Note[Note["F3"] = 53] = "F3";
    Note[Note["F3Sharp"] = 54] = "F3Sharp";
    Note[Note["G3"] = 55] = "G3";
    Note[Note["G3Sharp"] = 56] = "G3Sharp";
    Note[Note["A3"] = 57] = "A3";
    Note[Note["A3Sharp"] = 58] = "A3Sharp";
    Note[Note["B3"] = 59] = "B3";
    Note[Note["C4"] = 60] = "C4";
    Note[Note["C4Sharp"] = 61] = "C4Sharp";
    Note[Note["D4"] = 62] = "D4";
    Note[Note["D4Sharp"] = 63] = "D4Sharp";
    Note[Note["E4"] = 64] = "E4";
    Note[Note["F4"] = 65] = "F4";
    Note[Note["F4Sharp"] = 66] = "F4Sharp";
    Note[Note["G4"] = 67] = "G4";
    Note[Note["G4Sharp"] = 68] = "G4Sharp";
    Note[Note["A4"] = 69] = "A4";
    Note[Note["A4Sharp"] = 70] = "A4Sharp";
    Note[Note["B4"] = 71] = "B4";
    Note[Note["C5"] = 72] = "C5";
    Note[Note["C5Sharp"] = 73] = "C5Sharp";
    Note[Note["D5"] = 74] = "D5";
    Note[Note["D5Sharp"] = 75] = "D5Sharp";
    Note[Note["E5"] = 76] = "E5";
    Note[Note["F5"] = 77] = "F5";
    Note[Note["F5Sharp"] = 78] = "F5Sharp";
    Note[Note["G5"] = 79] = "G5";
    Note[Note["G5Sharp"] = 80] = "G5Sharp";
    Note[Note["A5"] = 81] = "A5";
    Note[Note["A5Sharp"] = 82] = "A5Sharp";
    Note[Note["B5"] = 83] = "B5";
    Note[Note["C6"] = 84] = "C6";
    Note[Note["C6Sharp"] = 85] = "C6Sharp";
    Note[Note["D6"] = 86] = "D6";
    Note[Note["D6Sharp"] = 87] = "D6Sharp";
    Note[Note["E6"] = 88] = "E6";
    Note[Note["F6"] = 89] = "F6";
    Note[Note["F6Sharp"] = 90] = "F6Sharp";
    Note[Note["G6"] = 91] = "G6";
    Note[Note["G6Sharp"] = 92] = "G6Sharp";
    Note[Note["A6"] = 93] = "A6";
    Note[Note["A6Sharp"] = 94] = "A6Sharp";
    Note[Note["B6"] = 95] = "B6";
    Note[Note["C7"] = 96] = "C7";
    Note[Note["C7Sharp"] = 97] = "C7Sharp";
    Note[Note["D7"] = 98] = "D7";
    Note[Note["D7Sharp"] = 99] = "D7Sharp";
    Note[Note["E7"] = 100] = "E7";
    Note[Note["F7"] = 101] = "F7";
    Note[Note["F7Sharp"] = 102] = "F7Sharp";
    Note[Note["G7"] = 103] = "G7";
    Note[Note["G7Sharp"] = 104] = "G7Sharp";
    Note[Note["A7"] = 105] = "A7";
    Note[Note["A7Sharp"] = 106] = "A7Sharp";
    Note[Note["B7"] = 107] = "B7";
    Note[Note["C8"] = 108] = "C8";
    Note[Note["C8Sharp"] = 109] = "C8Sharp";
    Note[Note["D8"] = 110] = "D8";
    Note[Note["D8Sharp"] = 111] = "D8Sharp";
    Note[Note["E8"] = 112] = "E8";
    Note[Note["F8"] = 113] = "F8";
    Note[Note["F8Sharp"] = 114] = "F8Sharp";
    Note[Note["G8"] = 115] = "G8";
    Note[Note["G8Sharp"] = 116] = "G8Sharp";
    Note[Note["A8"] = 117] = "A8";
    Note[Note["A8Sharp"] = 118] = "A8Sharp";
    Note[Note["B8"] = 119] = "B8";
    Note[Note["C9"] = 120] = "C9";
    Note[Note["C9Sharp"] = 121] = "C9Sharp";
    Note[Note["D9"] = 122] = "D9";
    Note[Note["D9Sharp"] = 123] = "D9Sharp";
    Note[Note["E9"] = 124] = "E9";
    Note[Note["F9"] = 125] = "F9";
    Note[Note["F9Sharp"] = 126] = "F9Sharp";
    Note[Note["G9"] = 127] = "G9";
})(Note || (Note = {}));
const noteToFrequencies = [];
for (let i = -32; i < 128; i++) {
    noteToFrequencies[i + 32] = 440 * Math.pow(2, (i - 69) / 12);
}
function noteToFrequency(note) {
    if (note < -32 || note >= 128) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }
    const noteMod1 = note % 1;
    if (noteMod1 === 0) {
        return noteToFrequencies[note + 32];
    }
    const lower = note - noteMod1 + 32;
    return noteToFrequencies[lower] * (1 - noteMod1) + noteToFrequencies[lower + 1] * noteMod1;
}

// https://gota7.github.io/NitroStudio2/specs/stream.html
class STRMDataBlock extends Block {
    constructor(raw, header) {
        super(raw, "DATA");
        this.raw = raw.slice(0x08);
        this.header = header;
    }
    toPCM() {
        let readOffset = 0x00;
        let writeOffsetPerChannel = [];
        let pcm = [];
        for (let i = 0; i < this.header.channelCount; i++) {
            pcm.push(new Float32Array(this.header.sampleCount + this.header.lastBlockSampleCount));
            writeOffsetPerChannel.push(0);
        }
        // All blocks except the last one are full blocks
        for (let i = 0; i < this.header.blockCount - 1; i++) {
            for (let j = 0; j < this.header.channelCount; j++) {
                const block = this.decodeBlock(readOffset, this.header.samplesPerBlock, this.header.blockSize);
                readOffset += this.header.blockSize;
                pcm[j].set(block, writeOffsetPerChannel[j]);
                writeOffsetPerChannel[j] += block.length;
            }
        }
        // The last block is a partial block
        for (let j = 0; j < this.header.channelCount; j++) {
            const block = this.decodeBlock(readOffset, this.header.samplesPerBlock, this.header.lastBlockSize);
            readOffset += this.header.lastBlockSize;
            pcm[j].set(block, writeOffsetPerChannel[j]);
            writeOffsetPerChannel[j] += block.length;
        }
        return pcm;
    }
    decodeBlock(offset, numSamples, blockSize) {
        const data = this.raw.slice(offset, offset + blockSize);
        return Encoding.toPCM(data, this.header.encoding);
    }
}

// https://gota7.github.io/NitroStudio2/specs/stream.html
class STRMInfoBlock extends Block {
    constructor(raw) {
        super(raw, "HEAD");
        // 0x08 (1 byte) - Encoding
        this.encoding = raw.readUint8(0x08);
        // 0x09 (1 byte) - Loop
        this.loop = raw.readUint8(0x09) === 1;
        // 0x0A (1 byte) - Channel count
        this.channelCount = raw.readUint8(0x0A);
        // 0x0B (1 byte) - Padding
        // 0x0C (2 byte) - Sample rate
        this.sampleRate = raw.readUint16(0x0C);
        // 0x0E (2 byte) - Clock time -> floor( (523655.96875 * (1 / sampleRate) ) )
        this.clockTime = raw.readUint16(0x0E);
        // 0x10 (4 byte) - Loop start in samples
        this.loopStart = raw.readUint32(0x10);
        // 0x14 (4 byte) - Number of samples
        this.sampleCount = raw.readUint32(0x14);
        // 0x18 (4 byte) - Offset to data -> 0x68
        this.dataOffset = raw.readUint32(0x18);
        // 0x1C (4 byte) - Number of blocks (only for ADPCM)
        this.blockCount = raw.readUint32(0x1C);
        // 0x20 (4 byte) - Block size
        this.blockSize = raw.readUint32(0x20);
        // 0x24 (4 byte) - Number of samples per block
        this.samplesPerBlock = raw.readUint32(0x24);
        // 0x28 (4 byte) - Size of the last block
        this.lastBlockSize = raw.readUint32(0x28);
        // 0x2C (4 byte) - Number of samples in the last block
        this.lastBlockSampleCount = raw.readUint32(0x2C);
    }
}

// https://gota7.github.io/NitroStudio2/specs/stream.html
/**
 * Stream, contains streamed audio data.
 */
class STRM {
    constructor(raw) {
        new SoundFileHeader(raw, "STRM");
        this.infoBlock = new STRMInfoBlock(raw.slice(0x10));
        this.dataBlock = new STRMDataBlock(raw.slice(this.infoBlock.dataOffset - 0x08), this.infoBlock);
    }
    toPCM() {
        return this.dataBlock.toPCM();
    }
}

// https://gota7.github.io/NitroStudio2/specs/wave.html
/**
 * Wave, contains audio data.
 */
class SWAV {
    constructor(raw, hasHeader) {
        if (hasHeader) {
            new SoundFileHeader(raw, "SWAV");
            raw = raw.slice(0x10);
        }
        // 0x10 - Data Block
        this.dataBlock = new SWAVDataBlock(raw, hasHeader);
    }
    toPCM() {
        return Encoding.toPCM(this.dataBlock.audioData, this.dataBlock.encoding);
    }
}
class SWAVDataBlock extends Block {
    constructor(raw, hasHeader) {
        if (hasHeader) {
            super(raw, "DATA");
            raw = raw.slice(0x08);
        }
        else {
            super(raw);
            this.size = raw.length;
        }
        // 0x00 (1 byte) - Encoding type
        this.encoding = raw.readUint8(0x00);
        // 0x01 (1 byte) - Loop
        this.loop = raw.readUint8(0x01) === 1;
        // 0x02 (2 bytes) - Sample rate
        this.sampleRate = raw.readUint16(0x02);
        // 0x04 (2 bytes) - Clock time (16756991 / sample rate)
        this.clockTime = raw.readUint16(0x04);
        // 0x06 (2 bytes) - Loop start (in 32-bit words)
        const loopStartOffset = raw.readUint16(0x06);
        // 0x08 (4 bytes) - Loop length (in 32-bit words)
        const loopLengthOffset = raw.readUint32(0x08);
        // 0x0C (size = BlockSize - 0xC - 0x8) - Audio data
        // this.audioData = raw.slice(0x0C, this.size - 0xC - 0x8);
        this.audioData = raw.slice(0x0C, 0x0C + loopStartOffset * 4 + loopLengthOffset * 4);
        switch (this.encoding) {
            case EncodingType.PCM8:
                this.loopStart = loopStartOffset * 4;
                this.loopLength = loopLengthOffset * 4;
                break;
            case EncodingType.PCM16:
                this.loopStart = (loopStartOffset * 4) / 2;
                this.loopLength = (loopStartOffset * 4) / 2;
                break;
            case EncodingType.IMA_ADPCM:
                this.loopStart = (loopStartOffset * 4) * 2 - 8;
                this.loopLength = (loopLengthOffset * 4) * 2;
                break;
        }
    }
}

// https://gota7.github.io/NitroStudio2/specs/wave.html
/**
 * Sound Archive, contains multiple SWAV files.
 */
class SWAR {
    constructor(raw) {
        new SoundFileHeader(raw, "SWAR");
        // 0x10 - Data Block
        const dataBlock = new SWARDataBlock(raw.slice(0x10));
        this.waves = [];
        for (let i = 0; i < dataBlock.waveOffsets.length; i++) {
            const offset = dataBlock.waveOffsets[i].value;
            let end = 0;
            if (i < dataBlock.waveOffsets.length - 1) {
                end = dataBlock.waveOffsets[i + 1].value;
            }
            else {
                end = raw.length;
            }
            const wave = new SWAV(raw.slice(offset, end), false);
            this.waves.push(wave);
        }
    }
}
class SWARDataBlock extends Block {
    constructor(raw) {
        super(raw, "DATA");
        // 0x28 - Wave offset table
        const table = new Table(raw.slice(0x28), Uint32TableEntry);
        this.waveOffsets = table.entries;
    }
}

// https://gota7.github.io/NitroStudio2/specs/bank.html#note-info
class NoteInfo {
    constructor(raw) {
        // 0x00 (2 bytes): Wave ID (PCM) or Duty Cycle Type (PSG)
        this.waveId = raw.readUint16(0x00);
        // 0x02 (2 byte): Wave Archive ID
        this.waveArchiveId = raw.readUint16(0x02);
        // 0x04 (1 byte): Base Note
        this.baseNote = raw.readUint8(0x04);
        // 0x05 (1 byte): Attack
        this.attack = raw.readUint8(0x05);
        // 0x06 (1 byte): Decay
        this.decay = raw.readUint8(0x06);
        // 0x07 (1 byte): Sustain
        this.sustain = raw.readUint8(0x07);
        // 0x08 (1 byte): Release
        this.release = raw.readUint8(0x08);
        // 0x09 (1 byte): Pan
        this.pan = raw.readUint8(0x09);
    }
}

// https://gota7.github.io/NitroStudio2/specs/bank.html
// http://www.feshrine.net/hacking/doc/nds-sdat.php#sbnk
var InstrumentType;
(function (InstrumentType) {
    InstrumentType[InstrumentType["Null"] = 0] = "Null";
    InstrumentType[InstrumentType["PCM"] = 1] = "PCM";
    InstrumentType[InstrumentType["PSG"] = 2] = "PSG";
    InstrumentType[InstrumentType["WhiteNoise"] = 3] = "WhiteNoise";
    InstrumentType[InstrumentType["DirectPCM"] = 4] = "DirectPCM";
    InstrumentType[InstrumentType["DrumSet"] = 16] = "DrumSet";
    InstrumentType[InstrumentType["KeySplit"] = 17] = "KeySplit";
})(InstrumentType || (InstrumentType = {}));
class Instrument {
    constructor(raw) {
    }
}
class DirectInstrument extends Instrument {
    constructor(raw, type) {
        super(raw);
        this.type = type;
        // 0x00 (16 bytes): Note info
        this.noteInfo = new NoteInfo(raw.slice(0x00, 0x10));
    }
}
// DrumSet
class DrumSetInstrument extends Instrument {
    constructor(raw) {
        super(raw);
        this.type = InstrumentType.DrumSet;
        // 0x00 (1 byte): Lower key
        this.lowerKey = raw.readUint8(0x00);
        // 0x01 (1 byte): Upper key
        this.upperKey = raw.readUint8(0x01);
        const count = this.upperKey - this.lowerKey + 1;
        this.instruments = new Array(count);
        let pos = 0x02;
        for (let i = 0; i < count; i++) {
            // pos (12 bytes): Contained instrument
            this.instruments[i] = new ContainedInstrument(raw.slice(pos, pos + 0x0C));
            pos += 0x0C;
        }
    }
}
// KeySplit
class KeySplitInstrument extends Instrument {
    constructor(raw) {
        super(raw);
        this.type = InstrumentType.KeySplit;
        // 0x00 (8 bytes): Regions
        this.regions = [];
        for (let i = 0x00; i < 0x08; i++) {
            const value = raw.readUint8(i);
            if (value === 0x00) {
                break;
            }
            this.regions.push(value);
        }
        this.instruments = [];
        let pos = 0x08;
        for (let i = 0; i < this.regions.length; i++) {
            // pos (12 bytes): Contained instrument
            this.instruments.push(new ContainedInstrument(raw.slice(pos, pos + 0x0C)));
            pos += 0x0C;
        }
    }
}
class ContainedInstrument {
    constructor(raw) {
        // 0x00 (1 byte): Padding
        // 0x01 (1 byte): Instrument type
        this.type = raw.readUint8(0x01);
        // 0x02 (10 bytes): Note Info
        this.noteInfo = new NoteInfo(raw.slice(0x02, 0x0C));
    }
}

// https://gota7.github.io/NitroStudio2/specs/bank.html
class SBNKDataBlock extends Block {
    constructor(raw) {
        super(raw, "DATA");
        // 0x08 (32 bytes): Padding
        // 0x28: Instrument entry table
        this.instrumentTable = new Table(raw.slice(0x28), InstrumentTableEntry);
    }
}
class InstrumentTableEntry extends TableEntry {
    constructor(raw) {
        super(raw);
        this.length = 0x04;
        // 0x00 (1 byte): Instrument type
        this.type = raw.readUint8(0x00);
        // 0x01 (2 bytes): Data offset
        this.dataOffset = raw.readUint16(0x01);
        // 0x03 (1 byte): Padding
    }
}

// https://gota7.github.io/NitroStudio2/specs/bank.html
/**
 * Sound Bank, contains instrument definitions.
 */
class SBNK {
    constructor(raw) {
        this.header = new SoundFileHeader(raw, "SBNK");
        this.data = new SBNKDataBlock(raw.slice(0x10));
        this.instruments = [];
        for (let i = 0; i < this.data.instrumentTable.entries.length; i++) {
            const entry = this.data.instrumentTable.entries[i];
            switch (entry.type) {
                case InstrumentType.Null:
                    break;
                case InstrumentType.PCM:
                case InstrumentType.PSG:
                case InstrumentType.WhiteNoise:
                case InstrumentType.DirectPCM:
                    this.instruments[i] = new DirectInstrument(raw.slice(entry.dataOffset), entry.type);
                    break;
                case InstrumentType.DrumSet:
                    this.instruments[i] = new DrumSetInstrument(raw.slice(entry.dataOffset));
                    break;
                case InstrumentType.KeySplit:
                    this.instruments[i] = new KeySplitInstrument(raw.slice(entry.dataOffset));
                    break;
                default:
                    throw new Error(`Unknown instrument type: ${entry.type} at index ${this.data.instrumentTable.entries.indexOf(entry)}`);
            }
        }
    }
}

/* This file is derived from Kermalis' VGMusicStudio.
 * Modifications have been made to convert the code from C# to TypeScript.
 * I need to do this because I can't figure out how the volume is calculated on the DS
 * and VGMusicStudio seems to do it correctly. The other tables are not used and have
 * been commented out in order to reduce the size of the compiled JS file.
 *
 * The original version can be found here:
 * https://github.com/Kermalis/VGMusicStudio/blob/d14a38e264eeb1392289eeb2bd5b450c92877949/VG%20Music%20Studio/Core/NDS/SDAT/Utils.cs
 */
class KermalisVGMSUtils {
    // public static ushort GetChannelTimer(ushort baseTimer, int pitch)
    // {
    //     int shift = 0;
    //     pitch = -pitch;
    //     while (pitch < 0)
    //     {
    //         shift--;
    //         pitch += 0x300;
    //     }
    //     while (pitch >= 0x300)
    //     {
    //         shift++;
    //         pitch -= 0x300;
    //     }
    //     ulong timer = (_pitchTable[pitch] + 0x10000uL) * baseTimer;
    //     shift -= 16;
    //     if (shift <= 0)
    //     {
    //         timer >>= -shift;
    //     }
    //     else if (shift < 32)
    //     {
    //         if ((timer & (ulong.MaxValue << (32 - shift))) != 0)
    //         {
    //             return ushort.MaxValue;
    //         }
    //         timer <<= shift;
    //     }
    //     else
    //     {
    //         return ushort.MaxValue;
    //     }
    //     if (timer < 0x10)
    //     {
    //         return 0x10;
    //     }
    //     if (timer > ushort.MaxValue)
    //     {
    //         timer = ushort.MaxValue;
    //     }
    //     return (ushort)timer;
    // }
    static GetChannelVolume(vol) {
        let a = Math.floor(vol / 0x80);
        if (a < -723) {
            a = -723;
        }
        else if (a > 0) {
            a = 0;
        }
        return this._volumeTable[a + 723];
    }
}
// public static readonly byte[] AttackTable = new byte[128]
// {
//     255, 254, 253, 252, 251, 250, 249, 248,
//     247, 246, 245, 244, 243, 242, 241, 240,
//     239, 238, 237, 236, 235, 234, 233, 232,
//     231, 230, 229, 228, 227, 226, 225, 224,
//     223, 222, 221, 220, 219, 218, 217, 216,
//     215, 214, 213, 212, 211, 210, 209, 208,
//     207, 206, 205, 204, 203, 202, 201, 200,
//     199, 198, 197, 196, 195, 194, 193, 192,
//     191, 190, 189, 188, 187, 186, 185, 184,
//     183, 182, 181, 180, 179, 178, 177, 176,
//     175, 174, 173, 172, 171, 170, 169, 168,
//     167, 166, 165, 164, 163, 162, 161, 160,
//     159, 158, 157, 156, 155, 154, 153, 152,
//     151, 150, 149, 148, 147, 143, 137, 132,
//     127, 123, 116, 109, 100, 92, 84, 73,
//     63, 51, 38, 26, 14, 5, 1, 0
// };
// public static readonly ushort[] DecayTable = new ushort[128]
// {
//     1, 3, 5, 7, 9, 11, 13, 15,
//     17, 19, 21, 23, 25, 27, 29, 31,
//     33, 35, 37, 39, 41, 43, 45, 47,
//     49, 51, 53, 55, 57, 59, 61, 63,
//     65, 67, 69, 71, 73, 75, 77, 79,
//     81, 83, 85, 87, 89, 91, 93, 95,
//     97, 99, 101, 102, 104, 105, 107, 108,
//     110, 111, 113, 115, 116, 118, 120, 122,
//     124, 126, 128, 130, 132, 135, 137, 140,
//     142, 145, 148, 151, 154, 157, 160, 163,
//     167, 171, 175, 179, 183, 187, 192, 197,
//     202, 208, 213, 219, 226, 233, 240, 248,
//     256, 265, 274, 284, 295, 307, 320, 334,
//     349, 366, 384, 404, 427, 452, 480, 512,
//     549, 591, 640, 698, 768, 853, 960, 1097,
//     1280, 1536, 1920, 2560, 3840, 7680, 15360, 65535
// };
// public static readonly int[] SustainTable = new int[128]
// {
//     -92544, -92416, -92288, -83328, -76928, -71936, -67840, -64384,
//     -61440, -58880, -56576, -54400, -52480, -50688, -49024, -47488,
//     -46080, -44672, -43392, -42240, -41088, -40064, -39040, -38016,
//     -36992, -36096, -35328, -34432, -33664, -32896, -32128, -31360,
//     -30592, -29952, -29312, -28672, -28032, -27392, -26880, -26240,
//     -25728, -25088, -24576, -24064, -23552, -23040, -22528, -22144,
//     -21632, -21120, -20736, -20224, -19840, -19456, -19072, -18560,
//     -18176, -17792, -17408, -17024, -16640, -16256, -16000, -15616,
//     -15232, -14848, -14592, -14208, -13952, -13568, -13184, -12928,
//     -12672, -12288, -12032, -11648, -11392, -11136, -10880, -10496,
//     -10240, -9984, -9728, -9472, -9216, -8960, -8704, -8448,
//     -8192, -7936, -7680, -7424, -7168, -6912, -6656, -6400,
//     -6272, -6016, -5760, -5504, -5376, -5120, -4864, -4608,
//     -4480, -4224, -3968, -3840, -3584, -3456, -3200, -2944,
//     -2816, -2560, -2432, -2176, -2048, -1792, -1664, -1408,
//     -1280, -1024, -896, -768, -512, -384, -128, 0
// };
// private static readonly sbyte[] _sinTable = new sbyte[33]
// {
//     000, 006, 012, 019, 025, 031, 037, 043,
//     049, 054, 060, 065, 071, 076, 081, 085,
//     090, 094, 098, 102, 106, 109, 112, 115,
//     117, 120, 122, 123, 125, 126, 126, 127,
//     127
// };
// public static int Sin(int index)
// {
//     if (index < 0x20)
//     {
//         return _sinTable[index];
//     }
//     else if (index < 0x40)
//     {
//         return _sinTable[0x20 - (index - 0x20)];
//     }
//     else if (index < 0x60)
//     {
//         return -_sinTable[index - 0x40];
//     }
//     else // < 0x80
//     {
//         return -_sinTable[0x20 - (index - 0x60)];
//     }
// }
// private static readonly ushort[] _pitchTable = new ushort[768]
// {
//     0, 59, 118, 178, 237, 296, 356, 415,
//     475, 535, 594, 654, 714, 773, 833, 893,
//     953, 1013, 1073, 1134, 1194, 1254, 1314, 1375,
//     1435, 1496, 1556, 1617, 1677, 1738, 1799, 1859,
//     1920, 1981, 2042, 2103, 2164, 2225, 2287, 2348,
//     2409, 2471, 2532, 2593, 2655, 2716, 2778, 2840,
//     2902, 2963, 3025, 3087, 3149, 3211, 3273, 3335,
//     3397, 3460, 3522, 3584, 3647, 3709, 3772, 3834,
//     3897, 3960, 4022, 4085, 4148, 4211, 4274, 4337,
//     4400, 4463, 4526, 4590, 4653, 4716, 4780, 4843,
//     4907, 4971, 5034, 5098, 5162, 5226, 5289, 5353,
//     5417, 5481, 5546, 5610, 5674, 5738, 5803, 5867,
//     5932, 5996, 6061, 6125, 6190, 6255, 6320, 6384,
//     6449, 6514, 6579, 6645, 6710, 6775, 6840, 6906,
//     6971, 7037, 7102, 7168, 7233, 7299, 7365, 7431,
//     7496, 7562, 7628, 7694, 7761, 7827, 7893, 7959,
//     8026, 8092, 8159, 8225, 8292, 8358, 8425, 8492,
//     8559, 8626, 8693, 8760, 8827, 8894, 8961, 9028,
//     9096, 9163, 9230, 9298, 9366, 9433, 9501, 9569,
//     9636, 9704, 9772, 9840, 9908, 9976, 10045, 10113,
//     10181, 10250, 10318, 10386, 10455, 10524, 10592, 10661,
//     10730, 10799, 10868, 10937, 11006, 11075, 11144, 11213,
//     11283, 11352, 11421, 11491, 11560, 11630, 11700, 11769,
//     11839, 11909, 11979, 12049, 12119, 12189, 12259, 12330,
//     12400, 12470, 12541, 12611, 12682, 12752, 12823, 12894,
//     12965, 13036, 13106, 13177, 13249, 13320, 13391, 13462,
//     13533, 13605, 13676, 13748, 13819, 13891, 13963, 14035,
//     14106, 14178, 14250, 14322, 14394, 14467, 14539, 14611,
//     14684, 14756, 14829, 14901, 14974, 15046, 15119, 15192,
//     15265, 15338, 15411, 15484, 15557, 15630, 15704, 15777,
//     15850, 15924, 15997, 16071, 16145, 16218, 16292, 16366,
//     16440, 16514, 16588, 16662, 16737, 16811, 16885, 16960,
//     17034, 17109, 17183, 17258, 17333, 17408, 17483, 17557,
//     17633, 17708, 17783, 17858, 17933, 18009, 18084, 18160,
//     18235, 18311, 18387, 18462, 18538, 18614, 18690, 18766,
//     18842, 18918, 18995, 19071, 19147, 19224, 19300, 19377,
//     19454, 19530, 19607, 19684, 19761, 19838, 19915, 19992,
//     20070, 20147, 20224, 20302, 20379, 20457, 20534, 20612,
//     20690, 20768, 20846, 20924, 21002, 21080, 21158, 21236,
//     21315, 21393, 21472, 21550, 21629, 21708, 21786, 21865,
//     21944, 22023, 22102, 22181, 22260, 22340, 22419, 22498,
//     22578, 22658, 22737, 22817, 22897, 22977, 23056, 23136,
//     23216, 23297, 23377, 23457, 23537, 23618, 23698, 23779,
//     23860, 23940, 24021, 24102, 24183, 24264, 24345, 24426,
//     24507, 24589, 24670, 24752, 24833, 24915, 24996, 25078,
//     25160, 25242, 25324, 25406, 25488, 25570, 25652, 25735,
//     25817, 25900, 25982, 26065, 26148, 26230, 26313, 26396,
//     26479, 26562, 26645, 26729, 26812, 26895, 26979, 27062,
//     27146, 27230, 27313, 27397, 27481, 27565, 27649, 27733,
//     27818, 27902, 27986, 28071, 28155, 28240, 28324, 28409,
//     28494, 28579, 28664, 28749, 28834, 28919, 29005, 29090,
//     29175, 29261, 29346, 29432, 29518, 29604, 29690, 29776,
//     29862, 29948, 30034, 30120, 30207, 30293, 30380, 30466,
//     30553, 30640, 30727, 30814, 30900, 30988, 31075, 31162,
//     31249, 31337, 31424, 31512, 31599, 31687, 31775, 31863,
//     31951, 32039, 32127, 32215, 32303, 32392, 32480, 32568,
//     32657, 32746, 32834, 32923, 33012, 33101, 33190, 33279,
//     33369, 33458, 33547, 33637, 33726, 33816, 33906, 33995,
//     34085, 34175, 34265, 34355, 34446, 34536, 34626, 34717,
//     34807, 34898, 34988, 35079, 35170, 35261, 35352, 35443,
//     35534, 35626, 35717, 35808, 35900, 35991, 36083, 36175,
//     36267, 36359, 36451, 36543, 36635, 36727, 36820, 36912,
//     37004, 37097, 37190, 37282, 37375, 37468, 37561, 37654,
//     37747, 37841, 37934, 38028, 38121, 38215, 38308, 38402,
//     38496, 38590, 38684, 38778, 38872, 38966, 39061, 39155,
//     39250, 39344, 39439, 39534, 39629, 39724, 39819, 39914,
//     40009, 40104, 40200, 40295, 40391, 40486, 40582, 40678,
//     40774, 40870, 40966, 41062, 41158, 41255, 41351, 41448,
//     41544, 41641, 41738, 41835, 41932, 42029, 42126, 42223,
//     42320, 42418, 42515, 42613, 42710, 42808, 42906, 43004,
//     43102, 43200, 43298, 43396, 43495, 43593, 43692, 43790,
//     43889, 43988, 44087, 44186, 44285, 44384, 44483, 44583,
//     44682, 44781, 44881, 44981, 45081, 45180, 45280, 45381,
//     45481, 45581, 45681, 45782, 45882, 45983, 46083, 46184,
//     46285, 46386, 46487, 46588, 46690, 46791, 46892, 46994,
//     47095, 47197, 47299, 47401, 47503, 47605, 47707, 47809,
//     47912, 48014, 48117, 48219, 48322, 48425, 48528, 48631,
//     48734, 48837, 48940, 49044, 49147, 49251, 49354, 49458,
//     49562, 49666, 49770, 49874, 49978, 50082, 50187, 50291,
//     50396, 50500, 50605, 50710, 50815, 50920, 51025, 51131,
//     51236, 51341, 51447, 51552, 51658, 51764, 51870, 51976,
//     52082, 52188, 52295, 52401, 52507, 52614, 52721, 52827,
//     52934, 53041, 53148, 53256, 53363, 53470, 53578, 53685,
//     53793, 53901, 54008, 54116, 54224, 54333, 54441, 54549,
//     54658, 54766, 54875, 54983, 55092, 55201, 55310, 55419,
//     55529, 55638, 55747, 55857, 55966, 56076, 56186, 56296,
//     56406, 56516, 56626, 56736, 56847, 56957, 57068, 57179,
//     57289, 57400, 57511, 57622, 57734, 57845, 57956, 58068,
//     58179, 58291, 58403, 58515, 58627, 58739, 58851, 58964,
//     59076, 59189, 59301, 59414, 59527, 59640, 59753, 59866,
//     59979, 60092, 60206, 60319, 60433, 60547, 60661, 60774,
//     60889, 61003, 61117, 61231, 61346, 61460, 61575, 61690,
//     61805, 61920, 62035, 62150, 62265, 62381, 62496, 62612,
//     62727, 62843, 62959, 63075, 63191, 63308, 63424, 63540,
//     63657, 63774, 63890, 64007, 64124, 64241, 64358, 64476,
//     64593, 64711, 64828, 64946, 65064, 65182, 65300, 65418
// };
KermalisVGMSUtils._volumeTable = [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 4,
    4, 5, 5, 5, 5, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 5, 5,
    5, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 8, 8, 8, 8, 8,
    8, 8, 8, 8, 9, 9, 9, 9,
    9, 9, 9, 9, 9, 10, 10, 10,
    10, 10, 10, 10, 10, 11, 11, 11,
    11, 11, 11, 11, 11, 12, 12, 12,
    12, 12, 12, 12, 13, 13, 13, 13,
    13, 13, 13, 14, 14, 14, 14, 14,
    14, 15, 15, 15, 15, 15, 16, 16,
    16, 16, 16, 16, 17, 17, 17, 17,
    17, 18, 18, 18, 18, 19, 19, 19,
    19, 19, 20, 20, 20, 20, 21, 21,
    21, 21, 22, 22, 22, 22, 23, 23,
    23, 23, 24, 24, 24, 25, 25, 25,
    25, 26, 26, 26, 27, 27, 27, 28,
    28, 28, 29, 29, 29, 30, 30, 30,
    31, 31, 31, 32, 32, 33, 33, 33,
    34, 34, 35, 35, 35, 36, 36, 37,
    37, 38, 38, 38, 39, 39, 40, 40,
    41, 41, 42, 42, 43, 43, 44, 44,
    45, 45, 46, 46, 47, 47, 48, 48,
    49, 50, 50, 51, 51, 52, 52, 53,
    54, 54, 55, 56, 56, 57, 58, 58,
    59, 60, 60, 61, 62, 62, 63, 64,
    65, 66, 66, 67, 68, 69, 70, 70,
    71, 72, 73, 74, 75, 75, 76, 77,
    78, 79, 80, 81, 82, 83, 84, 85,
    86, 87, 88, 89, 90, 91, 92, 93,
    94, 95, 96, 97, 98, 99, 101, 102,
    103, 104, 105, 106, 108, 109, 110, 111,
    113, 114, 115, 117, 118, 119, 121, 122,
    124, 125, 126, 127
];

// https://web.archive.org/web/20201021055347/https://sites.google.com/site/kiwids/articulation.htm
class ADSRConverter {
    static convertAttack(attackRate) {
        return ADSRConverter.ATTACKRATE_TABLE[attackRate];
    }
    static convertFall(fallRate) {
        return ADSRConverter.FALLRATE_TABLE[fallRate];
    }
    static convertSustain(sustain) {
        return ADSRConverter.SUSTAIN_TABLE[sustain];
    }
    static convertVolume(volume) {
        return KermalisVGMSUtils.GetChannelVolume(volume) / 127;
    }
    static convertPan(pan) {
        if (pan < 64) {
            return (pan - 64) / 64;
        }
        else {
            return (pan - 64) / 63;
        }
    }
}
ADSRConverter.ATTACKRATE_TABLE = [
    255, 254, 253, 252, 251, 250, 249, 248,
    247, 246, 245, 244, 243, 242, 241, 240,
    239, 238, 237, 236, 235, 234, 233, 232,
    231, 230, 229, 228, 227, 226, 225, 224,
    223, 222, 221, 220, 219, 218, 217, 216,
    215, 214, 213, 212, 211, 210, 209, 208,
    207, 206, 205, 204, 203, 202, 201, 200,
    199, 198, 197, 196, 195, 194, 193, 192,
    191, 190, 189, 188, 187, 186, 185, 184,
    183, 182, 181, 180, 179, 178, 177, 176,
    175, 174, 173, 172, 171, 170, 169, 168,
    167, 166, 165, 164, 163, 162, 161, 160,
    159, 158, 157, 156, 155, 154, 153, 152,
    151, 150, 149, 148, 147, 143, 137, 132,
    127, 123, 116, 109, 100, 92, 84, 73,
    63, 51, 38, 26, 14, 5, 1, 0
];
ADSRConverter.FALLRATE_TABLE = [
    1, 3, 5, 7, 9, 11, 13, 15,
    17, 19, 21, 23, 25, 27, 29, 31,
    33, 35, 37, 39, 41, 43, 45, 47,
    49, 51, 53, 55, 57, 59, 61, 63,
    65, 67, 69, 71, 73, 75, 77, 79,
    81, 83, 85, 87, 89, 91, 93, 95,
    97, 99, 101, 102, 104, 105, 107, 108,
    110, 111, 113, 115, 116, 118, 120, 122,
    124, 126, 128, 130, 132, 135, 137, 140,
    142, 145, 148, 151, 154, 157, 160, 163,
    167, 171, 175, 179, 183, 187, 192, 197,
    202, 208, 213, 219, 226, 233, 240, 248,
    256, 265, 274, 284, 295, 307, 320, 334,
    349, 366, 384, 404, 427, 452, 480, 512,
    549, 591, 640, 698, 768, 853, 960, 1097,
    1280, 1536, 1920, 2560, 3840, 7680, 15360, 65535
];
ADSRConverter.SUSTAIN_TABLE = [
    -92544, -92416, -92288, -83328, -76928, -71936, -67840, -64384,
    -61440, -58880, -56576, -54400, -52480, -50688, -49024, -47488,
    -46080, -44672, -43392, -42240, -41088, -40064, -39040, -38016,
    -36992, -36096, -35328, -34432, -33664, -32896, -32128, -31360,
    -30592, -29952, -29312, -28672, -28032, -27392, -26880, -26240,
    -25728, -25088, -24576, -24064, -23552, -23040, -22528, -22144,
    -21632, -21120, -20736, -20224, -19840, -19456, -19072, -18560,
    -18176, -17792, -17408, -17024, -16640, -16256, -16000, -15616,
    -15232, -14848, -14592, -14208, -13952, -13568, -13184, -12928,
    -12672, -12288, -12032, -11648, -11392, -11136, -10880, -10496,
    -10240, -9984, -9728, -9472, -9216, -8960, -8704, -8448,
    -8192, -7936, -7680, -7424, -7168, -6912, -6656, -6400,
    -6272, -6016, -5760, -5504, -5376, -5120, -4864, -4608,
    -4480, -4224, -3968, -3840, -3584, -3456, -3200, -2944,
    -2816, -2560, -2432, -2176, -2048, -1792, -1664, -1408,
    -1280, -1024, -896, -768, -512, -384, -128, 0
];

class Track {
    constructor(track, offset, commands, synth, sampleRate, variables, random, stopTrack, changeTempo, openTrack) {
        this.handlers = {
            [CommandType.Note]: this.Note,
            [CommandType.Wait]: this.Wait,
            [CommandType.ProgramChange]: this.ProgramChange,
            [CommandType.OpenTrack]: this.OpenTrack,
            [CommandType.Jump]: this.Jump,
            [CommandType.Call]: this.Call,
            [CommandType.Random]: this.Random,
            [CommandType.Variable]: this.Variable,
            [CommandType.If]: this.If,
            [CommandType.SetVariable]: this.SetVariable,
            [CommandType.AddVariable]: this.AddVariable,
            [CommandType.SubtractVariable]: this.SubtractVariable,
            [CommandType.MultiplyVariable]: this.MultiplyVariable,
            [CommandType.DivideVariable]: this.DivideVariable,
            [CommandType.ShiftVariable]: this.ShiftVariable,
            [CommandType.RandomVariable]: this.RandomVariable,
            [CommandType.CompareEqual]: this.CompareEqual,
            [CommandType.CompareGreaterOrEqual]: this.CompareGreaterOrEqual,
            [CommandType.CompareGreater]: this.CompareGreater,
            [CommandType.CompareLessOrEqual]: this.CompareLessOrEqual,
            [CommandType.CompareLess]: this.CompareLess,
            [CommandType.CompareNotEqual]: this.CompareNotEqual,
            [CommandType.Pan]: this.Pan,
            [CommandType.Volume]: this.Volume,
            [CommandType.MainVolume]: this.MainVolume,
            [CommandType.Transpose]: this.Transpose,
            [CommandType.PitchBend]: this.PitchBend,
            [CommandType.PitchBendRange]: this.PitchBendRange,
            [CommandType.Priority]: this.Priority,
            [CommandType.NoteWaitMode]: this.NoteWaitMode,
            [CommandType.Tie]: this.Tie,
            [CommandType.Portamento]: this.PortamentoControl,
            [CommandType.ModulationDepth]: this.ModulationDepth,
            [CommandType.ModulationSpeed]: this.ModulationSpeed,
            [CommandType.ModulationType]: this.ModulationType,
            [CommandType.ModulationRange]: this.ModulationRange,
            [CommandType.PortamentoSwitch]: this.PortamentoSwitch,
            [CommandType.PortamentoTime]: this.PortamentoTime,
            [CommandType.Attack]: this.Attack,
            [CommandType.Decay]: this.Decay,
            [CommandType.Sustain]: this.Sustain,
            [CommandType.Release]: this.Release,
            [CommandType.LoopStart]: this.LoopStart,
            [CommandType.Volume2]: this.Volume2,
            [CommandType.PrintVariable]: this.PrintVariable,
            [CommandType.ModulationDelay]: this.ModulationDelay,
            [CommandType.Tempo]: this.Tempo,
            [CommandType.SweepPitch]: this.SweepPitch,
            [CommandType.LoopEnd]: this.LoopEnd,
            [CommandType.Return]: this.Return,
            [CommandType.AllocateTracks]: this.AllocateTracks,
            [CommandType.Fin]: this.Fin
        };
        this.active = true;
        this.wait = 0;
        this.callReturnStack = [];
        this.pitchBendRange = 2;
        this.pitchBend = 0;
        this.volume1 = 127;
        this.volume2 = 127;
        this.modulationDepth = 0;
        this.modulationRange = 1;
        this.modulationSpeed = 16;
        this.modulationDelay = 0;
        this.modulationType = ModType.Pitch;
        this.portamentoKey = Note.C4;
        this.portamentoTime = 0;
        this.portamentoSwitch = false;
        this.transpose = 0;
        this.noteWaitEnabled = false;
        this.conditionalFlag = false;
        this.track = track;
        this.offset = offset;
        this.commands = commands;
        this.sampleRate = sampleRate;
        this.synth = synth;
        this.variables = variables;
        this.random = random;
        this.stopTrackCallback = stopTrack;
        this.changeTempoCallback = changeTempo;
        this.openTrackCallback = openTrack;
        this.pointer = offset;
    }
    tick() {
        while (this.wait === 0) {
            const command = this.commands[this.pointer];
            if (command === undefined) {
                this.stopTrackCallback(this.track);
                return;
            }
            this.handlers[command.type].bind(this)(command);
            this.pointer++;
        }
        if (this.wait > 0) {
            this.wait--;
        }
    }
    Note(cmd) {
        if (!this.active)
            return;
        const trackInfo = {
            pitchBendSemitones: this.pitchBendRange * this.pitchBend,
            volume1: this.volume1,
            volume2: this.volume2,
            modDepth: this.modulationDepth,
            modRange: this.modulationRange,
            modSpeed: this.modulationSpeed,
            modDelay: this.modulationDelay,
            modType: this.modulationType,
            portamentoKey: this.portamentoKey,
            portamentoTime: this.portamentoTime,
            portamentoSwitch: this.portamentoSwitch
        };
        this.synth.playNote(this.track, cmd.note + this.transpose, cmd.velocity, cmd.duration, trackInfo);
        this.portamentoKey = cmd.note + this.transpose;
        if (this.noteWaitEnabled) {
            this.wait = cmd.duration;
        }
    }
    Wait(cmd) {
        this.wait = cmd.duration;
    }
    ProgramChange(cmd) {
        this.synth.channels[this.track].programNumber = cmd.program;
    }
    OpenTrack(cmd) {
        this.openTrackCallback(cmd.track, cmd.offset);
    }
    Jump(cmd) {
        // -1 because the pointer will be incremented at the end of the tick
        this.pointer = cmd.offset - 1;
    }
    Call(cmd) {
        this.callReturnStack.push(this.pointer);
        // -1 because the pointer will be incremented at the end of the tick
        this.pointer = cmd.offset - 1;
    }
    Random(cmd) { }
    Variable(cmd) { }
    If(cmd) {
        if (this.conditionalFlag) {
            const subCmd = cmd.subCommand;
            this.handlers[subCmd.type].bind(this)(subCmd);
        }
    }
    SetVariable(cmd) {
        this.variables.set(cmd.variable, cmd.value);
    }
    AddVariable(cmd) {
        this.variables.set(cmd.variable, this.variables.get(cmd.variable) + cmd.value);
    }
    SubtractVariable(cmd) {
        this.variables.set(cmd.variable, this.variables.get(cmd.variable) - cmd.value);
    }
    MultiplyVariable(cmd) {
        this.variables.set(cmd.variable, this.variables.get(cmd.variable) * cmd.value);
    }
    DivideVariable(cmd) {
        this.variables.set(cmd.variable, this.variables.get(cmd.variable) / cmd.value);
    }
    ShiftVariable(cmd) {
        this.variables.set(cmd.variable, this.variables.get(cmd.variable) << cmd.value);
    }
    RandomVariable(cmd) {
        const value = this.random.next() % (cmd.max - 1);
        this.variables.set(cmd.variable, value);
    }
    CompareEqual(cmd) {
        this.conditionalFlag = this.variables.get(cmd.variable) === cmd.value;
    }
    CompareGreaterOrEqual(cmd) {
        this.conditionalFlag = this.variables.get(cmd.variable) >= cmd.value;
    }
    CompareGreater(cmd) {
        this.conditionalFlag = this.variables.get(cmd.variable) > cmd.value;
    }
    CompareLessOrEqual(cmd) {
        this.conditionalFlag = this.variables.get(cmd.variable) <= cmd.value;
    }
    CompareLess(cmd) {
        this.conditionalFlag = this.variables.get(cmd.variable) < cmd.value;
    }
    CompareNotEqual(cmd) {
        this.conditionalFlag = this.variables.get(cmd.variable) !== cmd.value;
    }
    Pan(cmd) {
        this.synth.channels[this.track].pan = ADSRConverter.convertPan(cmd.pan);
    }
    Volume(cmd) {
        this.volume1 = cmd.volume;
        this.synth.channels[this.track].setVolume(this.volume1, this.volume2);
    }
    MainVolume(cmd) { }
    Transpose(cmd) {
        this.transpose = cmd.transpose;
    }
    PitchBend(cmd) {
        // Pitch bend is between -128 and 127
        let bendNormalized = 0;
        if (cmd.bend > 0) {
            bendNormalized = cmd.bend / 127;
        }
        else {
            bendNormalized = cmd.bend / 128;
        }
        this.pitchBend = bendNormalized;
        const semitones = this.pitchBend * this.pitchBendRange;
        this.synth.channels[this.track].pitchBend(semitones);
    }
    PitchBendRange(cmd) {
        this.pitchBendRange = cmd.range;
        const semitones = this.pitchBend * this.pitchBendRange;
        this.synth.channels[this.track].pitchBend(semitones);
    }
    Priority(cmd) { }
    NoteWaitMode(cmd) {
        this.noteWaitEnabled = cmd.enabled;
    }
    Tie(cmd) { }
    PortamentoControl(cmd) {
        this.portamentoKey = cmd.key;
    }
    ModulationDepth(cmd) {
        this.modulationDepth = cmd.depth;
        this.synth.channels[this.track].setModulation(this.modulationDepth, this.modulationRange, this.modulationSpeed, this.modulationDelay, this.modulationType);
    }
    ModulationSpeed(cmd) {
        this.modulationSpeed = cmd.speed;
        this.synth.channels[this.track].setModulation(this.modulationDepth, this.modulationRange, this.modulationSpeed, this.modulationDelay, this.modulationType);
    }
    ModulationType(cmd) {
        this.modulationType = cmd.modType;
        this.synth.channels[this.track].setModulation(this.modulationDepth, this.modulationRange, this.modulationSpeed, this.modulationDelay, this.modulationType);
    }
    ModulationRange(cmd) {
        this.modulationRange = cmd.range;
        this.synth.channels[this.track].setModulation(this.modulationDepth, this.modulationRange, this.modulationSpeed, this.modulationDelay, this.modulationType);
    }
    PortamentoSwitch(cmd) {
        if (cmd.enabled && !this.portamentoSwitch) {
            this.portamentoKey = Note.C4;
        }
        this.portamentoSwitch = cmd.enabled;
    }
    PortamentoTime(cmd) {
        this.portamentoTime = cmd.time;
    }
    Attack(cmd) { }
    Decay(cmd) { }
    Sustain(cmd) { }
    Release(cmd) { }
    LoopStart(cmd) { }
    Volume2(cmd) {
        this.volume2 = cmd.volume;
        this.synth.channels[this.track].setVolume(this.volume1, this.volume2);
    }
    PrintVariable(cmd) { }
    ModulationDelay(cmd) {
        this.modulationDelay = cmd.delay;
        this.synth.channels[this.track].setModulation(this.modulationDepth, this.modulationRange, this.modulationSpeed, this.modulationDelay, this.modulationType);
    }
    Tempo(cmd) {
        this.changeTempoCallback(cmd.tempo);
    }
    SweepPitch(cmd) { }
    LoopEnd(cmd) { }
    Return(cmd) {
        this.pointer = this.callReturnStack.pop();
    }
    AllocateTracks(cmd) { }
    Fin(cmd) {
        this.stopTrackCallback(this.track);
        // Hacky way to stop the tick while loop
        this.wait = -1;
    }
}

// http://www.feshrine.net/hacking/doc/nds-sdat.php#sbnk
var EnvelopeState;
(function (EnvelopeState) {
    EnvelopeState[EnvelopeState["Attack"] = 0] = "Attack";
    EnvelopeState[EnvelopeState["Decay"] = 1] = "Decay";
    EnvelopeState[EnvelopeState["Sustain"] = 2] = "Sustain";
    EnvelopeState[EnvelopeState["Release"] = 3] = "Release";
})(EnvelopeState || (EnvelopeState = {}));
class Envelope {
    constructor(startTime, attackRate, decayRate, sustainLevel, releaseRate, stopTime) {
        this.state = EnvelopeState.Attack;
        this.gain = -92544;
        this.startTime = startTime;
        if (stopTime === undefined) {
            this.stopTime = startTime + 100000;
        }
        else {
            this.stopTime = stopTime;
        }
        this.attackRate = ADSRConverter.convertAttack(attackRate);
        this.decayRate = ADSRConverter.convertFall(decayRate);
        this.sustainLevel = ADSRConverter.convertSustain(sustainLevel);
        this.releaseRate = ADSRConverter.convertFall(releaseRate);
    }
    tick(time) {
        if (time < this.startTime) {
            return;
        }
        if (time > this.stopTime) {
            this.state = EnvelopeState.Release;
        }
        switch (this.state) {
            case EnvelopeState.Attack:
                this.gain = Math.round(this.attackRate * this.gain / 255);
                if (this.gain >= 0) {
                    this.state = EnvelopeState.Decay;
                    this.gain = 0;
                }
                break;
            case EnvelopeState.Decay:
                this.gain -= this.decayRate;
                if (this.gain <= this.sustainLevel) {
                    this.state = EnvelopeState.Sustain;
                    this.gain = this.sustainLevel;
                }
                break;
            case EnvelopeState.Sustain:
                break;
            case EnvelopeState.Release:
                this.gain -= this.releaseRate;
                break;
        }
        if (this.gain < -92544) {
            this.gain = -92544;
        }
        if (this.gain > 0) {
            this.gain = 0;
        }
    }
    get isDone() {
        return this.state === EnvelopeState.Release && this.gain <= -92544;
    }
}

class Resampler {
    static singleSample(source, sourceRate, targetRate, index, loopStartIndex, loopLength) {
        const ratio = targetRate / sourceRate;
        function loopIndex(i) {
            if (i < loopStartIndex) {
                return i;
            }
            return loopStartIndex + ((i - loopStartIndex) % loopLength);
        }
        let sourceSampleIndex = Math.floor(index / ratio);
        if (loopStartIndex !== undefined && loopLength !== undefined) {
            sourceSampleIndex = loopIndex(sourceSampleIndex);
        }
        else {
            if (sourceSampleIndex < 0) {
                return 0;
            }
            if (sourceSampleIndex >= source.length) {
                return null;
            }
        }
        if (sourceSampleIndex < 0 || sourceSampleIndex >= source.length) {
            return 0;
        }
        return source[sourceSampleIndex];
    }
}

class PCMSample {
    constructor(swav, baseNote) {
        this.swav = swav;
        this.sample = swav.toPCM();
        this.baseFreq = noteToFrequency(baseNote);
    }
    getValue(targetSampleRate, index) {
        return Resampler.singleSample(this.sample, this.swav.dataBlock.sampleRate, targetSampleRate, index, this.swav.dataBlock.loop ? this.swav.dataBlock.loopStart : undefined, this.swav.dataBlock.loop ? this.swav.dataBlock.loopLength : undefined);
    }
}

class PSGSample {
    constructor(dutyCycle) {
        this.baseFreq = 1;
        this.dutyCycle = dutyCycle;
    }
    getValue(targetSampleRate, index) {
        // Probably not the best way to do this, but it works
        // See https://www.desmos.com/calculator/me1ndcugzv for more info on how this works
        function triangleWave(x) {
            x = x % 1;
            if (x < 0.5) {
                return 2 * x;
            }
            else {
                return 2 - 2 * x;
            }
        }
        const dutyCycle = this.dutyCycleToThreshold(this.dutyCycle);
        function psgWave(x) {
            // return triangleWave(x) < dutyCycle ? 1 : -1;
            return Math.ceil(dutyCycle - triangleWave(x + dutyCycle / 2));
        }
        return psgWave(index / targetSampleRate) * 2 - 1;
    }
    dutyCycleToThreshold(dutyCycle) {
        /* https://problemkaputt.de/gbatek.htm#dssoundnotes
            0  12.5% "_______-_______-_______-"
            1  25.0% "______--______--______--"
            2  37.5% "_____---_____---_____---"
            3  50.0% "____----____----____----"
            4  62.5% "___-----___-----___-----"
            5  75.0% "__------__------__------"
            6  87.5% "_-------_-------_-------"
            7   0.0% "________________________"
        */
        if (dutyCycle === 7) {
            return 0;
        }
        return (dutyCycle + 1) / 8;
    }
}

const whiteNoise = new Float32Array(48000);
for (let i = 0; i < whiteNoise.length; i++) {
    whiteNoise[i] = Math.random() * 2 - 1;
}
class WhiteNoiseSample {
    constructor() {
        // Literally just guessing here, sounds about right
        this.baseFreq = noteToFrequency(Note.A8);
    }
    getValue(targetSampleRate, index) {
        return Resampler.singleSample(whiteNoise, 48000, targetSampleRate, index, 0, 48000);
    }
}

class PlayingNote {
    constructor(note, envelope, sample, sampleRate, velocity, trackInfo, pan, doneCallback) {
        this.sampleIndex = 0;
        this.modulationPitch = 0;
        this.modulationVolume = 1;
        this.modulationTickCount = 0;
        this.portamentoCounter = 0;
        this.note = note;
        this.notePlusPortamento = note;
        this.envelope = envelope;
        this.sample = sample;
        this.baseFreq = sample.baseFreq;
        this.sampleRate = sampleRate;
        this.velocity = ADSRConverter.convertSustain(velocity);
        this.trackInfo = trackInfo;
        this.pan = ADSRConverter.convertPan(pan);
        this.doneCallback = doneCallback;
        // These need to be copied because they can't be modified while a note is playing
        this.portamentoTime = trackInfo.portamentoTime;
        if (trackInfo.portamentoSwitch) {
            this.portamentoStart = trackInfo.portamentoKey;
            this.notePlusPortamento = trackInfo.portamentoKey;
        }
    }
    getValue() {
        const ratio = noteToFrequency(this.notePlusPortamento + this.trackInfo.pitchBendSemitones + this.modulationPitch) / this.baseFreq;
        const s = this.sample.getValue(this.sampleRate / ratio, Math.floor(this.sampleIndex));
        this.sampleIndex += 1;
        if (s === null || this.envelope.isDone) {
            this.doneCallback();
            return 0;
        }
        const volume = this.velocity
            + this.envelope.gain
            + ADSRConverter.convertSustain(this.trackInfo.volume1)
            + ADSRConverter.convertSustain(this.trackInfo.volume2);
        const actualVolume = ADSRConverter.convertVolume(volume) * this.modulationVolume;
        return Math.min(1, Math.max(0, actualVolume)) * s;
    }
    pitchBend(semitones) {
        const freqBefore = noteToFrequency(this.notePlusPortamento + this.trackInfo.pitchBendSemitones + this.modulationPitch);
        this.trackInfo.pitchBendSemitones = semitones;
        const freqAfter = noteToFrequency(this.notePlusPortamento + this.trackInfo.pitchBendSemitones + this.modulationPitch);
        const ratio = freqAfter / freqBefore;
        this.sampleIndex = this.sampleIndex / ratio;
    }
    setVolume(volume1, volume2) {
        this.trackInfo.volume1 = volume1;
        this.trackInfo.volume2 = volume2;
    }
    setModulation(modDepth, modRange, modSpeed, modDelay, modType) {
        this.trackInfo.modDepth = modDepth;
        this.trackInfo.modRange = modRange;
        this.trackInfo.modSpeed = modSpeed;
        this.trackInfo.modDelay = modDelay;
        this.trackInfo.modType = modType;
    }
    modulationTick(time) {
        this.modulationTickCount++;
        if (this.modulationTickCount < this.trackInfo.modDelay) {
            return;
        }
        if (this.trackInfo.modDepth === 0) {
            return;
        }
        if (this.modulationStartTime === undefined) {
            this.modulationStartTime = time;
        }
        const modulationAmplitude = (this.trackInfo.modDepth / 127) * this.trackInfo.modRange;
        const modulationFreq = (this.trackInfo.modSpeed / 127) * 50;
        const modulationValue = modulationAmplitude * Math.sin(2 * Math.PI * modulationFreq * (time - this.modulationStartTime));
        if (this.trackInfo.modType === ModType.Pitch) {
            const freqBeforeModulation = noteToFrequency(this.notePlusPortamento + this.trackInfo.pitchBendSemitones + this.modulationPitch);
            this.modulationPitch = modulationValue;
            const freqAfterModulation = noteToFrequency(this.notePlusPortamento + this.trackInfo.pitchBendSemitones + this.modulationPitch);
            const ratio = freqAfterModulation / freqBeforeModulation;
            this.sampleIndex = this.sampleIndex / ratio;
        }
        else if (this.trackInfo.modType === ModType.Volume) {
            // Modulation is given in decibels
            this.modulationVolume = Math.pow(10, modulationValue / 10);
        }
    }
    portamentoTick() {
        if (this.portamentoStart === undefined) {
            return;
        }
        if (this.portamentoTime === 0) {
            return;
        }
        const t = this.portamentoCounter / this.portamentoTime;
        const portamento = this.portamentoStart + (this.note - this.portamentoStart) * Math.min(1, Math.max(0, t));
        const freqBeforeModulation = noteToFrequency(this.notePlusPortamento + this.trackInfo.pitchBendSemitones + this.modulationPitch);
        this.notePlusPortamento = portamento;
        const freqAfterModulation = noteToFrequency(this.notePlusPortamento + this.trackInfo.pitchBendSemitones + this.modulationPitch);
        const ratio = freqAfterModulation / freqBeforeModulation;
        this.sampleIndex = this.sampleIndex / ratio;
        this.portamentoCounter++;
    }
}

class SynthChannel {
    constructor(sampleRate, bank, swars) {
        this.programNumber = 0;
        this.pan = 0;
        this.playing = [];
        this.sampleRate = sampleRate;
        this.bank = bank;
        this.swars = swars;
    }
    getValue() {
        let leftSum = 0;
        let rightSum = 0;
        for (let i = 0; i < this.playing.length; i++) {
            if (this.playing[i]) {
                const rightWeight = Math.min(1, Math.max(0, (this.pan + this.playing[i].pan + 1) / 2));
                const leftWeight = 1 - rightWeight;
                const value = this.playing[i].getValue();
                leftSum += value * leftWeight;
                rightSum += value * rightWeight;
            }
        }
        return [leftSum, rightSum];
    }
    playNote(time, note, velocity, stopTime, trackInfo) {
        const { noteInfo, isPSG, isWhiteNoise } = this.getNoteInfo(note);
        if (noteInfo === null || noteInfo === undefined) {
            console.warn(`Note ${Note[note]} not found in instrument ${this.programNumber}`);
            return;
        }
        const envelope = new Envelope(time, noteInfo.attack, noteInfo.decay, noteInfo.sustain, noteInfo.release, stopTime);
        let sample;
        if (isPSG) {
            const dutyCycle = noteInfo.waveId;
            sample = new PSGSample(dutyCycle);
        }
        else if (isWhiteNoise) {
            sample = new WhiteNoiseSample();
        }
        else {
            const swar = this.swars[noteInfo.waveArchiveId];
            const swav = swar.waves[noteInfo.waveId];
            if (swav === undefined) {
                console.warn(`Wave ${noteInfo.waveId} not found in wave archive ${noteInfo.waveArchiveId}`);
                return;
            }
            sample = new PCMSample(swav, noteInfo.baseNote);
        }
        const index = this.findFirstEmpty();
        this.playing[index] = new PlayingNote(note, envelope, sample, this.sampleRate, velocity, trackInfo, noteInfo.pan, () => {
            this.playing[index] = null;
        });
    }
    getNoteInfo(note) {
        if (this.bank.instruments[this.programNumber] === undefined) {
            return { noteInfo: null, isPSG: false, isWhiteNoise: false };
        }
        switch (this.bank.instruments[this.programNumber].type) {
            case InstrumentType.WhiteNoise: {
                const instrument = this.bank.instruments[this.programNumber];
                return { noteInfo: instrument.noteInfo, isPSG: false, isWhiteNoise: true };
            }
            case InstrumentType.PSG: {
                const instrument = this.bank.instruments[this.programNumber];
                return { noteInfo: instrument.noteInfo, isPSG: true, isWhiteNoise: false };
            }
            case InstrumentType.PCM:
            case InstrumentType.DirectPCM: {
                const instrument = this.bank.instruments[this.programNumber];
                return { noteInfo: instrument.noteInfo, isPSG: false, isWhiteNoise: false };
            }
            case InstrumentType.DrumSet: {
                const drumSet = this.bank.instruments[this.programNumber];
                if (note < drumSet.lowerKey || note > drumSet.upperKey) {
                    return { noteInfo: null, isPSG: false, isWhiteNoise: false };
                }
                const instrument = drumSet.instruments[note - drumSet.lowerKey];
                return { noteInfo: instrument.noteInfo, isPSG: false, isWhiteNoise: false };
            }
            case InstrumentType.KeySplit: {
                const keySplit = this.bank.instruments[this.programNumber];
                // Find region
                const regions = keySplit.regions;
                let region = 0;
                let i = 0;
                while (true) {
                    if (note < regions[i]) {
                        break;
                    }
                    region++;
                    i++;
                    if (i >= keySplit.regions.length) {
                        return { noteInfo: null, isPSG: false, isWhiteNoise: false };
                    }
                }
                const instrument = keySplit.instruments[region];
                return { noteInfo: instrument.noteInfo, isPSG: false, isWhiteNoise: false };
            }
        }
    }
    envelopeTick(time) {
        for (let i = 0; i < this.playing.length; i++) {
            if (this.playing[i]) {
                this.playing[i].envelope.tick(time);
                this.playing[i].modulationTick(time);
                this.playing[i].portamentoTick();
            }
        }
    }
    changeProgram(programNumber) {
        this.programNumber = programNumber;
    }
    pitchBend(semitones) {
        for (let i = 0; i < this.playing.length; i++) {
            if (this.playing[i]) {
                this.playing[i].pitchBend(semitones);
            }
        }
    }
    setVolume(volume1, volume2) {
        for (let i = 0; i < this.playing.length; i++) {
            if (this.playing[i]) {
                this.playing[i].setVolume(volume1, volume2);
            }
        }
    }
    setModulation(modDepth, modRange, modSpeed, modDelay, modType) {
        for (let i = 0; i < this.playing.length; i++) {
            if (this.playing[i]) {
                this.playing[i].setModulation(modDepth, modRange, modSpeed, modDelay, modType);
            }
        }
    }
    findFirstEmpty() {
        for (let i = 0; i < this.playing.length; i++) {
            if (this.playing[i] === null) {
                return i;
            }
        }
        return this.playing.length;
    }
}

class Synthesizer {
    constructor(bank, swars, sampleRate, bpm, sink, bufferLength = 1024 * 4) {
        this.sampleRemainder = 0;
        this.pos = 0;
        this.time = 0;
        this.sampleRate = sampleRate;
        this.bpm = bpm;
        this.bufferLength = bufferLength;
        this.sink = sink;
        this.buffer = [];
        for (let i = 0; i < 2; i++) {
            this.buffer[i] = new Float32Array(this.bufferLength);
        }
        this.timePerSample = 1 / this.sampleRate;
        this.channels = [];
        for (let i = 0; i < 16; i++) {
            this.channels[i] = new SynthChannel(sampleRate, bank, swars);
        }
    }
    tick(numSamples) {
        if (this.sampleRemainder > 1) {
            numSamples += Math.floor(this.sampleRemainder);
            this.sampleRemainder -= Math.floor(this.sampleRemainder);
        }
        for (let i = 0; i < this.channels.length; i++) {
            this.channels[i].envelopeTick(this.time);
        }
        for (let i = 0; i < numSamples; i++) {
            let sample = [0, 0];
            for (let j = 0; j < this.channels.length; j++) {
                const samples = this.channels[j].getValue();
                for (let k = 0; k < samples.length; k++) {
                    sample[k] += samples[k] / 16;
                }
            }
            for (let j = 0; j < sample.length; j++) {
                this.buffer[j][this.pos] = sample[j];
            }
            this.pos++;
            this.time += this.timePerSample;
            if (this.pos >= this.bufferLength) {
                this.pos = 0;
                this.sink(this.buffer);
            }
        }
        this.sampleRemainder += numSamples - Math.floor(numSamples);
    }
    playNote(track, note, velocity = 127, duration, trackInfo) {
        // duration -> 48 = 1 quarter note
        // durationtime = (duration / 48) / (bpm / 60);
        let stopTime;
        if (duration) {
            stopTime = this.time + (duration / 48) / (this.bpm / 60);
        }
        else {
            stopTime = undefined;
        }
        this.channels[track].playNote(this.time, note, velocity, stopTime, trackInfo);
    }
}

class SequenceVariables {
    constructor(override) {
        if (override) {
            if (override.length !== 32) {
                throw new Error("Sequence variables must have 32 entries.");
            }
            this.variables = override;
        }
        else {
            this.variables = new Array(32).fill(-1);
        }
    }
    resetLocal() {
        for (let i = 0; i < 16; i++) {
            this.variables[i] = -1;
        }
    }
    resetGlobal() {
        for (let i = 16; i < 32; i++) {
            this.variables[i] = -1;
        }
    }
    set(index, value) {
        this.variables[index] = value;
    }
    get(index) {
        return this.variables[index];
    }
}

class Random {
    constructor(seed = Date.now()) {
        this.seed = seed;
    }
    next() {
        // Xorshift32
        let x = this.seed;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        this.seed = x;
        return x;
    }
}

/**
 * Renders an SSEQ to a stereo buffer of 32-bit floating point samples.
 */
class SequenceRenderer {
    constructor(info) {
        this.tracksStarted = false;
        this.cycle = 0;
        this.tempo = 120;
        this.commands = info.file.commands;
        this.sampleRate = info.sampleRate ? info.sampleRate : 48000;
        this.activeTracks = info.activeTracks ? info.activeTracks : 0xFFFF;
        this.sequenceVariables = info.variables ? info.variables : new SequenceVariables();
        this.random = new Random(info.seed);
        this.synth = new Synthesizer(info.file.bank, info.file.swars, info.sampleRate, this.tempo, info.sink, info.bufferLength);
        // this.samplesPerTick = SequenceRenderer.TICK_INTERVAL * sampleRate;
        // Do this to avoid floating point rounding errors
        this.samplesPerTick = ((64 * 2728) * info.sampleRate) / 33513982;
        this.tracks = [];
        this.openTrack(0, 0);
    }
    /**
     * Runs the renderer for one tick. Call this in a loop to render the entire sequence.
     * The renderer will call the sink function when it has a buffer to output.
     */
    tick() {
        this.synth.tick(this.samplesPerTick);
        this.cycle += this.tempo;
        if (this.cycle < 240) {
            return;
        }
        this.cycle -= 240;
        for (const track of this.tracks) {
            if (track) {
                track.tick();
            }
        }
    }
    openTrack(track, offset) {
        if (this.tracks.length > 16) {
            throw new Error("Too many tracks");
        }
        const t = new Track(track, offset, this.commands, this.synth, this.sampleRate, this.sequenceVariables, this.random, this.stopTrack.bind(this), this.changeTempo.bind(this), this.openTrack.bind(this));
        if (1 << track & this.activeTracks) {
            t.active = true;
        }
        else {
            t.active = false;
        }
        this.tracks[track] = t;
    }
    stopTrack(track) {
        this.tracks[track] = null;
    }
    changeTempo(tempo) {
        this.tempo = tempo;
        this.synth.bpm = tempo;
    }
    static makeInfoSSEQ(sdat, id) {
        let sseqFile;
        if (typeof id === "string") {
            sseqFile = sdat.fs.sequences.find(s => s.name === id);
        }
        else {
            sseqFile = sdat.fs.sequences.find(s => s.id === id);
        }
        if (!sseqFile) {
            throw new Error(`Sequence ${id} not found`);
        }
        const sbnkFile = sdat.fs.banks.find(b => b.id === sseqFile.fileInfo.bankId);
        const sbnkInfo = sbnkFile.fileInfo;
        let swar = [];
        for (let i = 0; i < sbnkInfo.waveArchives.length; i++) {
            const waveArchiveId = sbnkInfo.waveArchives[i];
            const waveArchive = sdat.fs.waveArchives.find(w => w.id === waveArchiveId);
            if (waveArchive) {
                swar[i] = new SWAR(waveArchive.buffer);
            }
        }
        const sseq = new SSEQ(sseqFile.buffer);
        const sbnk = new SBNK(sbnkFile.buffer);
        return {
            commands: sseq.data.commands,
            bank: sbnk,
            swars: swar
        };
    }
    static makeInfoSSAR(sdat, id, subId) {
        let ssarFileIndex;
        if (typeof id === "string") {
            ssarFileIndex = sdat.fs.sequenceArchives.findIndex(s => s.name === id);
        }
        else {
            ssarFileIndex = sdat.fs.sequenceArchives.findIndex(s => s.id === id);
        }
        if (ssarFileIndex === -1) {
            throw new Error(`Sequence Archive ${id} not found`);
        }
        const ssarFile = sdat.fs.sequenceArchives[ssarFileIndex];
        const ssar = new SSAR(ssarFile.buffer);
        let subSequenceIndex;
        if (typeof subId === "string") {
            subSequenceIndex = ssarFile.sequenceSymbols.findIndex(s => s === subId);
        }
        else {
            subSequenceIndex = subId;
        }
        if (subSequenceIndex === -1) {
            throw new Error(`Sequence ${subId} not found in Sequence Archive ${id}`);
        }
        const subSequence = ssar.dataBlock.sequenceTable.entries[subSequenceIndex];
        const sbnkFile = sdat.fs.banks.find(b => b.id === subSequence.bankId);
        const sbnkInfo = sbnkFile.fileInfo;
        let swar = [];
        for (let i = 0; i < sbnkInfo.waveArchives.length; i++) {
            const waveArchiveId = sbnkInfo.waveArchives[i];
            const waveArchive = sdat.fs.waveArchives.find(w => w.id === waveArchiveId);
            if (waveArchive) {
                swar[i] = new SWAR(waveArchive.buffer);
            }
        }
        const sbnk = new SBNK(sbnkFile.buffer);
        return {
            commands: ssar.getSequenceData(subSequenceIndex),
            bank: sbnk,
            swars: swar
        };
    }
}
SequenceRenderer.TICK_INTERVAL_MS = ((64 * 2728) * 1000 / 33513982);

class Sample {
}

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ADSRConverter: ADSRConverter,
    BankInfo: BankInfo,
    Block: Block,
    Command: Command,
    CommandParser: CommandParser,
    get CommandType () { return CommandType; },
    get Commands () { return Commands; },
    ContainedInstrument: ContainedInstrument,
    DirectInstrument: DirectInstrument,
    DrumSetInstrument: DrumSetInstrument,
    get EncodingType () { return EncodingType; },
    Envelope: Envelope,
    get EnvelopeState () { return EnvelopeState; },
    GroupEntry: GroupEntry,
    get GroupEntryType () { return GroupEntryType; },
    GroupInfo: GroupInfo,
    InfoBlock: InfoBlock,
    Instrument: Instrument,
    InstrumentTableEntry: InstrumentTableEntry,
    get InstrumentType () { return InstrumentType; },
    KeySplitInstrument: KeySplitInstrument,
    get ModType () { return ModType; },
    NestedCommand: NestedCommand,
    get Note () { return Note; },
    NoteInfo: NoteInfo,
    OffsetCommand: OffsetCommand,
    PCMSample: PCMSample,
    PSGSample: PSGSample,
    PlayerInfo: PlayerInfo,
    PlayingNote: PlayingNote,
    Random: Random,
    Resampler: Resampler,
    SBNK: SBNK,
    SBNKDataBlock: SBNKDataBlock,
    SDAT: SDAT,
    SDATFS: SDATFS,
    SDATHeader: SDATHeader,
    SSAR: SSAR,
    SSARDataBlock: SSARDataBlock,
    SSEQ: SSEQ,
    SSEQDataBlock: SSEQDataBlock,
    STRM: STRM,
    STRMDataBlock: STRMDataBlock,
    STRMInfoBlock: STRMInfoBlock,
    SWAR: SWAR,
    SWAV: SWAV,
    SWAVDataBlock: SWAVDataBlock,
    Sample: Sample,
    SequenceArchiveEntry: SequenceArchiveEntry,
    SequenceArchiveFile: SequenceArchiveFile,
    SequenceArchiveInfo: SequenceArchiveInfo,
    SequenceInfo: SequenceInfo,
    SequenceRenderer: SequenceRenderer,
    SequenceVariables: SequenceVariables,
    SoundFile: SoundFile,
    SoundFileHeader: SoundFileHeader,
    StreamInfo: StreamInfo,
    StreamPlayerInfo: StreamPlayerInfo,
    SynthChannel: SynthChannel,
    Synthesizer: Synthesizer,
    Table: Table,
    TableEntry: TableEntry,
    Track: Track,
    Uint32TableEntry: Uint32TableEntry,
    WaveArchiveInfo: WaveArchiveInfo,
    WhiteNoiseSample: WhiteNoiseSample,
    commandTypeToString: commandTypeToString,
    noteToFrequency: noteToFrequency
});

export { index as Audio, BTX0, BTX0Header, BufferReader, CartridgeHeader, Compression, InfoSection, NCG, NCL, NitroFS, PaletteInfo, PaletteInfoSection, TEX0, TEX0Header, TextureInfo, TextureInfoSection };
