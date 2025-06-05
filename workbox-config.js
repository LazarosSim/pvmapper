module.exports = {
	globDirectory: '.',
	globPatterns: [
		'**/*.{lockb,json,js,html,ico,svg,txt,md,css,tsx,ts,toml}'
	],
	swDest: 'sw.js',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	],
	runtimeCaching: [
		{
			// Google Fonts stylesheets
			urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
			handler: 'CacheFirst',
			options: {
				cacheName: 'google-fonts-stylesheets',
			},
		},
		{
			// Google Fonts webfont files
			urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
			handler: 'CacheFirst',
			options: {
				cacheName: 'google-fonts-webfonts',
			},
		},
		{
			// external GPT script
			urlPattern: /^https:\/\/cdn\.gpteng\.co\/gptengineer\.js$/i,
			handler: 'NetworkFirst',
			options: {
				cacheName: 'external-scripts',
			},
		},
	],
};