'use strict';

const { Composer, Markup } = require('telegraf');

const chat = new Composer();

chat.use((ctx, next) => { if (!ctx.session.config) ctx.session.config = {}; return next() });

async function getConfig(ctx) {
	return {
		maxParticipants: ctx.session.config.maxParticipants || await ctx.getChatMembersCount() - 1,
		maxRefused: ctx.session.config.maxRefused || 0,
		isAnonymous: ctx.session.config.isAnonymous || false,
		validMin: ctx.session.config.validMin
	}
}

async function getConfigMessage(ctx, addDesc = true) {
	const conf = await getConfig(ctx);
	if (!ctx.session.config.maxParticipants) conf.maxParticipants += ` [${ctx.i18n.t('basic.auto')}]`;
	if (!conf.validMin) conf.validMin = ctx.i18n.t('basic.no');
	conf.isAnonymous = conf.isAnonymous ? ctx.i18n.t('basic.yes') : ctx.i18n.t('basic.no');
	conf.description = addDesc ? ctx.i18n.t('group.configDescription') : ''
	return [ctx.i18n.t('group.config', conf),
	{
		reply_markup: Markup.inlineKeyboard([
			[Markup.button.callback(ctx.i18n.t('group.maxParticipants'), 'max-participants')],
			[Markup.button.callback(ctx.i18n.t('group.maxRefused'), 'max-refused')],
			[Markup.button.callback(ctx.i18n.t('group.validMin'), 'valid-min'),
			Markup.button.callback(ctx.i18n.t('group.isAnonymous'), 'is-anonymous')]
		]).reply_markup,
		parse_mode: 'HTML'
	}]
}

chat.command('config', async ctx => {
	const msg = await ctx.replyWithHTML(...await getConfigMessage(ctx));
	ctx.session.lastCfgMessage = msg.message_id;
});

chat.action('max-participants', async ctx => {
	await ctx.replyWithHTML(ctx.i18n.t('group.configPrompt.maxParticipants'), Markup.inlineKeyboard([
		[
			Markup.button.callback('-20', 'adjust-maxParticipants-subtr-20'),
			Markup.button.callback('-5', 'adjust-maxParticipants-subtr-5'),
			Markup.button.callback('-1', 'adjust-maxParticipants-subtr-1'),
			Markup.button.callback('+1', 'adjust-maxParticipants-add-1'),
			Markup.button.callback('+5', 'adjust-maxParticipants-add-5'),
			Markup.button.callback('+20', 'adjust-maxParticipants-add-20'),
		],
		[
			Markup.button.callback('Сбросить', 'reset-maxParticipants'),
			Markup.button.callback('Готово', 'close'),
		]
	]))
	return ctx.answerCbQuery();
})

chat.action('max-refused', async ctx => {
	await ctx.replyWithHTML(ctx.i18n.t('group.configPrompt.maxRefused'), Markup.inlineKeyboard([
		[
			Markup.button.callback('-5', 'adjust-maxRefused-subtr-5'),
			Markup.button.callback('-1', 'adjust-maxRefused-subtr-1'),
			Markup.button.callback('+1', 'adjust-maxRefused-add-1'),
			Markup.button.callback('+5', 'adjust-maxRefused-add-5'),
		],
		[
			Markup.button.callback('Сбросить', 'reset-maxRefused'),
			Markup.button.callback('Готово', 'close'),
		]
	]))
	return ctx.answerCbQuery();
})

chat.action('valid-min', async ctx => {
	await ctx.replyWithHTML(ctx.i18n.t('group.configPrompt.validMin'), Markup.inlineKeyboard([
		[
			Markup.button.callback('-30', 'adjust-validMin-subtr-30'),
			Markup.button.callback('-5', 'adjust-validMin-subtr-5'),
			Markup.button.callback('-1', 'adjust-validMin-subtr-1'),
			Markup.button.callback('+1', 'adjust-validMin-add-1'),
			Markup.button.callback('+5', 'adjust-validMin-add-5'),
			Markup.button.callback('+30', 'adjust-validMin-add-30'),
		],
		[
			Markup.button.callback('-1440', 'adjust-validMin-subtr-1440'),
			Markup.button.callback('-180', 'adjust-validMin-subtr-180'),
			Markup.button.callback('+180', 'adjust-validMin-add-180'),
			Markup.button.callback('+1440', 'adjust-validMin-add-1440'),
		],
		[
			Markup.button.callback('Сбросить', 'reset-validMin'),
			Markup.button.callback('Готово', 'close'),
		]
	]))
	return ctx.answerCbQuery();
})

chat.action('is-anonymous', async ctx => {
	await ctx.replyWithHTML(ctx.i18n.t('group.configPrompt.anonMode'), Markup.inlineKeyboard([
		[
			Markup.button.callback(ctx.i18n.t('basic.no'), 'toggle-anon-no'),
			Markup.button.callback(ctx.i18n.t('basic.yes'), 'toggle-anon-yes')
		]
	]))
	return ctx.answerCbQuery();
})

