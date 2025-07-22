const express = require('express');
// const cors = require('cors');
const path = require('path');
const apiRouter = require('./routes');

const app = express();

// --- Global Middleware ---
// app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- API Routes ---
app.use('/api', apiRouter);

// --- Serve React App (Static Files) ---
const staticServePath = path.join(__dirname, '..', 'public');
console.log('Serving static files from:', staticServePath);

app.use((req, res, next) => {
	if (req.path.endsWith('.wasm')) {
		// console.log(`Serving WASM file: ${req.path} with application/wasm MIME type`);
		res.setHeader('Content-Type', 'application/wasm');
	}
	next();
});

app.use(express.static(staticServePath));

app.use('/api/*', (req, res, next) => {
	res.status(404).json({ message: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

app.get('*', (req, res) => {
	if (!req.path.startsWith('/api/') && req.method === 'GET') {
		const indexPath = path.join(staticServePath, 'index.html');
		res.sendFile(indexPath, err => {
			if (err) {
				console.error('Error sending index.html:', err);
				if (err.status === 404) {
					res.status(404).send('Frontend entry point (index.html) not found.');
				}
				else {
					res.status(500).send('Error serving frontend.');
				}
			}
		});
	}
	else if (req.path.startsWith('/api/')) {
		res.status(404).json({ message: 'API endpoint not found' });
	}
	else {
		res.status(404).send('Resource not found.');
	}
});

app.use((err, req, res, next) => {
	console.error('Global Error Handler:', err.stack || err);
	if (req.path.startsWith('/api/')) {
		if (res.headersSent) {
			return next(err);
		}

		res.status(err.status || 500).json({
			message: err.message || 'An unexpected server error occurred.',
			...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
		});
	}
	else {
		next(err);
	}
});

module.exports = app;
