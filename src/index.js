'use strict';

global.__base = __dirname;

require('log-timestamp');

const db = require('./utils/db');
const tg = require('./bot');
const scheduler = require('./utils/scheduler');

process.on('SIGTERM', close);
process.on('SIGTERM', close);

async function close(signal) {
	console.log(`[MAIN] Exiting process: ${signal} reveived`);
	tg.close(signal);
	scheduler.close(signal);
	await db.close(signal);
}