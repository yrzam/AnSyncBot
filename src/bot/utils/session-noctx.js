'use strict';

const sessions = require(`${__base}/models/tg-sessions`);

class SessionNoCtx {
	constructor(sessionId, session) {
		this.sessionId = sessionId;
		this.session = session;
	}
	static async load(id, prefix = 'withBot-') {
		const res = await sessions.findOne({ key: prefix + id });
		return new SessionNoCtx(prefix + id, res ? res.data : null)
	}
	t(key, tData) {
		return i18n.t(this.session?.__language_code || i18n.config.defaultLanguage, key, tData)
	}
	async save() {
		return sessions.updateOne({ key: this.sessionId }, { data: this.session });
	}
}

var i18n;
module.exports = {
	init: (bot, _i18n) => { i18n = _i18n; return this },
	SessionNoCtx
}