'use strict';

const mongoose = require('mongoose');
const shuffle = require('shuffle-array')

const OpError = require(`${__base}/utils/op-error`);
const questions = require('../models/questions')
const answers = require('../models/answers');
const subscriptions = require('../controllers/subscriptions')

async function create(params) {
	return questions.create(params);
}

async function getByInvitation(inv) {
	return questions.findOne({ invitation: inv }).select('-answers')
}

async function get(id) {
	return questions.findById(id).select('-answers')
}

async function getWithAnswers(id) {
	const withAnswers = (await questions.findById(id).populate('answers')).toObject();
	withAnswers.answers = shuffle(withAnswers.answers).filter(el => !el.isRefusal);
	return withAnswers;
}

async function alreadyAnswered(interchangeId, userId) {
	return answers.exists({
		interchangeId: interchangeId,
		userId: userId
	})
}

async function submitAnswer(interchangeId, params, isAnonymous = false, subscribeOnSuccess = true) {
	if (isAnonymous) params.userFriendlyName = '???';

	const session = await mongoose.startSession();
	console.log(`[INTCNG] Processing new answer for ${interchangeId}`);
	try {
		session.startTransaction();
		var aRes = await answers.updateOne(
			{
				userId: params.userId,
				interchangeId: interchangeId
			},
			{
				$setOnInsert: { ...params }
			},
			{ upsert: true }
		).session(session);
		if (!aRes.upsertedId) throw new OpError('errors.alreadyAnswered');
		console.log(`[INTCNG] Answer submitted to collection for ${interchangeId}`)

		var qRes = await questions.findOneAndUpdate(
			{ _id: interchangeId },
			[{
				$set: {
					answersCount: {
						$cond: {
							if: { $eq: ['$status', 'pending'] },
							then: { $add: ['$answersCount', 1] },
							else: '$answersCount'
						},
					},
					answers: {
						$cond: {
							if: { $eq: ['$status', 'pending'] },
							then: { $concatArrays: ['$answers', [aRes.upsertedId]] },
							else: '$answers'
						},
					},
					...(params.isRefusal ? {
						refusedCount: {
							$cond: {
								if: { $eq: ['$status', 'pending'] },
								then: { $add: ['$refusedCount', 1] },
								else: '$refusedCount'
							}
						}
					} : {}),
					status: {
						$switch: {
							branches: [
								...params.isRefusal ? [
									{
										case: { $lt: [{ $subtract: ['$maxRefused', '$refusedCount'] }, 1] },
										then: 'failure'
									}] : [],
								{
									case: { $lte: [{ $subtract: ['$maxParticipants', '$answersCount'] }, 1] },
									then: 'success'
								}
							],
							default: 'pending'
						}
					}
				}
			}], { new: true }).session(session);

		if (String(qRes.answers[qRes.answers.length - 1]) == aRes.upsertedId) {
			console.log(`[INTCNG] Answer reflected in base question data for ${interchangeId}`)
			if (subscribeOnSuccess)
				await subscriptions.register(params.userId, interchangeId, 'success');
		}
		else throw new OpError('errors.alreadyEnded');
		await session.commitTransaction();
		session.endSession();

	} catch (err) {
		await session.abortTransaction();
		session.endSession();
		console.log(`[INTCNG] Transaction failed, reverting changes for ${interchangeId
			}. Reason: ${err.message}`);
		throw err;
	}

	try {
		switch (qRes.status) {
			case 'pending':
				await subscriptions.process(interchangeId, 'progress', qRes,
					qRes.fromGroup ? [] : [params.userId]);
				break;
			case 'failure':
				await subscriptions.process(interchangeId, qRes.status, qRes,
					qRes.fromGroup ? [] : [params.userId])
				break;
			case 'success':
				await subscriptions.process(interchangeId, qRes.status);
				break;
		}
	} catch (err) {
		console.log(`[INTCNG] Subscr controller failed to process status: ${err.message}`)
	}

	return qRes.status == 'pending'
		? qRes.fromGroup
			? 'group'
			: 'private'
		: null;
}

async function invalidateTimedOut() {
	do {
		try {
			console.log(`[INTCG] Looking for expired interchanges`)
			var interchange = await questions.findOneAndUpdate(
				{
					status: 'pending',
					validUntil: { $lt: Date.now() }
				},
				{
					status: 'failure'
				},
				{ new: true })
			if (interchange) {
				console.log(`[INTCG] Found expired interchange ${interchange._id}. Status updated`)
				await subscriptions.process(interchange._id, interchange.status, interchange)
			}
			else console.log(`[INTCG] Expired interchanges not found`)
		} catch (err) {
			`[INTCNG] Scheduled invalidate failed: ${err.message}`
		}
	} while (interchange);
}

async function migrateToSupergroup(oldId, newId) {
	await questions.updateMany(
		{
			'groupData.id': oldId
		},
		{
			groupData: {
				id: newId,
				supportsMessageLinks: true,
				promptMessageId: -1
			}
		}
	);
	console.log(`[INTCNG] Chat ${oldId} migrated to ${newId}`);
}

module.exports = {
	create,
	getByInvitation, get, getWithAnswers, alreadyAnswered,
	submitAnswer, invalidateTimedOut,
	migrateToSupergroup
}