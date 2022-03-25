'use strict';

const { Markup } = require('telegraf');

const subscriptions = require(`${__base}/controllers/subscriptions`);
const answerTypes = require(`${__base}/bot/answer-types`);
const SessionNoCtx = require('./utils/session-noctx').SessionNoCtx;

const updates = subscriptions.events;


updates.on('success', async upd => {
	let failedIds = [];

	// FROM PRIVATE CHAT
	if (!upd.interchange.fromGroup) {
		for (let userId of upd.userIds) {
			console.log(`[MAILER] Notifying user ${userId} about success of ${upd.interchange._id}`)
			try {
				const snCtx = await SessionNoCtx.load(userId);
				await answerTypes.find(el => el.name == upd.interchange.answerType)
					.sendResultsFromPrivate(
						upd.interchange,
						userId,
						bot,
						snCtx,
						snCtx.session?.kbLazyRemoveId == String(upd.interchange._id))
			} catch (err) {
				failedIds.push(userId);
				console.log(`[MAILER] Failed to report results: ${err.message}. Queued user ${userId}`)
			}
		}
	}

	// FROM GROUP CHAT
	else {
		console.log(`[MAILER] Sending results of ${upd.interchange._id} to group ${upd.groupId}`)
		const groupIdForLink = String(upd.groupId).substring(4);
		try {
			const grpSnCtx = await SessionNoCtx.load(upd.groupId, 'group-');
			if (grpSnCtx.session.bindings?.[upd.interchange._id]?.progressMsg) {
				await bot.telegram.deleteMessage(upd.groupId,
					grpSnCtx.session.bindings[upd.interchange._id].progressMsg).catch(e => e);
				delete grpSnCtx.session.bindings[upd.interchange._id];
				await grpSnCtx.save();
			}
			else console.log(`[MAILER] Failed to find progressMsg in session for group ${upd.groupId}`)
			var groupResultMsgId = await answerTypes.find(el => el.name == upd.interchange.answerType)
				.sendResultsToGroup(
					upd.interchange,
					bot,
					grpSnCtx);
			try {
				await bot.telegram.editMessageText(
					upd.groupId,
					upd.interchange.groupData.promptMessageId,
					null,
					grpSnCtx.t('group.promptEdited', {
						question: upd.interchange.question,
						link: ((upd.interchange.groupData.supportsMessageLinks && groupResultMsgId)
							? grpSnCtx.t('group.promptEditSucceedSupergroup', {
								href: `https://t.me/c/${groupIdForLink}/${groupResultMsgId}`
							})
							: grpSnCtx.t('group.promptEditSucceedGroup'))
					}),
					{ parse_mode: 'HTML' })
			} catch { }
		} catch (err) {
			failedIds.push(upd.groupId);
			console.log(`[MAILER] Failed to handle group success event: ${err.message}. Queued group ${upd.groupId}`);
		}
		for (let userId of upd.userIds) {
			console.log(`[MAILER] Notifying user ${userId} about success of ${upd.interchange._id}`)
			try {
				const snCtx = await SessionNoCtx.load(userId);
				if (snCtx.session?.kbLazyRemoveId == String(upd.interchange._id))
					await bot.telegram.sendMessage(
						userId,
						snCtx.t('withBot.removeInlineKbMsg'),
						{
							reply_markup: Markup.removeKeyboard().reply_markup,
							parse_mode: 'HTML'
						}
					)
				await bot.telegram.sendMessage(
					userId,
					snCtx.t('withBot.seeInGroup', {
						question: upd.interchange.question,
						link: ((upd.interchange.groupData.supportsMessageLinks && groupResultMsgId)
							? snCtx.t('withBot.seeInSupergroupExtra',
								{ href: `https://t.me/c/${groupIdForLink}/${groupResultMsgId}` })
							: '')
					}),
					{
						reply_markup: Markup.inlineKeyboard([[
							Markup.button.callback(snCtx.t('withBot.queryResultsHere'), `res-${upd.interchange._id}`)]]).reply_markup,
						parse_mode: 'HTML'
					}
				);
			} catch (err) {
				failedIds.push(userId);
				console.log(`[MAILER] Failed to report results: ${err.message}. Queued user ${userId}`)
			}
		}
	}
	await subscriptions.deregisterExceptFor(upd.interchange._id, failedIds)
		.catch(err => console.log(`[MAILER] Failed to deregister updates: ${err.message}`));
});


