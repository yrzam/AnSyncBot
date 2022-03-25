'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema({

	interchangeId: { type: mongoose.Types.ObjectId, required: true },
	chatId: { type: Number, required: true },
	isGroup: { type: Boolean, default: false },

	updates: [{
		type: String, enum: ['progress', 'success', 'failure']
	}]

});

module.exports = mongoose.model('subscriptions', schema);