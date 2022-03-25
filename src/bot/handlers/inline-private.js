'use strict';

const { Composer, Markup } = require('telegraf');

const genSecret = require(`${__base}/utils/secret-generator`);
const answerTypes = require(`${__base}/bot/answer-types`);
const interchanges = require(`${__base}/controllers/interchanges`)

const chat = new Composer();

chat.on('inline_query', ctx => {
	ctx.session.inviteSecret = genSecret();
	let arr = [];
	if (ctx.inlineQuery.query.length >= 5)
		arr = answerTypes.map(el => ({
			type: 'article',
			id: el.name,
			title: ctx.i18n.t(`answerTypes.${el.name}.inlineTitle`),
			description: ctx.i18n.t(`answerTypes.${el.name}.inlineDescription`),
			input_message_content: {
				message_text: ctx.i18n.t(`answerTypes.${el.name}.inlineMessage`,
					{ question: ctx.inlineQuery.query }),
				disable_web_page_preview: true,
				parse_mode: 'HTML'
			},
			reply_markup: {
				inline_keyboard:
					[[Markup.button.url(ctx.i18n.t(`answerTypes.${el.name}.joinButton`),
						`t.me/${ctx.botInfo.username}?start=join-${ctx.session.inviteSecret}`)]]
			}
		}));
	return ctx.answerInlineQuery(arr, {
		is_personal: true,
		switch_pm_text: ctx.i18n.t('inlinePrivate.help'),
		switch_pm_parameter: 'info-whatIsAnSync',
		cache_time: 0
	});
})

chat.on('chosen_inline_result', async ctx => {
	console.log(`[INL_PRIV] Pushing invitation ${ctx.session.inviteSecret} to db`);
	await interchanges.create({
		invitation: ctx.session.inviteSecret,
		fromGroup: false,
		creatorId: ctx.from.id,
		creatorFriendlyName: ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
		maxParticipants: 2,
		question: ctx.chosenInlineResult.query,
		answerType: ctx.chosenInlineResult.result_id
	})
	delete ctx.session.inviteSecret;
})

module.exports = chat;