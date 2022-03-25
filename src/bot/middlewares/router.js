'use strict';

const { Composer } = require('telegraf');

const inlinePrivate = require('../handlers/inline-private');
const inlineUnsupported = require('../handlers/inline-unsupported');
const group = require('../handlers/group');
const withBot = require('../handlers/with-bot')

function route(ctx) {
	if (ctx.updateType == 'inline_query') {
		if (ctx.update.inline_query.chat_type == 'private') return inlinePrivate;
		else return inlineUnsupported;
	}
	else if (ctx.updateType == 'chosen_inline_result') return inlinePrivate;
	else {
		if (ctx.chat.type == 'private') return withBot;
		else if (ctx.chat.type == 'group' || ctx.chat.type == 'supergroup')
			return group;
	}
}

module.exports = Composer.lazy(ctx => route(ctx));