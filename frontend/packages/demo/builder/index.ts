/**
 * Copyright 2020 Baidu Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

import IO from './io';
import type {Worker} from './types';
import {fileURLToPath} from 'url';
import getPort from 'get-port';
import mkdirp from 'mkdirp';
import path from 'path';
import rimraf from 'rimraf';
import {spawn} from 'child_process';

const cwd = path.dirname(fileURLToPath(import.meta.url));

const host = '127.0.0.1';
const publicPath = '/visualdl';
const pages = [
    'common',
    'scalar',
    'histogram',
    'image',
    'audio',
    'text',
    'graph',
    'pr-curve',
    'roc-curve',
    'high-dimensional',
    'hyper-parameter',
    'model-visual'
];
const dataDir = path.resolve(cwd, '../data');

async function start() {
    rimraf.sync(dataDir);

    const port = await getPort({host});

    mkdirp.sync(dataDir);

    const io = new IO(`http://${host}:${port}${publicPath}`, dataDir);

    const p = spawn(
        'visualdl',
        [
            '--logdir',
            '.',
            '--model',
            './__model__',
            '--host',
            host,
            '--port',
            String(port),
            '--public-path',
            publicPath
        ],
        {
            cwd: path.resolve(cwd, '../logs'),
            stdio: ['ignore', 'pipe', 'pipe']
        }
    );

    p.on('error', err => console.error(err));

    const stop = () => {
        if (!p.killed) {
            p.kill('SIGINT');
        }
    };

    const check = async (data: Buffer) => {
        const message = data.toString();
        if (message.startsWith('Running VisualDL')) {
            p.stdout.off('data', check);
            p.stderr.off('data', check);
            await Promise.all(
                pages.map(
                    page =>
                        new Promise((resolve, reject) => {
                            import(`./${page}`)
                                .then(data => data.default)
                                .then((worker: Worker) => worker(io).then(resolve))
                                .catch(reject);
                        })
                )
            );
            await io.generateMeta();
            stop();
        }
    };

    p.stdout.on('data', check);
    p.stderr.on('data', check);

    process.on('exit', stop);
}

start();
