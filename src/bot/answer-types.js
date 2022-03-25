'use strict';

const { Markup } = require('telegraf');
const chunk = require('chunk-text');
const emojis = require('emojis-list')

const median = require('compute-median');
const average = require('average');

// ALL ANSWER TYPES IN ONE PLACE. PLEASE ADD ITEM TO THIS ARRAY
// AND MODIFY LOC FILES IN ORDER TO CREATE NEW ONES

/*
 *	METHOD SCHEMA. All functions are asyncronious
 *
 *	name: [string] Name of answer type
 *
 *	prompt (ctx, interchange): Initial prompt message for answer.
 *		Must also produce keyboard with withBot.refuseButton button
 *
 *	getResponse (ctx): Validator for response. Must return non-undefined
 *		value on success, prompt appropriate error otherwise
 *
 *	sendResultsFromPrivate (interchange, userId, bot, snCtx, shouldRemoveKb):
 *		Used to report results for questions originated from private chat.
 *		shouldRemoveKb describes whether keyboard with refuse button should be
 *		removed
 *
 *	sendResultsToGroup (interchange, bot, snCtx): Send results to group chat
 *		MUST RETURN ID OF THE FIRST SENT MESSAGE (FOR LINKAGE)!!!
 *
 *	explore (ctx, interchange): Allows to view results from private chat with
 *		bot. Called only on user request
*/


module.exports = [

	{
		name: 'verbose',
		prompt: genericPrompt,
		getResponse: async ctx => {
			if (ctx.message?.text) return ctx.message.text;
			else await ctx.replyWithHTML(ctx.i18n.t('errors.notText'));
		},
		sendResultsFromPrivate: genericForwardFromPrivate,
		sendResultsToGroup: async (interchange, bot, snCtx) => {
			const text = snCtx.t('answerTypes.verbose.resToGroup', {
				data: interchange.answers.map(el => tAnswerEl(false,
					el.userFriendlyName, el.messageContent, snCtx)).join('\n\n')
			});
			return (await sendChunked(text, interchange.groupData.id, bot, {
				extraFirst: {
					reply_to_message_id: interchange.groupData.promptMessageId,
					allow_sending_without_reply: true
				}
			}))[0]
		},
		explore: genericExplore
	},

	{
		name: 'score',
		prompt: async (ctx, interchange) => {
			await ctx.replyWithHTML(ctx.i18n.t(`answerTypes.score.promptMsg1`,
				{
					creator: ctx.chat.id == interchange.creatorId ?
						ctx.i18n.t('withBot.self') : interchange.creatorFriendlyName,
					question: interchange.question
				}),
				Markup.keyboard([[ctx.i18n.t('withBot.refuseButton')]]).resize());
			await ctx.replyWithHTML(ctx.i18n.t(`answerTypes.score.promptMsg2`),
				Markup.inlineKeyboard(
					[
						[1, 3, 5, 7, 9].map(el => Markup.button.callback(el, `score-${el}`)),
						[2, 4, 6, 8, 10].map(el => Markup.button.callback(el, `score-${el}`))
					]))
		},
		getResponse: async ctx => {
			if (ctx.callbackQuery?.data?.startsWith('score-')) {
				const score = parseInt(ctx.callbackQuery.data.substring('score-'.length));
				if (!(score >= 1 && score <= 10)) {
					await ctx.replyWithHTML(ctx.i18n.t(`errors.notScore`));
					return score;
				}
				await ctx.editMessageReplyMarkup()
				return score;
			}
		},
		sendResultsFromPrivate: async (interchange, userId, bot, snCtx, shouldRemoveKb) => {
			await bot.telegram.sendMessage(userId, snCtx.t(`answerTypes.score.resFromPrivate`, {
				question: interchange.question.toUpperCase(),
				data: interchange.answers.map(el => tAnswerEl(userId == el.userId,
					el.userFriendlyName, `${el.messageContent}/10`, snCtx)).join('\n')
			}),
				{
					parse_mode: 'HTML',
					...(shouldRemoveKb ? Markup.removeKeyboard() : {})
				});
		},
		sendResultsToGroup: async (interchange, bot, snCtx) => {
			const text = snCtx.t('answerTypes.score.resToGroup', {
				creator: interchange.creatorFriendlyName,
				question: interchange.question.toUpperCase(),
				answersCount: interchange.answers.length,
				median: Math.round(median(interchange.answers.map(el => el.messageContent)) * 10) / 10,
				average: Math.round(average(interchange.answers.map(el => el.messageContent)) * 10) / 10,
				data: !interchange.isAnonymous
					? interchange.answers.map(el => tAnswerEl(false,
						el.userFriendlyName, `${el.messageContent}/10`, snCtx)).join('\n')
					: ''
			});
			return (await sendChunked(text, interchange.groupData.id, bot, {
				extraFirst: {
					reply_to_message_id: interchange.groupData.promptMessageId,
					allow_sending_without_reply: true
				}
			}))[0];
		},
		explore: async (ctx, interchange) => {
			const text = ctx.i18n.t('answerTypes.score.explore', {
				creator: interchange.creatorFriendlyName,
				question: interchange.question.toUpperCase(),
				answersCount: interchange.answers.length,
				median: Math.round(median(interchange.answers.map(el => el.messageContent)) * 10) / 10,
				average: Math.round(average(interchange.answers.map(el => el.messageContent)) * 10) / 10,
				data: !interchange.isAnonymous
					? interchange.answers.map(el => tAnswerEl(ctx.from.id == el.userId,
						el.userFriendlyName, `${el.messageContent}/10`, ctx.i18n)).join('\n')
					: ''
			});
			await sendChunked(text, ctx.from.id, ctx, {
				extraFirst: {
					reply_markup: Markup.removeKeyboard()
				}
			})
		}
	},

	{
		name: 'emoji',
		prompt: genericPrompt,
		getResponse: async ctx => {
			if (emojis.includes(ctx.message?.text)) return ctx.message.text;
			else await ctx.replyWithHTML(ctx.i18n.t('errors.notEmoji'));
		},
		sendResultsFromPrivate: genericForwardFromPrivate,
		sendResultsToGroup: async (interchange, bot, snCtx) => {
			const text = snCtx.t('answerTypes.emoji.resToGroup', {
				data: !interchange.isAnonymous
					? interchange.answers.map(el => tAnswerEl(false,
						el.userFriendlyName, el.messageContent, snCtx)).join('\n')
					: interchange.answers.map(el => el.messageContent).join('')
			});
			return (await sendChunked(text, interchange.groupData.id, bot, {
				extraFirst: {
					reply_to_message_id: interchange.groupData.promptMessageId,
					allow_sending_without_reply: true
				}
			}))[0]
		},
		explore: async (ctx, interchange) => {
			const text = ctx.i18n.t('answerTypes.emoji.explore', {
				creator: interchange.creatorFriendlyName,
				question: interchange.question.toUpperCase(),
				data: !interchange.isAnonymous
					? interchange.answers.map(el => tAnswerEl(false,
						el.userFriendlyName, el.messageContent, ctx.i18n)).join('\n')
					: interchange.answers.map(el => el.messageContent).join('')
			});
			await sendChunked(text, ctx.from.id, ctx, {
				extraFirst: {
					reply_markup: Markup.removeKeyboard()
				}
			})
		}
	}

]

