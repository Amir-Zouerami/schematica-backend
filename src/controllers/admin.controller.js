const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { readTeamsDB, writeTeamsDB, readUsersDB, writeUsersDB, cleanupFile } = require('../utils/general');

const createTeam = async (req, res) => {
	try {
		const { name } = req.body;

		if (!name || typeof name !== 'string' || name.trim() === '') {
			return res.status(400).json({ message: 'Team name is required.' });
		}

		const trimmedName = name.trim();
		const teams = await readTeamsDB();

		const existingTeam = teams.find(team => team.name.toLowerCase() === trimmedName.toLowerCase());

		if (existingTeam) {
			return res.status(409).json({ message: `A team with the name "${trimmedName}" already exists.` });
		}

		const newTeam = { id: trimmedName, name: trimmedName };
		teams.push(newTeam);

		await writeTeamsDB(teams);
		res.status(201).json(newTeam);
	}
	catch (error) {
		console.error(`Failed creating team ${req.body?.name?.trim()}`, { actor: req.user.username });

		res.status(500).json({ message: 'Failed to create team.' });
	}
};

const updateTeam = async (req, res) => {
	try {
		const { teamId } = req.params;
		const { name: newName } = req.body;

		if (!newName || typeof newName !== 'string' || newName.trim() === '') {
			return res.status(400).json({ message: 'New team name is required.' });
		}

		const trimmedNewName = newName.trim();
		const teams = await readTeamsDB();
		const users = await readUsersDB();

		const teamIndex = teams.findIndex(team => team.id === teamId);

		if (teamIndex === -1) {
			return res.status(404).json({ message: 'Team not found.' });
		}

		const existingTeam = teams.find(team => team.name.toLowerCase() === trimmedNewName.toLowerCase());

		if (existingTeam && existingTeam.id !== teamId) {
			return res.status(409).json({ message: `A team with the name "${trimmedNewName}" already exists.` });
		}

		teams[teamIndex] = { id: trimmedNewName, name: trimmedNewName };
		await writeTeamsDB(teams);

		const updatedUsers = users.map(user => {
			if (user.teams && user.teams.includes(teamId)) {
				const newUserTeams = user.teams.map(t => (t === teamId ? trimmedNewName : t));
				return { ...user, teams: newUserTeams };
			}

			return user;
		});

		await writeUsersDB(updatedUsers);
		res.json(teams[teamIndex]);
	}
	catch (error) {
		console.error(`Failed updating team ${req.params?.teamId?.trim()}`, { actor: req.user.username });

		res.status(500).json({ message: 'Failed to update team.' });
	}
};

const deleteTeam = async (req, res) => {
	try {
		const { teamId } = req.params;

		const teams = await readTeamsDB();
		const users = await readUsersDB();

		const updatedTeams = teams.filter(team => team.id !== teamId);

		if (teams.length === updatedTeams.length) {
			return res.status(404).json({ message: 'Team not found.' });
		}

		await writeTeamsDB(updatedTeams);

		const updatedUsers = users.map(user => {
			if (user.teams && user.teams.includes(teamId)) {
				const newUserTeams = user.teams.filter(t => t !== teamId);
				return { ...user, teams: newUserTeams };
			}
			return user;
		});

		await writeUsersDB(updatedUsers);
		res.status(204).send();
	}
	catch (error) {
		console.error(`Failed deleting team ${req.params?.teamId}`, { actor: req.user.username });

		res.status(500).json({ message: 'Failed to delete team.' });
	}
};

const getAllUsers = async (req, res) => {
	try {
		const users = await readUsersDB();

		const usersWithoutPasswords = users.map(u => {
			const { password, ...user } = u;

			return user;
		});

		res.json(usersWithoutPasswords);
	}
	catch (error) {
		console.error(`Failed fetching all users`, { actor: req.user.username });

		res.status(500).json({ message: 'Failed to retrieve users.' });
	}
};

const createUser = async (req, res) => {
	const tempFilePath = req.file?.path;

	try {
		const { username, password, role, teams } = req.body;

		if (!username || !password || !role) {
			return res.status(400).json({ message: 'Username, password, and role are required.' });
		}

		const users = await readUsersDB();
		const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());

		if (existingUser) {
			return res.status(409).json({ message: `User "${username}" already exists.` });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		let finalProfileImagePath = '';

		if (tempFilePath) {
			const extension = path.extname(tempFilePath);
			const finalFilename = `${username.toLowerCase()}${extension}`;
			const finalFilePath = path.join(path.dirname(tempFilePath), finalFilename);

			await fs.rename(tempFilePath, finalFilePath);

			finalProfileImagePath = `/profile-pictures/${finalFilename}`;
		}

		const newUser = {
			id: uuidv4(),
			username,
			password: hashedPassword,
			role,
			teams: teams || [],
			profileImage: finalProfileImagePath,
		};

		users.push(newUser);
		await writeUsersDB(users);

		const { password: _, ...userForResponse } = newUser;
		res.status(201).json(userForResponse);
	}
	catch (error) {
		console.error(`Failed creating a user with username: ${req.body?.username}`, {
			actor: req.user?.username,
			userToBeMade: req.body,
		});

		res.status(500).json({ message: 'Failed to create user.' });
	}
	finally {
		await cleanupFile(tempFilePath);
	}
};

const updateUser = async (req, res) => {
	const tempFilePath = req.file?.path;
	let oldProfileImagePath = '';

	try {
		const { userId } = req.params;
		const { role, teams } = req.body;

		const users = await readUsersDB();
		const userIndex = users.findIndex(u => u.id === userId);

		if (userIndex === -1) {
			return res.status(404).json({ message: 'User not found.' });
		}

		const userToUpdate = users[userIndex];

		if (role) userToUpdate.role = role;
		if (teams) userToUpdate.teams = Array.isArray(teams) ? teams : [teams];

		if (tempFilePath) {
			if (userToUpdate.profileImage) {
				oldProfileImagePath = path.join(__dirname, '..', '..', 'public', userToUpdate.profileImage);
			}

			const extension = path.extname(tempFilePath);
			const finalFilename = `${userToUpdate.username.toLowerCase()}${extension}`;
			const finalFilePath = path.join(path.dirname(tempFilePath), finalFilename);

			await fs.rename(tempFilePath, finalFilePath);

			userToUpdate.profileImage = `/profile-pictures/${finalFilename}`;
		}

		await writeUsersDB(users);

		if (oldProfileImagePath) {
			await cleanupFile(oldProfileImagePath);
		}

		const { password, ...updatedUser } = userToUpdate;
		res.json(updatedUser);
	}
	catch (error) {
		console.error(`Failed updating the user: ${req.params?.userId}`, { actor: req.user.username });

		res.status(500).json({ message: 'Failed to update user.' });
	}
	finally {
		await cleanupFile(tempFilePath);
	}
};

const deleteUser = async (req, res) => {
	try {
		const { userId } = req.params;

		if (req.user.id === userId) {
			return res.status(400).json({ message: 'Admins cannot delete their own account.' });
		}

		const users = await readUsersDB();
		const updatedUsers = users.filter(u => u.id !== userId);

		if (users.length === updatedUsers.length) {
			return res.status(404).json({ message: 'User not found.' });
		}

		await writeUsersDB(updatedUsers);
		res.status(204).send();
	}
	catch (error) {
		console.error(`Failed deleting the user: ${req.params?.userId}`, { actor: req.user.username });

		res.status(500).json({ message: 'Failed to delete user.' });
	}
};

module.exports = {
	createTeam,
	updateTeam,
	deleteTeam,
	getAllUsers,
	createUser,
	updateUser,
	deleteUser,
};
