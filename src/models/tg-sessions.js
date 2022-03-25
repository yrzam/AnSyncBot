'use strict';

const mongoose = require('mongoose');

const session = new mongoose.Schema({

	key: { type: String, required: true },
	data: Object

})

module.exports = mongoose.model('sessions', session)