updates.on('progress', async upd => {

	// FROM PRIVATE CHAT
	if (!upd.interchange.fromGroup) {
		const snCtx = await SessionNoCtx.load(upd.userIds[0]);
		console.log(`[MAILER] Notifying user ${upd.userIds[0]} about progress of ${upd.interchange._id}`)
		await bot.telegram.sendMessage(
			upd.userIds[0],
			snCtx.t('withBot.partnerAnswered'),
			{ parse_mode: 'HTML' }
		).catch(err => console.log(`[MAILER] Failed to report results: ${err.message}`))
	}

	// FROM GROUP CHAT
	else {
		console.log(`[MAILER] Notifying group ${upd.groupId} about progress of ${upd.interchange._id
			}, answered ${upd.interchange.answersCount}`);
		const grpSnCtx = await SessionNoCtx.load(upd.groupId, 'group-');
		if (grpSnCtx.session.bindings?.[upd.interchange._id]?.progressMsg)
			await bot.telegram.editMessageText(
				upd.groupId,
				grpSnCtx.session.bindings[upd.interchange._id].progressMsg,
				null,
				grpSnCtx.t('group.progress', {
					answered: upd.interchange.answersCount,
					maxAnswered: upd.interchange.maxParticipants,
					answeredPercentage: Math.round(
						upd.interchange.answersCount / upd.interchange.maxParticipants * 100),
					refusesLeft: upd.interchange.maxRefused - upd.interchange.refusedCount
				}),
				{ parse_mode: 'HTML' }
			).catch(e => e);
		else
			console.log(`[MAILER] Failed to find progressMsg in session for group ${upd.groupId}`)
	}
})


updates.on('failure', async upd => {
	let failedToReportIds = [];

	// FROM PRIVATE CHAT
	if (!upd.interchange.fromGroup) {
		console.log(`[MAILER] Notifying user ${upd.userIds[0]} about failure of ${upd.interchange._id}`)
		try {
			const snCtx = await SessionNoCtx.load(upd.userIds[0]);
			await bot.telegram.sendMessage(
				upd.userIds[0],
				snCtx.t('withBot.partnerRefused', { question: upd.interchange.question }),
				{
					parse_mode: 'HTML',
					...((snCtx.session?.kbLazyRemoveId == String(upd.interchange._id))
						? Markup.removeKeyboard() : {})
				});
			if (snCtx.session.lastInterchangeData?.id == String(upd.interchange._id))
				delete snCtx.session.lastInterchangeData;
			await snCtx.save();
		} catch (err) {
			failedToReportIds.push(upd.userIds[0]);
			console.log(`[MAILER] Failed to report results: ${err.message}. Queued user ${upd.userIds[0]}`)
		}
	}

	// FROM GROUP CHAT
	else {
		console.log(`[MAILER] reporting failure ${upd.interchange._id} to group ${upd.groupId
			}. Refused ${upd.interchange.refusedCount}, max ${upd.interchange.maxRefused}`)
		try {
			const grpSnCtx = await SessionNoCtx.load(upd.groupId, 'group-');
			if (grpSnCtx.session.bindings?.[upd.interchange._id]?.progressMsg) {
				await bot.telegram.deleteMessage(upd.groupId,
					grpSnCtx.session.bindings[upd.interchange._id].progressMsg).catch(e => e);
				delete grpSnCtx.session.bindings[upd.interchange._id];
				await grpSnCtx.save();
			}
			else console.log(`[MAILER] Failed to find progressMsg in session for group ${upd.groupId}`);
			await bot.telegram.sendMessage(
				upd.groupId,
				grpSnCtx.t('group.failed', {
					reason: upd.interchange.refusedCount > upd.interchange.maxRefused
						? grpSnCtx.t('errors.tooManyRefuses') : grpSnCtx.t('errors.timeout')
				}),
				{
					parse_mode: 'HTML',
					reply_to_message_id: upd.interchange.groupData.promptMessageId,
					allow_sending_without_reply: true
				}
			)
			try {
				await bot.telegram.editMessageText(
					upd.groupId,
					upd.interchange.groupData.promptMessageId,
					null,
					grpSnCtx.t('group.promptEditFailed', {
						question: upd.interchange.question
					}),
					{ parse_mode: 'HTML' })
			} catch { }
		} catch (err) {
			failedToReportIds.push(upd.groupId);
			console.log(`[MAILER] Failed to handle group failure event: ${err.message}. Queued group ${upd.groupId}`);
		}
		for (let userId of upd.userIds) {
			console.log(`[MAILER] Notifying user ${userId} about failure of ${upd.interchange._id}`)
			try {
				const snCtx = await SessionNoCtx.load(userId);
				await bot.telegram.sendMessage(
					userId,
					snCtx.t('withBot.groupFailed', {
						question: upd.interchange.question,
						reason: upd.interchange.refusedCount > upd.interchange.maxRefused
							? snCtx.t('errors.tooManyRefuses') : snCtx.t('errors.timeout')
					}),
					{
						parse_mode: 'HTML',
						...((snCtx.session?.kbLazyRemoveId == String(upd.interchange._id))
							? Markup.removeKeyboard() : {})
					}
				);
			} catch (err) {
				failedToReportIds.push(userId);
				console.log(`[MAILER] Failed to report failure: ${err.message}. Queued user ${userId}`)
			}
		}
	}

	await subscriptions.deregisterExceptFor(upd.interchange._id, failedToReportIds)
		.catch(err => console.log(`[MAILER] Failed to deregister updates: ${err.message}`));
})

var bot;
module.exports = {
	init: (_bot, _i18n) => { bot = _bot; return this }
}