const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { PNG } = require("pngjs");

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function inspectPngBuffer(buffer) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("invalid PNG signature");
  }

  let offset = 8;
  let ihdr = null;
  let sawIdat = false;
  let sawIend = false;
  const idatParts = [];
  const chunks = [];

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error("truncated PNG chunk header");
    const length = buffer.readUInt32BE(offset);
    const typeBuffer = buffer.subarray(offset + 4, offset + 8);
    const type = typeBuffer.toString("ascii");
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    const nextOffset = crcOffset + 4;
    if (nextOffset > buffer.length) throw new Error(`truncated ${type} chunk`);

    const data = buffer.subarray(dataStart, crcOffset);
    const expectedCrc = buffer.readUInt32BE(crcOffset);
    const actualCrc = crc32(Buffer.concat([typeBuffer, data]));
    if (actualCrc !== expectedCrc) throw new Error(`${type} CRC mismatch`);
    chunks.push(type);

    if (type === "IHDR") {
      if (ihdr || chunks.length !== 1 || length !== 13) throw new Error("invalid IHDR");
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
      };
      if (ihdr.width === 0 || ihdr.height === 0) throw new Error("invalid PNG dimensions");
    } else if (type === "IDAT") {
      if (!ihdr || sawIend) throw new Error("invalid IDAT ordering");
      sawIdat = true;
      idatParts.push(data);
    } else if (type === "IEND") {
      if (!ihdr || !sawIdat || length !== 0) throw new Error("invalid IEND");
      sawIend = true;
      if (nextOffset !== buffer.length) throw new Error("data follows IEND");
    } else if (sawIdat && !sawIend && type[0] === type[0].toUpperCase()) {
      throw new Error(`critical chunk ${type} interrupts IDAT stream`);
    }
    offset = nextOffset;
  }

  if (!ihdr || !sawIdat || !sawIend) throw new Error("missing required PNG chunk");
  zlib.inflateSync(Buffer.concat(idatParts));
  const decoded = PNG.sync.read(buffer, { checkCRC: true });
  if (decoded.width !== ihdr.width || decoded.height !== ihdr.height) {
    throw new Error("decoder dimensions do not match IHDR");
  }
  return { ...ihdr, chunks, decoded };
}

function findPngs(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) return findPngs(candidate);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".png") ? [candidate] : [];
  });
}

function auditPngFiles(files, baseDirectory = process.cwd()) {
  const failures = [];
  for (const file of files) {
    try {
      inspectPngBuffer(fs.readFileSync(file));
    } catch (error) {
      failures.push({
        file: path.relative(baseDirectory, file).replaceAll(path.sep, "/"),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { scanned: files.length, failures };
}

if (require.main === module) {
  const projectRoot = path.resolve(__dirname, "..");
  const files = [path.join(projectRoot, "src", "assets"), path.join(projectRoot, "assets")]
    .flatMap(findPngs)
    .sort();
  const result = auditPngFiles(files, projectRoot);
  if (result.failures.length > 0) {
    console.error(`PNG integrity failed: ${result.failures.length}/${result.scanned} malformed file(s).`);
    for (const failure of result.failures) console.error(`${failure.file}: ${failure.error}`);
    process.exitCode = 1;
  } else {
    console.log(`PNG integrity passed: ${result.scanned} PNG files decoded with valid chunks, CRCs, and IDAT streams.`);
  }
}

module.exports = { auditPngFiles, crc32, findPngs, inspectPngBuffer };
