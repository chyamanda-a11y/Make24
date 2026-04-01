#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LEGACY_TOOL_DIR = '/Users/Hongyan/Documents/droidhen/client.google/tools/image_compress';
const LOCAL_TOOL_DIR = path.resolve(__dirname, 'bin');
const DEFAULT_CACHE_DIR = path.resolve(__dirname, '.cache');
const PNG_BINARY_CANDIDATES = [
    process.env.MAKE24_PNGQUANT_BIN,
    path.join(LOCAL_TOOL_DIR, 'pngout'),
    path.join(LEGACY_TOOL_DIR, 'pngquant'),
    path.join(LEGACY_TOOL_DIR, 'pngout'),
    'pngquant',
    'pngout',
].filter(Boolean);
const JPG_BINARY_CANDIDATES = [
    process.env.MAKE24_JPEGOPTIM_BIN,
    path.join(LEGACY_TOOL_DIR, 'jpegoptim'),
    'jpegoptim',
    '/usr/bin/sips',
].filter(Boolean);

function main() {
    const options = parseArguments(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    validateOptions(options);

    const inputRoot = path.resolve(options.input);
    const outputRoot = options.inPlace ? null : path.resolve(options.output);
    const cacheFile = resolveCacheFile(inputRoot, outputRoot, options);
    const cache = loadCache(cacheFile);
    const inputStats = fs.statSync(inputRoot);
    const files = collectFiles(inputRoot);
    const expectedOutputs = new Set();
    const stats = {
        visited: files.length,
        compressed: 0,
        copied: 0,
        skipped: 0,
        unchanged: 0,
        bytesBefore: 0,
        bytesAfter: 0,
        warnings: [],
    };

    const tools = options.dryRun
        ? { png: null, jpg: null }
        : {
            png: resolveTool('png', options.pngBin, PNG_BINARY_CANDIDATES, options.timeoutMs, options.verbose),
            jpg: resolveTool('jpg', options.jpgBin, JPG_BINARY_CANDIDATES, options.timeoutMs, options.verbose),
        };

    if (!options.dryRun) {
        ensureDirectory(path.dirname(cacheFile));
        if (outputRoot) {
            ensureDirectory(outputRoot);
        }
    }

    for (const inputFile of files) {
        const relativePath = getRelativePath(inputRoot, inputFile, inputStats);
        const outputFile = outputRoot ? path.join(outputRoot, relativePath) : inputFile;
        const cacheKey = outputRoot ? `${inputFile}=>${outputFile}` : inputFile;
        const nextHash = hashFile(inputFile);
        const previousHash = cache[cacheKey] ?? '';
        const fileInfo = {
            inputFile,
            outputFile,
            relativePath,
            extension: path.extname(inputFile).toLowerCase(),
        };

        if (outputRoot) {
            expectedOutputs.add(outputFile);
        }

        if (previousHash === nextHash && outputExists(outputFile)) {
            stats.unchanged += 1;
            log(options.verbose, `skip unchanged ${relativePath}`);
            continue;
        }

        const action = planAction(fileInfo);

        if (options.dryRun) {
            console.log(`[dry-run] ${action} ${relativePath}`);
            stats.skipped += 1;
            continue;
        }

        ensureDirectory(path.dirname(outputFile));

        if (action === 'compress-png') {
            compressPng(fileInfo, tools.png, options, stats);
        } else if (action === 'compress-jpg') {
            compressJpg(fileInfo, tools.jpg, options, stats);
        } else {
            copyFile(fileInfo, stats);
        }

        cache[cacheKey] = outputRoot ? nextHash : hashFile(inputFile);
    }

    if (!options.dryRun && outputRoot) {
        cleanupOutput(outputRoot, expectedOutputs, cacheFile, options.verbose);
    }

    if (!options.dryRun) {
        saveCache(cacheFile, cache);
    }

    printSummary(options, tools, cacheFile, stats);
}

function getRelativePath(inputRoot, inputFile, inputStats) {
    if (inputStats.isFile()) {
        return path.basename(inputFile);
    }

    return path.relative(inputRoot, inputFile);
}

function parseArguments(argv) {
    const options = {
        input: '',
        output: '',
        inPlace: false,
        dryRun: false,
        verbose: false,
        help: false,
        pngQuality: '70-90',
        jpgQuality: 80,
        pngBin: '',
        jpgBin: '',
        cacheFile: '',
        timeoutMs: 30000,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];

        switch (argument) {
            case '--input':
                options.input = argv[index + 1] ?? '';
                index += 1;
                break;
            case '--output':
                options.output = argv[index + 1] ?? '';
                index += 1;
                break;
            case '--in-place':
                options.inPlace = true;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--png-quality':
                options.pngQuality = argv[index + 1] ?? '';
                index += 1;
                break;
            case '--jpg-quality':
                options.jpgQuality = Number.parseInt(argv[index + 1] ?? '', 10);
                index += 1;
                break;
            case '--png-bin':
                options.pngBin = argv[index + 1] ?? '';
                index += 1;
                break;
            case '--jpg-bin':
                options.jpgBin = argv[index + 1] ?? '';
                index += 1;
                break;
            case '--cache-file':
                options.cacheFile = argv[index + 1] ?? '';
                index += 1;
                break;
            case '--timeout-ms':
                options.timeoutMs = Number.parseInt(argv[index + 1] ?? '', 10);
                index += 1;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                throw new Error(`Unsupported argument: ${argument}`);
        }
    }

    return options;
}

