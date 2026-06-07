function isUppercase(charCode: number): boolean {
	return charCode >= 65 && charCode <= 90;
}

// Capitalize param makes the first character of every word capital if true
export function removeNamespaceAndUnderscores(
	str: string,
	capitalize: boolean,
	pluralize: boolean,
): string {
	// Weird ah typeids
	if (str === "minecraft:zombie_villager_v2") {
		str = "minecraft:zombie_villager";
	} else if (str === "minecraft:villager_v2") {
		str = "minecraft:villager";
	}
	// man men moment
	else if (str === "minecraft:enderman" && pluralize) {
		str = "minecraft:endermen";
	}
	// Why hasnt this been changed?
	else if (str === "minecraft:zombie_pigman") {
		str = "minecraft:zombie_piglin";
	}
	const namespaceColonIndex: number = str.indexOf(":");
	str = str.slice(namespaceColonIndex + 1);
	const words = str.split("_");
	if (capitalize) {
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
	}
	if (pluralize) {
		const lastWord = words[words.length - 1];
		if (lastWord) {
			if (lastWord[lastWord.length - 1] === "s" || lastWord[lastWord.length - 1] === "S") {
				words[words.length - 1] = `${lastWord}'`;
			} else {
				// Assume word is all caps if last letter is capital, and use a uppercase S.
				words[words.length - 1] =
					`${lastWord}${isUppercase(lastWord.charCodeAt(lastWord.length - 1)) ? "S" : "s"}`;
			}
		}
	}
	return words.join(" ");
}
