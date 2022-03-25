'use strict';

const answerTypes = require('../answer-types')

module.exports.init = (bot, i18n) => {

	let arr = [{command: 'config', description: i18n.t(i18n.config.defaultLanguage, 'group.configCommand')}];
	arr = arr.concat(answerTypes.map(el => ({
		command: i18n.t(i18n.config.defaultLanguage, `answerTypes.${el.name}.command`),
		description: i18n.t(i18n.config.defaultLanguage, `answerTypes.${el.name}.commandDescription`)
	})))

	bot.telegram.setMyCommands(arr,
		{
			scope: {
				type: 'all_group_chats'
			}
		}
	)

}