function validateOptions(options) {
    if (!options.input) {
        throw new Error('Missing required --input');
    }

    if (!fs.existsSync(options.input)) {
        throw new Error(`Input path does not exist: ${options.input}`);
    }

    if (options.inPlace && options.output) {
        throw new Error('Use either --output or --in-place, not both');
    }

    if (!options.inPlace && !options.output) {
        throw new Error('Missing required --output when --in-place is not used');
    }

    if (!Number.isInteger(options.jpgQuality) || options.jpgQuality < 1 || options.jpgQuality > 100) {
        throw new Error(`Invalid --jpg-quality value: ${String(options.jpgQuality)}`);
    }

    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 500) {
        throw new Error(`Invalid --timeout-ms value: ${String(options.timeoutMs)}`);
    }
}

function printHelp() {
    console.log(`Make24 image compressor

Usage:
  node tools/image-compress/compress-images.js --input <path> --output <path> [options]
  node tools/image-compress/compress-images.js --input <path> --in-place [options]

Options:
  --input <path>         Source file or directory.
  --output <path>        Mirror compressed output directory.
  --in-place             Compress image files in place.
  --dry-run              Print planned actions without writing files.
  --verbose, -v          Print detailed logs.
  --png-quality <range>  pngquant quality range, default: 70-90.
  --jpg-quality <1-100>  JPEG quality, default: 80.
  --png-bin <path>       Explicit pngquant binary path.
  --jpg-bin <path>       Explicit jpegoptim binary path.
  --cache-file <path>    Override cache file location.
  --timeout-ms <ms>      Per-file compression timeout, default: 30000.
  --help, -h             Show this help.

Examples:
  node tools/image-compress/compress-images.js --input assets/resources/sprites --output /tmp/make24-sprites
  node tools/image-compress/compress-images.js --input assets/resources/sprites/cover --in-place --dry-run --verbose
`);
}

function resolveCacheFile(inputRoot, outputRoot, options) {
    if (options.cacheFile) {
        return path.resolve(options.cacheFile);
    }

    const cacheKey = crypto
        .createHash('sha1')
        .update(`${inputRoot}|${outputRoot ?? '__in_place__'}`)
        .digest('hex')
        .slice(0, 12);
    const cacheName = `${path.basename(inputRoot)}-${cacheKey}.json`;

    return path.join(DEFAULT_CACHE_DIR, cacheName);
}

function loadCache(cacheFile) {
    if (!fs.existsSync(cacheFile)) {
        return {};
    }

    try {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (error) {
        console.warn(`Failed to read cache file ${cacheFile}, recreating it.`, error.message);
        return {};
    }
}

function saveCache(cacheFile, cache) {
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}

function collectFiles(inputRoot) {
    const stats = fs.statSync(inputRoot);

    if (stats.isFile()) {
        return [inputRoot];
    }

    const files = [];
    const queue = [inputRoot];

    while (queue.length > 0) {
        const currentDir = queue.shift();

        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            if (entry.name === '.DS_Store') {
                continue;
            }

            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                queue.push(fullPath);
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }
    }

    files.sort();
    return files;
}

function planAction(fileInfo) {
    if (fileInfo.extension === '.png') {
        return 'compress-png';
    }

    if (fileInfo.extension === '.jpg' || fileInfo.extension === '.jpeg') {
        return 'compress-jpg';
    }

    return 'copy';
}

