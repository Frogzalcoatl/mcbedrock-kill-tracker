const IRREGULAR_PLURALS = {
	"minecraft:cod": "cod",
	"minecraft:fox": "foxes",
	"minecraft:enderman": "endermen",
	"minecraft:parched": "parched",
	"minecraft:pufferfish": "pufferfish",
	"minecraft:nautilus": "nautilus",
	"minecraft:salmon": "salmon",
	"minecraft:sheep": "sheep",
	"minecraft:silverfish": "silverfish",
	"minecraft:tnt": "tnt",
	"minecraft:tropicalfish": "tropical_fish",
	"minecraft:vex": "vexes",
	"minecraft:villager_v2": "villagers",
	"minecraft:witch": "witches",
	"minecraft:wolf": "wolves",
	"minecraft:zombie_villager_v2": "zombie_villagers",
	"minecraft:zombie_nautilus": "zombie_nautilus",
	"minecraft:zombie_pigman": "zombie_piglins"
}

function isUppercase(char: string | undefined): boolean {
	if (char === undefined) return false;
	return char === char.toUpperCase() && char !== char.toLowerCase()
}

// Capitalize param makes the first character of every word capital if true
export function removeNamespaceAndUnderscores(
	str: string,
	capitalize: boolean,
	pluralize: boolean,
): string {
	let irregularPlural = false;
	if (pluralize) {
		for (const [id, plural] of Object.entries(IRREGULAR_PLURALS)) {
			if (str === id) {
				str = plural;
				irregularPlural = true;
				break;
			}
		}
		if (!irregularPlural) {
			// Assume str is all caps if last letter is capital, and use a uppercase S.
			str = `${str}${isUppercase(str[str.length - 1]) ? "S" : "s"}`;
		}
	}
	// Namespace is already removed if str is reassigned to an irregular plural
	if (!irregularPlural) {
		const namespaceColonIndex: number = str.indexOf(":");
		if (namespaceColonIndex !== -1) {
			str = str.slice(namespaceColonIndex + 1);
		}
	}
	if (capitalize) {
		const words = str.split("_");
		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			// !word is true for undefined and empty strings
			if (!word) {
				continue;
			}
			const firstLetter = word[0];
			if (!firstLetter) {
				continue;
			}
			words[i] = `${firstLetter.toUpperCase()}${word.slice(1)}`;
		}
		str = words.join(" ");
	}
	return str;
}
