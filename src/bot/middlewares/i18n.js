'use strict';

const config = require('config')
const { I18n, pluralize } = require('@grammyjs/i18n');

const escape = require('../utils/escape')

const i18n = new I18n({
	defaultLanguageOnMissing: true,
	defaultLanguage: config.get('defaultLocale'),
	directory: './res/locales',
	useSession: true,
	templateData: {
		pluralize,
		rand: arr => arr[Math.floor(Math.random() * arr.length)],
		escape: escape,
		autonl: (str, nBefore, nAfter) => str ? '\n'.repeat(nBefore) + str + '\n'.repeat(nAfter) : '',
		// jstr: (obj) => JSON.stringify(obj, null, 4) // debugging
	}
});

module.exports = i18n;