const getReferencedObject = (ref, rootSpec) => {
	if (!ref || !ref.startsWith('#/')) {
		return null;
	}
	const path = ref.substring(2).split('/');
	let current = rootSpec;

	for (const segment of path) {
		if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, segment)) {
			current = current[segment];
		} else {
			return null;
		}
	}

	return current;
};

/**
 * Recursively inlines $ref components within an OpenAPI specification object.
 * @param {object} currentObject - The current part of the spec being processed.
 * @param {object} rootSpec - The entire original OpenAPI spec (to resolve refs from).
 * @param {Set<string>} visitedRefs - To prevent infinite loops in circular $ref structures.
 * @returns {object} The object with $refs inlined.
 */
function inlineRefsRecursive(currentObject, rootSpec, visitedRefs = new Set()) {
	if (!currentObject || typeof currentObject !== 'object') {
		return currentObject;
	}

	if (Array.isArray(currentObject)) {
		return currentObject.map(item => inlineRefsRecursive(item, rootSpec, new Set(visitedRefs)));
	}

	if (currentObject.$ref) {
		const refPath = currentObject.$ref;

		if (visitedRefs.has(refPath)) {
			console.warn(`[Inliner] Circular reference detected for ${refPath}, returning ref itself.`);
			return { $ref: refPath, _circular: true };
		}

		visitedRefs.add(refPath);
		const referencedObject = getReferencedObject(refPath, rootSpec);

		if (referencedObject) {
			const inlinedReferencedObject = inlineRefsRecursive(structuredClone(referencedObject), rootSpec, new Set(visitedRefs));
			visitedRefs.delete(refPath);
			return inlinedReferencedObject;
		} else {
			console.warn(`[Inliner] Could not resolve $ref: ${refPath}`);
			visitedRefs.delete(refPath);
			return currentObject;
		}
	}

	const result = {};

	for (const key in currentObject) {
		if (Object.prototype.hasOwnProperty.call(currentObject, key)) {
			result[key] = inlineRefsRecursive(currentObject[key], rootSpec, new Set(visitedRefs));
		}
	}

	return result;
}

/**
 * Takes an OpenAPI spec and returns a new spec with all #/components/... refs inlined.
 * @param {object} originalSpec - The OpenAPI spec object.
 * @returns {object} A new spec object with components inlined.
 */
function inlineAllComponents(originalSpec) {
	if (!originalSpec || typeof originalSpec !== 'object') {
		return originalSpec;
	}

	const specToInline = structuredClone(originalSpec);

	if (specToInline.paths) {
		specToInline.paths = inlineRefsRecursive(specToInline.paths, originalSpec);
	}

	specToInline.components = {};
	return specToInline;
}

module.exports = { inlineAllComponents };
