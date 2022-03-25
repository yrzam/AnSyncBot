'use strict';

const crypto = require('crypto');
const base64url = require('base64url')

module.exports = function() {
	return base64url(crypto.randomBytes(48)).substring(0, 48);
}