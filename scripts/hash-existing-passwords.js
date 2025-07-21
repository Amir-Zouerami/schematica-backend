const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const usersDBPath = path.join(__dirname, '..', 'app_data', 'users', 'users-db.json');
const saltRounds = 10;

console.log(`Reading users from: ${usersDBPath}`);
let users;
try {
	users = JSON.parse(fs.readFileSync(usersDBPath, 'utf-8'));
}
catch (e) {
	console.error('Failed to read or parse users-db.json:', e);
	process.exit(1);
}

const updatedUsers = users.map(user => {
	if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$') && !user.password.startsWith('$2y$')) {
		console.log(`Hashing password for user: ${user.username}`);
		const hashedPassword = bcrypt.hashSync(user.password, saltRounds);
		return { ...user, password: hashedPassword };
	}
	console.log(`Password for user ${user.username} seems already hashed or is empty. Skipping.`);
	return user;
});

try {
	fs.writeFileSync(usersDBPath, JSON.stringify(updatedUsers, null, 2), 'utf-8');
	console.log('Successfully updated users-db.json with hashed passwords.');
}
catch (e) {
	console.error('Failed to write updated users-db.json:', e);
	process.exit(1);
}
