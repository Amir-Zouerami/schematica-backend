# 📘 Schematica: Modern Collaborative API Documentation Platform		

![schematica-cover-with-text](https://github.com/user-attachments/assets/e73d72fd-3d32-4300-b8c7-b023c3e687ec)

This repository contains the **backend source code** for Schematica.

This is a personal project of mine that I developed a few years ago. It is an API documentation platform based on OpenAPI (similar to Swagger), but developed with a few more features and a better UI (IMHO), written from the ground up.

The goal of this project was to automate a lot of the hassle of maintaining OpenAPI documentation and reduce the friction between backend and frontend teams. Please read the [✨ Features & Quirks](#-features--quirks) section to get an understanding of this project.

</br>

## ⚖️ Tradeoffs

As mentioned in the [✨ Features & Quirks](#-features--quirks) section, Schematica is a small, local, on-disk solution for collaboration between backend and frontend teams.

Everything is designed to be very simple and manual — which is the most important tradeoff for this solution. I'm simply not a fan of complicated solutions for simple problems. I believe Schematica's simplistic approach to collaboration, though burdensome in a few cases, is the ideal solution for a tool meant to stay out of the way.

</br>

## ✨ Features & Quirks

This section is very important. Please read it to understand what Schematica is about.

</br>

### 💾 Local-First

Schematica allows you to create a so-called “Project,” which is, at its core, an OpenAPI Specification JSON file.

Each project is split into two JSON files:

- **Metadata**: contains information such as who last edited project metadata (description, base URL, etc.)
- **OpenAPI**: a slightly customized OpenAPI JSON file containing endpoint metadata via the `x-*` property

Both files are stored locally in the Express.js backend (`/app_data/projects`). This is because Schematica was designed as an internal tool without any dependency on external systems. It’s designed to be a very simple in-house tool that can be spun up quickly in any environment — no need for a database at all.

The same direct on-disk design applies to authentication. In `app_data/users`, there is a `users-db.json` file containing user data. Here's a sample:

```json
[
	{
		"id": "1",
		"username": "amir.zouerami",
		"password": "$2b$10$.N89DXoPtwwgW3nHbrNV9.Rr.nUlTgVLnJvIqW3RFd8SjvEnBX.yK",
		"role": "backend",
		"profileImage": "/profile-pictures/amir.zouerami.png",
		"accessList": {
			"read": true,
			"write": true,
			"update": true,
			"delete": true
		}
	},
	{
		"id": "2",
		"username": "brooklyn.lee",
		"password": "$2b$10$fBUycb7WiVnev3eNjwytyeLn1QbzwMhWI/cR1Q0kOrSHdogoWKz9i",
		"role": "UI",
		"profileImage": "/profile-pictures/brooklyn.lee.png",
		"accessList": {
			"read": true,
			"write": false,
			"update": false,
			"delete": false
		}
	}
]

```

Creating users and their passwords is a matter of defining them manually in this JSON file and running `npm run prepare` to hash their passwords. While creating a user initially, you must store their password as plain text in the `"password"` field and then run the _prepare_ script to hash them. It will skip already hashed users.

⚠️ Important: This script modifies the original `users-db.json` file. Back up your user file before running it.

</br>

### 🌀 CURL Conversion

Schematica allows the backend team to simply paste the CURL request for an endpoint into the CURL input box. This automatically adds the request to the OpenAPI JSON file and attempts to generate schemas for the inputs as well.

These CURL requests are also available for each endpoint via a "**Copy CURL**" button, so the frontend team can easily test them in Postman (or any other HTTP GUI client).

</br>

### 📂 Endpoints Details

Schematica lets you add detailed metadata (headers, query params, path params, etc.) to your endpoints. This includes:

- Request bodies
- Responses
- Developer notes
- Auto-generated schemas for inputs/outputs via sample payloads

</br>

### 📤 Postman Export

The entire project can be exported as a **Postman v2.1** file — useful when either the frontend or backend team wants to share a standardized version of the API project.

</br>

### 📦 OpenAPI Export

The full project can also be downloaded as an OpenAPI JSON file. The exported file strips out any non-standard (i.e. `x-*`) properties, leaving a clean OpenAPI-compatible document.

</br>

### 📝 OpenAPI Editor

The OpenAPI JSON file is directly editable using the Monaco editor (VSCode's editor engine). This is especially handy for bulk edits or importing an entire OpenAPI document into a new Schematica project.

Note: Upon import, the `components` section is flattened and inlined into the individual endpoints, and the original `components` section is removed.

</br>

### 🧠 Optimistic Concurrency Control


In collaborative environments, multiple users may be editing the same project simultaneously. Schematica uses Optimistic Concurrency Control to handle conflicts. If you're editing an outdated version of the project, you'll be prompted with three options:

- ✅ Force overwrite your changes
- 🔄 Discard your changes and update the form with the latest version
- ⏳ Cancel the edit operation (copying your changes before deciding to not lose them)

</br>

### 🕵️‍♂️ Blame

Each endpoint includes two important metadata:

- Who originally added the endpoint and when
- Who last edited the endpoint and when

This makes it easier to audit changes and track down the source of bugs or regressions.

**NOTE**: If you edit the OpenAPI file directly via the Monaco editor, Schematica will attempt a smart merge and update endpoint metadata accordingly

</br>

### 🗒️ Notes

The users with `write` access (see `app_data/users/users-db.json`), apart from being able to add endpoints, etc., can add notes to API endpoints. This is NOT designed to provide a conversation between teams, but for sharing important context or edge cases regarding an endpoint.

</br>

### 🔗 Related Links

Each project can include a set of related links (e.g. GitLab milestones, Slack messages, etc.) displayed as buttons in the UI.

</br>

## 🛠️ Build & Customize

To customize Schematica for your team or company:

1. Edit the basic values in the [`.env`](./.env) (both frontend and backend).
2. clone the [frontend repository](https://github.com/Amir-Zouerami/schematica-frontend) and the [backend repository](https://github.com/Amir-Zouerami/schematica-backend) placing them side by side in a folder.

```bash
# In both frontend/ and backend/ directories
npm install
```

3. In the frontend repo, run:

```bash
npm run build
```
This will generate a production build and automatically move it to the backend's `/public` folder, thanks to the [Vite Config File](./vite.config.ts) file.


⚠️ **WARNING**: Two `wasm` files (`tree-sitter.wasm` and `tree-sitter-bash.wasm`) are required to be present in the backend's `public` folder. They are used by the [curlconverter](https://www.npmjs.com/package/curlconverter) package and must always be available for static serving.

</br>

## 🚧 Disclaimer

This project was built as a personal/internal tool. It works great for its intended use — a local-first, zero-dependency API documentation and collaboration system.

However, if you plan to run it in production or expose it publicly:

- Harden the server
- Add much more extensive logging
- Use a real database
- Implement proper auth flows

</br>

## 🔗 Related Repositories

- [Schematica's frontend](https://github.com/Amir-Zouerami/schematica-frontend)

</br>

<small>Created in a hurry by Amir Zouerami</small>
