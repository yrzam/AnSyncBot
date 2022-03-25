'use strict';

const EventEmitter = require('events');

const subscriptions = require('../models/subscriptions');
// const interchanges = require('../controllers/interchanges') //lazy require because of circular dependency

const events = new EventEmitter();

async function register(chatId, interchangeId, updateNames, isGroup = false) {
	await subscriptions.findOneAndUpdate(
		{
			chatId: chatId,
			interchangeId: interchangeId,
			isGroup: isGroup
		},
		{
			$addToSet: { updates: updateNames }
		},
		{
			upsert: true
		}
	);
	console.log(`[SUBSCR] Registered updates ${updateNames} for ${chatId
		}, interchange id ${interchangeId}, isGroup ${isGroup}`)
}

async function process(interchangeId, updateName, optObj = null, excludedChatIds = []) {
	console.log(`[SUBSCR] Processing update "${updateName}" for ${interchangeId
		}, excluded ${excludedChatIds.length ? excludedChatIds : 'none'}`);
	const matches = (await subscriptions.find({ interchangeId: interchangeId }))
		.filter(el => el.updates.includes(updateName))
		.filter(el => !excludedChatIds.includes(el.chatId))
	if (matches.length)
		events.emit(updateName,
			{
				userIds: matches.filter(el => !el.isGroup).map(el => el.chatId),
				groupId: matches.find(el => el.isGroup)?.chatId,
				interchange: (updateName == 'success'
					? optObj || await require('../controllers/interchanges').getWithAnswers(interchangeId)
					: optObj || await require('../controllers/interchanges').get(interchangeId)
				)
			}
		)
}

async function deregisterExceptFor(interchangeId, excludedChatIds) {
	await subscriptions.deleteMany({
		interchangeId: interchangeId,
		chatId: { $nin: excludedChatIds }
	});
	console.log(`[SUBSCR] Removing all updates for ${interchangeId
		} for users except ${excludedChatIds.length ? excludedChatIds : 'none'}`);
}


async function migrateToSupergroup(oldId, newId) {
	await subscriptions.updateMany(
		{
			isGroup: true,
			chatId: oldId
		},
		{
			chatId: newId
		}
	);
	console.log(`[SUBSCR] Chat ${oldId} migrated to ${newId}`);
}

module.exports = {
	register, process, deregisterExceptFor, migrateToSupergroup,
	events
}