function resolveTool(kind, explicitPath, candidates, timeoutMs, verbose) {
    const probeCandidates = explicitPath ? [explicitPath] : candidates;

    for (const candidate of probeCandidates) {
        if (!candidate) {
            continue;
        }

        const probe = probeTool(kind, candidate, timeoutMs);

        if (probe.ok) {
            log(verbose, `using ${kind} tool: ${candidate}`);
            return {
                path: candidate,
                kind: probe.kind,
            };
        }

        log(verbose, `skip ${kind} tool ${candidate}: ${probe.reason}`);
    }

    log(verbose, `no usable ${kind} tool found`);
    return null;
}

function probeTool(kind, candidate, timeoutMs) {
    const toolKind = detectToolKind(candidate, kind);
    const args = toolKind === 'sips'
        ? ['-h']
        : toolKind === 'pngout'
            ? []
            : ['--version'];
    const result = spawnSync(candidate, args, {
        encoding: 'utf8',
        timeout: Math.min(timeoutMs, 1500),
    });

    if (result.error) {
        return {
            ok: false,
            reason: result.error.code ?? result.error.message,
        };
    }

    if (result.signal === 'SIGTERM') {
        return {
            ok: false,
            reason: 'probe timeout',
        };
    }

    if (toolKind === 'sips') {
        return { ok: true, kind: 'sips' };
    }

    if (toolKind === 'pngout') {
        const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

        if (output.includes('PNGOUT')) {
            return { ok: true, kind: 'pngout' };
        }
    }

    if (result.status === 0) {
        return { ok: true, kind: toolKind };
    }

    return {
        ok: false,
        reason: `exit ${String(result.status)}`,
    };
}

function compressPng(fileInfo, tool, options, stats) {
    if (!tool) {
        copyFile(fileInfo, stats, 'png compressor unavailable, copied original');
        return;
    }

    if (tool.kind === 'pngout') {
        compressPngWithPngout(fileInfo, tool, options, stats);
        return;
    }

    const tempOutput = createTempOutputPath(fileInfo.outputFile);
    const sourceSize = fs.statSync(fileInfo.inputFile).size;
    const result = spawnSync(tool.path, [
        '--force',
        '--skip-if-larger',
        '--strip',
        '--speed',
        '1',
        '--quality',
        options.pngQuality,
        '--output',
        tempOutput,
        '--',
        fileInfo.inputFile,
    ], {
        encoding: 'utf8',
        timeout: options.timeoutMs,
    });

    if (result.error) {
        safeRemove(tempOutput);
        copyFile(fileInfo, stats, `pngquant failed, copied original: ${result.error.message}`);
        return;
    }

    if (!fs.existsSync(tempOutput)) {
        copyFile(fileInfo, stats, 'pngquant skipped larger file, copied original');
        return;
    }

    replaceOutput(tempOutput, fileInfo.outputFile);
    const outputSize = fs.statSync(fileInfo.outputFile).size;

    stats.compressed += 1;
    stats.bytesBefore += sourceSize;
    stats.bytesAfter += outputSize;
}

function compressPngWithPngout(fileInfo, tool, options, stats) {
    const tempOutput = createTempOutputPath(fileInfo.outputFile);
    const sourceSize = fs.statSync(fileInfo.inputFile).size;
    const result = spawnSync(tool.path, [
        fileInfo.inputFile,
        tempOutput,
        '-q',
        '-y',
    ], {
        encoding: 'utf8',
        timeout: options.timeoutMs,
    });

    if (result.error) {
        safeRemove(tempOutput);
        copyFile(fileInfo, stats, `pngout failed, copied original: ${result.error.message}`);
        return;
    }

    if (!fs.existsSync(tempOutput)) {
        copyFile(fileInfo, stats, 'pngout did not produce output, copied original');
        return;
    }

    const outputSize = fs.statSync(tempOutput).size;

    if (outputSize >= sourceSize) {
        safeRemove(tempOutput);
        copyFile(fileInfo, stats, 'pngout output was not smaller, copied original');
        return;
    }

    replaceOutput(tempOutput, fileInfo.outputFile);
    stats.compressed += 1;
    stats.bytesBefore += sourceSize;
    stats.bytesAfter += outputSize;
}

