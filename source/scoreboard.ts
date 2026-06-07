import {
	DisplaySlotId,
	type Entity,
	type Player,
	type ScoreboardObjective,
	type ScoreboardScoreInfo,
	world,
} from "@minecraft/server";
import { DYNAMIC_PROPERTIES } from "./dynamicProperties";
import { ENUMS } from "./enums";

export interface ResultWithMessage {
	bool: boolean;
	message: string;
}

export class ScoreboardManager {
	public objective: ScoreboardObjective;
	constructor(
		public dynamicPropertyId: string,
		private defaultObjectiveId: string,
		private defaultDisplayName: string,
	) {
		let objectiveId = world.getDynamicProperty(this.dynamicPropertyId);

		if (typeof objectiveId !== "string") {
			world.setDynamicProperty(this.dynamicPropertyId, defaultObjectiveId);
			objectiveId = defaultObjectiveId;
		}

		this.objective =
			world.scoreboard.getObjective(objectiveId) ??
			world.scoreboard.addObjective(objectiveId, defaultDisplayName);
	}

	private reloadScoreboard(reloadOptions?: {
		newObjectiveId?: string;
		newDisplayName?: string;
	}): ResultWithMessage {
		const isOnDisplay: Record<DisplaySlotId, boolean> = {
			// biome-ignore lint/style/useNamingConvention: Casing of these properties not in my control, plus its an enum
			BelowName: false,
			// biome-ignore lint/style/useNamingConvention: Same as above
			List: false,
			// biome-ignore lint/style/useNamingConvention: Same as above
			Sidebar: false,
		};
		for (const displayId of Object.values(DisplaySlotId)) {
			const objectiveOnDisplay = world.scoreboard.getObjectiveAtDisplaySlot(displayId);
			if (objectiveOnDisplay && objectiveOnDisplay.objective.id === this.objective.id) {
				isOnDisplay[displayId] = true;
			}
		}
		let scoresBackup: ScoreboardScoreInfo[],
			objectiveIdBackup: string,
			displayNameBackup: string;
		if (this.objective.isValid) {
			scoresBackup = this.objective.getScores();
			objectiveIdBackup = this.objective.id;
			displayNameBackup = this.objective.displayName;
			const result = world.scoreboard.removeObjective(this.objective.id);
			if (!result) {
				return {
					bool: false,
					message: `Failed to remove old objective`,
				};
			}
		} else {
			scoresBackup = [];
			objectiveIdBackup = this.defaultObjectiveId;
			displayNameBackup = this.defaultDisplayName;
		}

		this.objective = world.scoreboard.addObjective(
			reloadOptions?.newObjectiveId ?? objectiveIdBackup,
			reloadOptions?.newDisplayName ?? displayNameBackup,
		);
		for (const score of scoresBackup) {
			this.objective.setScore(score.participant, score.score);
		}

		for (const displayId of Object.values(DisplaySlotId)) {
			if (isOnDisplay[displayId]) {
				world.scoreboard.setObjectiveAtDisplaySlot(displayId, {
					objective: this.objective,
				});
			}
		}

		return {
			bool: true,
			message: `${this.objective.id} reload successful`,
		};
	}

	public setDisplayName(newName: string): ResultWithMessage {
		if (newName.length === 0) {
			return {
				bool: false,
				message: "Length of new name must be greater than 0.",
			};
		}
		const result: ResultWithMessage = this.reloadScoreboard({ newDisplayName: newName });

		return {
			bool: result.bool,
			message: result.bool
				? `Set objective ${this.objective.id} display name to ${newName}`
				: `Unable to set objective ${this.objective.id} display name to ${newName}. ${result.message}`,
		};
	}

	public setId(newId: string): ResultWithMessage {
		if (newId.length === 0) {
			return {
				bool: false,
				message: "Length of new id must be greater than 0.",
			};
		}
		const oldId: string = this.objective.id;
		const result: ResultWithMessage = this.reloadScoreboard({ newObjectiveId: newId });
		if (result.bool) {
			world.setDynamicProperty(this.dynamicPropertyId, this.objective.id);
		}

		return {
			bool: result.bool,
			message: result.bool
				? `Set objective ${oldId} id to ${this.objective.id}`
				: `Unable to set objective ${oldId} display name to ${newId}. ${result.message}`,
		};
	}

	public incrememntScore(entity: Entity): void {
		if (!this.objective.isValid) {
			this.reloadScoreboard();
		}
		if (entity.typeId === "minecraft:player") {
			this.objective.addScore(entity, 1);
		} else {
			MobManager.incrementMobScore(this.objective, entity);
		}
	}

	public initScore(player: Player): void {
		if (!this.objective.isValid) {
			this.reloadScoreboard();
		}
		this.objective.addScore(player, 0);
	}
}

interface ScoreboardNameTag {
	nameTag: string;
	// Number of §r appended
	instanceNum: number;
}

class ScoreboardMobManager {
	// Key is entityId and value is their scoreboard display name.
	// Appends additional §r if a duplicate name is found.
	public nametags: Map<string, ScoreboardNameTag>;

	constructor(public dynamicProperty: string) {
		this.nametags = new Map<string, ScoreboardNameTag>();
	}

	public loadDataFromWorld(): Map<string, ScoreboardNameTag> {
		const dynamicPropertyData = world.getDynamicProperty(this.dynamicProperty);
		if (typeof dynamicPropertyData !== "string") {
			this.saveDataToWorld();
			return this.nametags;
		}
		const parsedData = JSON.parse(dynamicPropertyData);
		if (parsedData instanceof ScoreboardMobManager) {
			this.nametags = parsedData.nametags;
		} else {
			this.saveDataToWorld();
		}
		return this.nametags;
	}

