'use strict';

class OpError extends Error {
	constructor(message, args) {
		super(message);
		this.args = args;
		this.category = 'operational';
	}
}

module.exports = OpError;