function compressJpg(fileInfo, tool, options, stats) {
    if (!tool) {
        copyFile(fileInfo, stats, 'jpeg tool unavailable, copied original');
        return;
    }

    const sourceSize = fs.statSync(fileInfo.inputFile).size;

    if (tool.kind === 'sips') {
        const tempOutput = createTempOutputPath(fileInfo.outputFile);
        const result = spawnSync(tool.path, [
            '-s',
            'format',
            'jpeg',
            '-s',
            'formatOptions',
            String(options.jpgQuality),
            fileInfo.inputFile,
            '--out',
            tempOutput,
        ], {
            encoding: 'utf8',
            timeout: options.timeoutMs,
        });

        if (result.error || !fs.existsSync(tempOutput)) {
            safeRemove(tempOutput);
            copyFile(fileInfo, stats, 'sips failed, copied original');
            return;
        }

        replaceOutput(tempOutput, fileInfo.outputFile);
    } else {
        const tempOutput = createTempOutputPath(fileInfo.outputFile);
        fs.copyFileSync(fileInfo.inputFile, tempOutput);
        const result = spawnSync(tool.path, [
            '--strip-all',
            '--all-progressive',
            `-m${String(options.jpgQuality)}`,
            tempOutput,
        ], {
            encoding: 'utf8',
            timeout: options.timeoutMs,
        });

        if (result.error || result.status !== 0) {
            safeRemove(tempOutput);
            copyFile(fileInfo, stats, 'jpegoptim failed, copied original');
            return;
        }

        replaceOutput(tempOutput, fileInfo.outputFile);
    }

    const outputSize = fs.statSync(fileInfo.outputFile).size;
    stats.compressed += 1;
    stats.bytesBefore += sourceSize;
    stats.bytesAfter += outputSize;
}

function copyFile(fileInfo, stats, warning) {
    if (fileInfo.inputFile !== fileInfo.outputFile) {
        fs.copyFileSync(fileInfo.inputFile, fileInfo.outputFile);
    }

    if (warning) {
        stats.warnings.push(`${fileInfo.relativePath}: ${warning}`);
    }

    stats.copied += 1;
}

function createTempOutputPath(outputFile) {
    const extension = path.extname(outputFile);
    const basename = path.basename(outputFile, extension);
    const tempName = `.${basename}.${process.pid}.${Date.now()}.tmp${extension}`;
    return path.join(path.dirname(outputFile), tempName);
}

function replaceOutput(tempOutput, outputFile) {
    ensureDirectory(path.dirname(outputFile));
    fs.renameSync(tempOutput, outputFile);
}

function outputExists(outputFile) {
    return fs.existsSync(outputFile);
}

function hashFile(filename) {
    const hash = crypto.createHash('sha1');
    const data = fs.readFileSync(filename);

    hash.update(data);
    return hash.digest('hex');
}

function ensureDirectory(targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });
}

function cleanupOutput(outputRoot, expectedOutputs, cacheFile, verbose) {
    const files = collectFiles(outputRoot);

    for (const filename of files) {
        if (filename === cacheFile) {
            continue;
        }

        if (expectedOutputs.has(filename)) {
            continue;
        }

        log(verbose, `remove stale output ${filename}`);
        safeRemove(filename);
    }
}

function safeRemove(filename) {
    if (fs.existsSync(filename)) {
        fs.rmSync(filename, { force: true });
    }
}

function printSummary(options, tools, cacheFile, stats) {
    console.log(`visited: ${stats.visited}`);
    console.log(`compressed: ${stats.compressed}`);
    console.log(`copied: ${stats.copied}`);
    console.log(`unchanged: ${stats.unchanged}`);
    console.log(`dryRunSkipped: ${stats.skipped}`);
    console.log(`cacheFile: ${cacheFile}`);

    if (!options.dryRun) {
        console.log(`pngTool: ${tools.png ? tools.png.path : 'unavailable'}`);
        console.log(`jpgTool: ${tools.jpg ? tools.jpg.path : 'unavailable'}`);
        console.log(`beforeBytes: ${stats.bytesBefore}`);
        console.log(`afterBytes: ${stats.bytesAfter}`);

        if (stats.bytesBefore > 0) {
            const savedBytes = stats.bytesBefore - stats.bytesAfter;
            console.log(`savedBytes: ${savedBytes}`);
        }
    }

    if (stats.warnings.length > 0) {
        console.log('warnings:');
        stats.warnings.forEach((warning) => console.log(`  - ${warning}`));
    }
}

function detectToolKind(candidate, fallbackKind) {
    const basename = path.basename(candidate).toLowerCase();

    if (basename === 'pngout') {
        return 'pngout';
    }

    if (basename === 'pngquant') {
        return 'pngquant';
    }

    if (basename === 'sips') {
        return 'sips';
    }

    if (basename === 'jpegoptim') {
        return 'jpegoptim';
    }

    return fallbackKind;
}

function log(verbose, message) {
    if (verbose) {
        console.log(message);
    }
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