	public saveDataToWorld(): void {
		const valuesAsStr: string = JSON.stringify(this);
		world.setDynamicProperty(this.dynamicProperty, valuesAsStr);
	}

	// Determines how many §r need to be appended to the entity's nametag based on duplicate names in the scoreboard objective.
	private addNewDisplayName(entity: Entity): ScoreboardNameTag | undefined {
		if (!entity.isValid || entity.nameTag.length === 0) {
			return undefined;
		}
		let instanceNum = 1;
		for (const [, data] of this.nametags) {
			if (data.nameTag.startsWith(entity.nameTag) && data.instanceNum >= instanceNum) {
				instanceNum = data.instanceNum + 1;
			}
		}
		this.saveDataToWorld();
		return {
			instanceNum: instanceNum,
			nameTag: entity.nameTag,
		};
	}

	private getDisplayNames(entity: Entity, mobInclusionMode: string): string[] | undefined {
		const modes = ENUMS.mobInclusionMode;
		if (
			mobInclusionMode === modes.disabled ||
			mobInclusionMode === modes.help ||
			!Object.values(modes).includes(mobInclusionMode)
		) {
			return undefined;
		}
		if (mobInclusionMode === modes.typeId) {
			return [this.removeNamespaceAndUnderscores(entity.typeId, true, true)];
		}
		const returnArr: string[] = [];
		let entityDisplayName = this.nametags.get(entity.id);
		// New nametagged entity detected
		if (
			entity.isValid &&
			((entityDisplayName === undefined && entity.nameTag.length !== 0) ||
				entityDisplayName?.nameTag !== entity.nameTag)
		) {
			this.nametags.delete(entity.id);
			entityDisplayName = this.addNewDisplayName(entity);
			if (entityDisplayName) {
				this.nametags.set(entity.id, entityDisplayName);
			}
		}

		if (!entityDisplayName) {
			if (mobInclusionMode === modes.nameTagOnly) {
				return undefined;
			}
			return [this.removeNamespaceAndUnderscores(entity.typeId, true, true)];
		}

		returnArr.push(this.getNumberedNametag(entityDisplayName));
		if (mobInclusionMode === modes.allNameTaggedIncluded) {
			returnArr.push(this.removeNamespaceAndUnderscores(entity.typeId, true, true));
		}
		return returnArr;
	}

	public incrementMobScore(scoreboard: ScoreboardObjective, entity: Entity): void {
		const entityDisplayNames = this.getDisplayNames(
			entity,
			DYNAMIC_PROPERTIES.mobInclusionMode.value,
		);
		if (entityDisplayNames === undefined) {
			return;
		}
		for (const name of entityDisplayNames) {
			scoreboard.addScore(name, 1);
		}
	}

	public shouldTrackEntity(entity: Entity): boolean {
		if (entity.typeId === "minecraft:player") {
			return true;
		}
		const modes = ENUMS.mobInclusionMode;
		switch (DYNAMIC_PROPERTIES.mobInclusionMode.value) {
			case modes.allNameTaggedIncluded:
			case modes.allNameTaggedSeperated:
			case modes.typeId:
				return true;
			case modes.nameTagOnly: {
				if (entity.nameTag.length > 0) {
					return true;
				} else {
					return false;
				}
			}
			default:
				return false;
		}
	}

	public removeEntityName(entity: Entity): void {
		const nameTagData = this.nametags.get(entity.id);
		if (nameTagData === undefined) {
			return;
		}
		KillsManager.objective.removeParticipant(this.getNumberedNametag(nameTagData));
		this.nametags.delete(entity.id);
	}

	private isUppercase(charCode: number): boolean {
		return charCode >= 65 && charCode <= 90;
	}

	// Capitalize param makes the first character of every word capital if true
	private removeNamespaceAndUnderscores(
		str: string,
		capitalize: boolean,
		pluralize: boolean,
	): string {
		const namespaceColonIndex: number = str.indexOf(":");
		str = str.slice(namespaceColonIndex + 1);

		const words = str.split("_");
		if (capitalize) {
			for (let i = 0; i < words.length; i++) {
				const word = words[i];
				if (word === undefined) {
					continue;
				}
				const firstLetter = word[0];
				if (firstLetter === undefined) {
					continue;
				}
				words[i] =
					`${capitalize ? firstLetter.toUpperCase() : firstLetter}${word.slice(1)}`;
			}
		}
		if (pluralize) {
			const lastWord = words[words.length - 1];
			if (lastWord) {
				if (
					lastWord[lastWord.length - 1] === "s" ||
					lastWord[lastWord.length - 1] === "S"
				) {
					words[words.length - 1] = `${lastWord}'`;
				} else {
					// Assume word is all caps if last letter is capital, and use a uppercase S.
					words[words.length - 1] =
						`${lastWord}${this.isUppercase(lastWord.charCodeAt(lastWord.length - 1)) ? "S" : "s"}`;
				}
			}
		}
		return words.join(" ");
	}

	private getNumberedNametag(data: ScoreboardNameTag): string {
		return `${data.nameTag}${data.instanceNum > 1 ? `(${data.instanceNum})` : ""}`;
	}
}

export let KillsManager: ScoreboardManager;
export let DeathsManager: ScoreboardManager;
export const MobManager = new ScoreboardMobManager("fkt:mob_manager");
world.afterEvents.worldLoad.subscribe(() => {
	KillsManager = new ScoreboardManager("fkt:kills_property", "FKT_Kills", "Kills");
	DeathsManager = new ScoreboardManager("fkt:deaths_property", "FKT_Deaths", "Deaths");
	MobManager.loadDataFromWorld();
	for (const p of world.getAllPlayers()) {
		KillsManager.objective.addScore(p, 0);
		DeathsManager.objective.addScore(p, 0);
	}
});