function tAnswerEl(isSelf, author, answer, i18n) {
	return i18n.t('basic.answerEl', {
		author: isSelf ? i18n.t('withBot.self') : author,
		answer: answer.replace(/\n/g, ' ').trim()
	});
}

async function sendChunked(text, chatId, bot, { extraFirst, extraLast }) {
	const chunks = chunk(text, 4096);
	let sentIds = [];
	for (let [i, chunk] of chunks.entries()) {
		const msg = await bot.telegram.sendMessage(chatId, chunk,
			{
				parse_mode: 'HTML',
				...(i == 0 ? extraFirst : {}),
				...(i == chunks.length - 1 ? extraLast : {})
			})
		sentIds.push(msg.message_id);
	}
	return sentIds;
}

async function genericPrompt(ctx, interchange) {
	return ctx.replyWithHTML(ctx.i18n.t(`answerTypes.${interchange.answerType}.prompt`,
		{
			creator: ctx.chat.id == interchange.creatorId ?
				ctx.i18n.t('withBot.self') : interchange.creatorFriendlyName,
			question: interchange.question
		}),
		Markup.keyboard([[ctx.i18n.t('withBot.refuseButton')]]).resize())
}

async function genericExplore(ctx, interchange) {
	const text = ctx.i18n.t(`answerTypes.${interchange.answerType}.explore`,
		{
			creator: ctx.chat.id == interchange.creatorId ?
				ctx.i18n.t('withBot.self') : interchange.creatorFriendlyName,
			question: interchange.question.toUpperCase(),
			data: interchange.answers.map(el => tAnswerEl(ctx.from.id == el.userId,
				el.userFriendlyName, el.messageContent, ctx.i18n)).join('\n\n')
		});
	await sendChunked(text, ctx.chat.id, ctx, {
		extraFirst: {
			reply_markup: Markup.removeKeyboard()
		}
	});
}

async function genericForwardFromPrivate(interchange, userId, bot, snCtx, shouldRemoveKb) {
	await bot.telegram.sendMessage(userId, snCtx.t(`answerTypes.${interchange.answerType}.resFromPrivate`, {
		question: interchange.question.toUpperCase()
	}),
		{
			parse_mode: 'HTML',
			...(shouldRemoveKb ? Markup.removeKeyboard() : {})
		});
	for (let ans of interchange.answers)
		await bot.telegram.forwardMessage(userId, ans.userId, ans.messageId)
}