#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_AUDIO_DIR = path.join(REPO_ROOT, 'assets', 'resources', 'audio');
const DEFAULT_BITRATE_KBPS = 128;

function main() {
    const encoder = resolveEncoder();

    if (!encoder) {
        console.error('convert-wav-to-mp3: missing encoder, install `lame` or `ffmpeg` first.');
        process.exit(1);
    }

    const inputFiles = resolveInputFiles(process.argv.slice(2));

    if (inputFiles.length === 0) {
        console.log('convert-wav-to-mp3: no wav files found.');
        return;
    }

    inputFiles.forEach((inputFilePath) => {
        if (!fs.existsSync(inputFilePath)) {
            throw new Error(`convert-wav-to-mp3: file not found: ${toRepoPath(inputFilePath)}`);
        }

        if (path.extname(inputFilePath).toLowerCase() !== '.wav') {
            throw new Error(`convert-wav-to-mp3: only .wav files are supported: ${toRepoPath(inputFilePath)}`);
        }

        const outputFilePath = inputFilePath.replace(/\.wav$/i, '.mp3');

        if (fs.existsSync(outputFilePath)) {
            fs.rmSync(outputFilePath, { force: true });
        }

        runEncoder(encoder, inputFilePath, outputFilePath);
        console.log(`converted ${toRepoPath(inputFilePath)} -> ${toRepoPath(outputFilePath)}`);
    });
}

function resolveEncoder() {
    if (hasCommand('lame')) {
        return 'lame';
    }

    if (hasCommand('ffmpeg')) {
        return 'ffmpeg';
    }

    return null;
}

function hasCommand(command) {
    const result = spawnSync('which', [command], { stdio: 'ignore' });

    return result.status === 0;
}

function resolveInputFiles(rawArgs) {
    if (rawArgs.length > 0) {
        return rawArgs.map((rawArg) => path.resolve(REPO_ROOT, rawArg));
    }

    return collectWavFiles(DEFAULT_AUDIO_DIR);
}

function collectWavFiles(rootDirPath) {
    if (!fs.existsSync(rootDirPath)) {
        return [];
    }

    const wavFilePaths = [];
    const queue = [rootDirPath];

    while (queue.length > 0) {
        const currentDirPath = queue.shift();
        const dirEntries = fs.readdirSync(currentDirPath, { withFileTypes: true });

        dirEntries.forEach((dirEntry) => {
            const nextPath = path.join(currentDirPath, dirEntry.name);

            if (dirEntry.isDirectory()) {
                queue.push(nextPath);
                return;
            }

            if (dirEntry.isFile() && path.extname(dirEntry.name).toLowerCase() === '.wav') {
                wavFilePaths.push(nextPath);
            }
        });
    }

    return wavFilePaths.sort((leftPath, rightPath) => leftPath.localeCompare(rightPath));
}

function runEncoder(encoder, inputFilePath, outputFilePath) {
    switch (encoder) {
        case 'lame':
            runCommand('lame', [
                '-b',
                `${DEFAULT_BITRATE_KBPS}`,
                '--silent',
                inputFilePath,
                outputFilePath,
            ]);
            return;
        case 'ffmpeg':
            runCommand('ffmpeg', [
                '-y',
                '-i',
                inputFilePath,
                '-codec:a',
                'libmp3lame',
                '-b:a',
                `${DEFAULT_BITRATE_KBPS}k`,
                outputFilePath,
            ]);
            return;
        default:
            throw new Error(`convert-wav-to-mp3: unsupported encoder ${encoder}`);
    }
}

function runCommand(command, args) {
    const result = spawnSync(command, args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    if (result.status === 0) {
        return;
    }

    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const message = stderr || stdout || `command exited with status ${result.status}`;

    throw new Error(`convert-wav-to-mp3: ${command} failed: ${message}`);
}

function toRepoPath(targetPath) {
    return path.relative(REPO_ROOT, targetPath) || '.';
}

main();
