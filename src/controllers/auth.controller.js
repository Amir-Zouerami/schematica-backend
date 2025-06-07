const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { writeUsersDB, readUsersDB } = require('../utils/general');

const saltRounds = Number(process.env.SALT_ROUNDS) || 10;

const login = async (req, res) => {
	const { username, password } = req.body;
	console.log(`Login attempt for username: ${username}`);

	if (!username || !password) {
		return res.status(400).json({ message: 'Username and password are required' });
	}

	const usersDB = await readUsersDB();
	const user = usersDB.find(u => u.username === username);

	if (!user) {
		console.log(`Login failed: User ${username} not found`);
		return res.status(401).json({ message: 'Invalid credentials' });
	}

	bcrypt.compare(password, user.password, (err, isMatch) => {
		if (err) {
			console.error('Error during password comparison:', err);
			return res.status(500).json({ message: 'Internal server error' });
		}

		if (!isMatch) {
			console.log(`Login failed: Incorrect password for ${username}`);
			return res.status(401).json({ message: 'Invalid credentials' });
		}

		const userPayloadForToken = {
			userId: user.id,
			username: user.username,
			role: user.role,
			accessList: user.accessList,
		};

		const token = jwt.sign(userPayloadForToken, config.jwtSecret, { expiresIn: process.env.JWT_EXP_TIME || '1h' });

		// eslint-disable-next-line
		const { password: _, ...userWithoutPassword } = user;

		console.log(`Login successful for ${username}. Token generated.`);
		res.json({
			token,
			user: userWithoutPassword,
		});
	});
};

const getMe = async (req, res) => {
	console.log(`/api/auth/me called for user: ${req.user.username}`);

	const usersDB = await readUsersDB();
	const currentUserData = usersDB.find(u => u.id === req.user.id);

	if (!currentUserData) {
		return res.status(404).json({ message: 'User data not found for authenticated user.' });
	}
	
	// eslint-disable-next-line
	const { password: _, ...userWithoutPassword } = currentUserData;

	res.json({ user: userWithoutPassword });
};

const updatePassword = async (req, res) => {
	const { currentPassword, newPassword } = req.body;
	const userId = req.user.id;

	console.log(`Password update attempt for user ID: ${userId} --> ${req.user.username}`);

	if (!currentPassword || !newPassword) {
		return res.status(400).json({ message: 'Current password and new password are required' });
	}

	if (newPassword.length < 8) {
		return res.status(400).json({ message: 'New password must be at least 8 characters long' });
	}
	if (currentPassword === newPassword) {
		return res.status(400).json({ message: 'New password cannot be the same as the current password' });
	}

	const usersDB = await readUsersDB();
	const userIndex = usersDB.findIndex(u => u.id === userId);

	if (userIndex === -1) {
		console.error(`User with ID ${userId} not found in DB during password update.`);
		return res.status(404).json({ message: 'User not found' });
	}

	const user = usersDB[userIndex];

	bcrypt.compare(currentPassword, user.password, (err, isMatch) => {
		if (err) {
			console.error('Error during current password comparison:', err);
			return res.status(500).json({ message: 'Internal server error during password check' });
		}

		if (!isMatch) {
			console.log(`Password update failed: Incorrect current password for user ID ${userId} --> ${req.user.username}`);
			return res.status(400).json({ message: 'Incorrect current password' });
		}

		bcrypt.hash(newPassword, saltRounds, async (hashErr, hashedPassword) => {
			if (hashErr) {
				console.error('Error hashing new password:', hashErr);
				return res.status(500).json({ message: 'Internal server error during password update' });
			}

			usersDB[userIndex].password = hashedPassword;

			try {
				await writeUsersDB(usersDB);
				console.log(`Password updated successfully for user ID ${userId} --> ${req.user.username}`);
				res.json({ message: 'Password updated successfully' });
			} catch (writeError) {
				console.error('Failed to write updated usersDB to file:', writeError);
				res.status(500).json({ message: 'Failed to save new password' });
			}
		});
	});
};

module.exports = {
	login,
	getMe,
	updatePassword,
};
