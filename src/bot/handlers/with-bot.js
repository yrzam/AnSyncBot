'use strict';

const { Composer, Markup } = require('telegraf');
const { match } = require('@grammyjs/i18n');

const OpError = require(`${__base}/utils/op-error`);
const interchanges = require(`${__base}/controllers/interchanges`);
const subscriptions = require(`${__base}/controllers/subscriptions`);
const answerTypes = require(`${__base}/bot/answer-types`);

const chat = new Composer();

const answerUpdateTypes = ['message', 'callback_query'];

chat.start(async ctx => {
	if (ctx.startPayload.startsWith('info-'))
		return ctx.replyWithHTML(ctx.i18n.t(`withBot.${ctx.startPayload.substring('info-'.length)}`));
	else if (ctx.startPayload.startsWith('join-')) {
		const interchange = await interchanges.getByInvitation(
			ctx.startPayload.substring('join-'.length));

		if (!interchange) throw new OpError('errors.joinFailures.notInDb');
		if (interchange.fromGroup) {
			try {
				console.log(`[WITH_BOT] Checking whether ${ctx.from.id} is a member of group ${interchange.groupData.id}`)
				const memberInfo = await ctx.telegram.getChatMember(interchange.groupData.id, ctx.from.id);
				if (memberInfo.status != 'member' && memberInfo.status != 'restricted'
					&& memberInfo.status != 'administrator' && memberInfo.status != 'creator') throw -1;
			} catch (err) {
				throw new OpError('errors.joinFailures.notMemberOfChat');
			}
		}
		if (interchange.status !== 'pending') {
			delete ctx.session.lastInterchangeData;
			return ctx.replyWithHTML(ctx.i18n.t(`errors.joinFailures.${interchange.status}`),
				(interchange.status == 'success'
					? Markup.inlineKeyboard([[
						Markup.button.callback(ctx.i18n.t('withBot.queryResults'), `res-${interchange._id}`)]])
					: Markup.removeKeyboard())
			);
		}
		if (await interchanges.alreadyAnswered(interchange._id, ctx.chat.id)) {
			delete ctx.session.lastInterchangeData;
			throw new OpError('errors.alreadyAnswered');
		}

		console.log(`[WITH_BOT] Join succeed for ${ctx.from.id}, interchange id ${interchange._id}`);

		await subscriptions.register(ctx.from.id, interchange._id, ['progress', 'failure']);
		await answerTypes.find(el => el.name == interchange.answerType).prompt(ctx, interchange);
		ctx.session.lastInterchangeData = {
			id: String(interchange._id),
			answerType: interchange.answerType,
			isAnonymous: interchange.isAnonymous
		}
		ctx.session.kbLazyRemoveId = String(interchange._id);
	}
	else return ctx.replyWithHTML(ctx.i18n.t(`withBot.start`, { me: ctx.botInfo.username }),
		Markup.inlineKeyboard([
			[Markup.button.switchToChat(ctx.i18n.t('withBot.tryInPrivate'), '')],
			[Markup.button.url(ctx.i18n.t('withBot.addToGroup'), `t.me/${ctx.botInfo.username}?startgroup=1`)]
		]))
});

chat.hears(match('withBot.refuseButton'), async ctx => {
	await ctx.deleteMessage().catch(e => e);
	return ctx.replyWithHTML(ctx.i18n.t('withBot.qRefuseConfirmation'),
		Markup.inlineKeyboard([
			Markup.button.callback(ctx.i18n.t('basic.yes'), 'leave'),
			Markup.button.callback(ctx.i18n.t('basic.no'), 'do-not-leave')
		])
	)
});
chat.action('leave', async ctx => {
	await ctx.deleteMessage().catch(e => e);
	if (ctx.session.lastInterchangeData) {
		await interchanges.submitAnswer(ctx.session.lastInterchangeData.id, {
			userId: ctx.from.id,
			userFriendlyName: ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
			isRefusal: true
		})
		delete ctx.session.lastInterchangeData;
	}
	await ctx.replyWithHTML(ctx.i18n.t('withBot.youRefused'), Markup.removeKeyboard());
})
chat.action('do-not-leave', ctx => ctx.deleteMessage().catch(e => e));

chat.action(/^res-.+/, async ctx => {
	const res = await interchanges.getWithAnswers(ctx.callbackQuery.data.substring('res-'.length));
	if (!res || res.status !== 'success') throw new OpError('errors.joinFailures.notInDb');
	if (!res.answers.map(el => el.userId).includes(ctx.from.id)) throw new OpError('errors.viewPermissionDenied');
	await answerTypes.find(el => el.name == res.answerType).explore(ctx, res);
	return ctx.answerCbQuery();
})

chat.use(async ctx => {
	if (!answerUpdateTypes.includes(ctx.updateType)) return;
	if (ctx.callbackQuery) await ctx.answerCbQuery();
	if (!ctx.session.lastInterchangeData) return ctx.replyWithHTML(ctx.i18n.t('errors.noContext'));

	const res = await answerTypes.find(el => el.name == ctx.session.lastInterchangeData.answerType)
		.getResponse(ctx);
	if (!res) return;

	const waitingFor = await interchanges.submitAnswer(ctx.session.lastInterchangeData.id, {
		userId: ctx.from.id,
		userFriendlyName: ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
		messageId: ctx.message?.message_id,
		messageContent: res
	}, ctx.session.lastInterchangeData.isAnonymous);
	delete ctx.session.lastInterchangeData;
	if (waitingFor == 'private') await ctx.replyWithHTML(ctx.i18n.t('withBot.waitingForPartner'), Markup.removeKeyboard());
	else if (waitingFor == 'group') await ctx.replyWithHTML(ctx.i18n.t('withBot.waitingForOthers'), Markup.removeKeyboard());
	else await ctx.replyWithChatAction('typing');
})

module.exports = chat;