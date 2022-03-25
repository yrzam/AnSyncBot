'use strict';

const { Composer } = require('telegraf');

const chat = new Composer();

chat.on('inline_query', ctx => {
	return ctx.answerInlineQuery([], {
		is_personal: true,
		switch_pm_text: ctx.i18n.t('errors.inlineUnsupported'),
		switch_pm_parameter: 'info-whyInlineUnavail',
		cache_time: 0
	});
})

module.exports = chat;