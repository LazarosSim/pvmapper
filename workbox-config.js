module.exports = {
	globDirectory: '.',
	globPatterns: [
		'**/*.{lockb,json,js,html,ico,svg,txt,md,css,tsx,ts,toml}'
	],
	swDest: 'sw.js',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	]
};