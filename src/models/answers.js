'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema({

	interchangeId: {type: mongoose.Schema.Types.ObjectId, required: true},
	userId: { type: Number, required: true },
	userFriendlyName: { type: String, required: true },

	isRefusal: { type: Boolean, default: false },

	messageId: Number,
	messageContent: mongoose.Schema.Types.Mixed

})

module.exports = mongoose.model('answers', schema);