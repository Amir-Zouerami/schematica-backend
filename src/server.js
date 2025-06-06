const app = require('./app');
const config = require('./config');
const https = require('https');
// const http = require('http');

https.createServer(config.certs, app).listen(config.httpsPort, () => {
	console.log(`HTTPS server running on https://localhost:${config.httpsPort}`);
});

const httpApp = require('express')();
httpApp.use((req, res) => {
	const httpsHost = req.headers.host.replace(/:\d+$/, '');
	return res.redirect(301, `https://${httpsHost}:${config.httpsPort}${req.url}`);
});

// const httpServer = http.createServer(httpApp);
// httpServer.listen(config.httpPort, () => {
// 	console.log(`HTTP redirect server running on https://localhost:${config.httpPort}`);
// });
