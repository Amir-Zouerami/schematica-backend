const logRequest = (req, _res, next) => {
	if (process.env.VERBOSE_LOGGING !== 'true') {
		return next();
	}

	const timestamp = new Date().toISOString();
	const operatingSystem = req.headers['sec-ch-ua-platform']?.replace(/"/g, '') || 'Unknown';

	const userInfo = {
		id: req.user?.id || 'Unauthenticated',
		username: req.user?.username || 'Unauthenticated',
		role: req.user?.role || 'None',
		teams: req.user?.teams?.join(', ') || 'None',
	};

	const queryParams = Object.keys(req.query).length ? req.query : null;
	const body = Object.keys(req.body || {}).length ? req.body : null;

	const requestInfo = {
		method: req.method,
		path: req.originalUrl,
		protocol: req.protocol,
		host: req.get('host'),
		operatingSystem,
		userAgent: req.headers['user-agent'] || 'N/A',
		referer: req.headers['referer'] || 'N/A',
	};

	const logObject = {
		User: userInfo,
		Request: requestInfo,
		Parameters: {
			Query: queryParams,
			Body: body,
		},
		Timestamp: timestamp,
	};

	console.log(`\n======= New Request [${timestamp}] =======`);
	console.log(logObject);
	console.log(`\n`);
	

	next();
};

module.exports = logRequest;