chat.action(/^adjust\-maxParticipants\-(.+)/, async ctx => {
	const action = ctx.callbackQuery.data.split('-')[2];
	const amount = ctx.callbackQuery.data.split('-')[3];

	if ((action !== 'add' && action != 'subtr') || (amount != '1' && amount != '5' && amount != '20'))
		return ctx.answerCbQuery(ctx.i18n.t('errors.somethingWentWrong'));

	if (action == 'add')
		ctx.session.config.maxParticipants =
			(ctx.session.config.maxParticipants || await ctx.getChatMembersCount() - 1)
			+ parseInt(amount);

	if (action == 'subtr') {
		var possibleCurrent = ctx.session.config.maxParticipants
			|| await ctx.getChatMembersCount() - 1;
		if (possibleCurrent - parseInt(amount) < 2)
			return ctx.answerCbQuery(ctx.i18n.t('errors.wrongNumber'));
		else ctx.session.config.maxParticipants = possibleCurrent - parseInt(amount);
	}

	await ctx.telegram.editMessageText(ctx.chat.id,
		ctx.session.lastCfgMessage, null,
		...await getConfigMessage(ctx, false)).catch(e => e);
	return ctx.answerCbQuery(ctx.i18n.t('group.configPrompt.maxParticipantsCbResult',
		{ num: ctx.session.config.maxParticipants || possibleMax }));
})
chat.action('reset-maxParticipants', async ctx => {
	delete ctx.session.config.maxParticipants;
	await ctx.telegram.editMessageText(ctx.chat.id,
		ctx.session.lastCfgMessage, null,
		...await getConfigMessage(ctx, false)).catch(e => e);
	return ctx.answerCbQuery(ctx.i18n.t('group.configPrompt.maxParticipantsCbResult',
		{ num: ctx.i18n.t('basic.auto') }));
})

chat.action(/^adjust\-maxRefused\-(.+)/, async ctx => {
	const action = ctx.callbackQuery.data.split('-')[2];
	const amount = ctx.callbackQuery.data.split('-')[3];

	if ((action !== 'add' && action != 'subtr') || (amount != '1' && amount != '5'))
		return ctx.answerCbQuery(ctx.i18n.t('errors.somethingWentWrong'));

	if (action == 'add')
		ctx.session.config.maxRefused = (ctx.session.config.maxRefused || 0) + parseInt(amount);

	if (action == 'subtr') {
		if ((ctx.session.config.maxRefused || 0) - parseInt(amount) < 0)
			return ctx.answerCbQuery(ctx.i18n.t('errors.wrongNumber'));
		else ctx.session.config.maxRefused = (ctx.session.config.maxRefused || 0) - parseInt(amount);
	}

	await ctx.telegram.editMessageText(ctx.chat.id,
		ctx.session.lastCfgMessage, null,
		...await getConfigMessage(ctx, false)).catch(e => e);
	return ctx.answerCbQuery(ctx.i18n.t('group.configPrompt.maxRefusedCbResult',
		{ num: ctx.session.config.maxRefused }));
})
chat.action('reset-maxRefused', async ctx => {
	delete ctx.session.config.maxRefused;
	await ctx.telegram.editMessageText(ctx.chat.id,
		ctx.session.lastCfgMessage, null,
		...await getConfigMessage(ctx, false)).catch(e => e);
	return ctx.answerCbQuery(ctx.i18n.t('group.configPrompt.maxRefusedCbResult', { num: 0 }));
})

chat.action(/^adjust\-validMin\-(.+)/, async ctx => {
	const action = ctx.callbackQuery.data.split('-')[2];
	const amount = ctx.callbackQuery.data.split('-')[3];

	if ((action !== 'add' && action != 'subtr') ||
		(amount != '1' && amount != '5' && amount != '30' && amount != '180' && amount != '1440'))
		return ctx.answerCbQuery(ctx.i18n.t('errors.somethingWentWrong'));

	if (action == 'add')
		ctx.session.config.validMin = (ctx.session.config.validMin || 0) + parseInt(amount);

	if (action == 'subtr') {
		if ((ctx.session.config.validMin || 0) - parseInt(amount) < 1)
			return ctx.answerCbQuery(ctx.i18n.t('errors.wrongNumber'));
		else ctx.session.config.validMin = (ctx.session.config.validMin || 0) - parseInt(amount);
	}

	await ctx.telegram.editMessageText(ctx.chat.id,
		ctx.session.lastCfgMessage, null,
		...await getConfigMessage(ctx, false)).catch(e => e);
	return ctx.answerCbQuery(ctx.i18n.t('group.configPrompt.validMinCbResult',
		{ num: ctx.session.config.validMin }));
})
chat.action('reset-validMin', async ctx => {
	delete ctx.session.config.validMin;
	await ctx.telegram.editMessageText(ctx.chat.id,
		ctx.session.lastCfgMessage, null,
		...await getConfigMessage(ctx, false)).catch(e => e);
	return ctx.answerCbQuery(ctx.i18n.t('group.configPrompt.validMinCbResult',
		{ num: ctx.i18n.t('basic.no') }));
})

chat.action(/toggle\-anon\-/, async ctx => {
	const newStatus = ctx.callbackQuery.data.split('-')[2];

	ctx.session.config.isAnonymous = newStatus == 'yes' ? true : false;

	await ctx.telegram.editMessageText(ctx.chat.id,
		ctx.session.lastCfgMessage, null,
		...await getConfigMessage(ctx, false)).catch(e => e);
	return ctx.deleteMessage().catch(e => e);
})

chat.action('close', ctx => ctx.deleteMessage().catch(e => e));

module.exports = {
	middleware: chat,
	getConfig: getConfig
}