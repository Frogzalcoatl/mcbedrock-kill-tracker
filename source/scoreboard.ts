import {
	DisplaySlotId,
	type Entity,
	EntityTypes,
	Player,
	ScoreboardIdentityType,
	type ScoreboardObjective,
	type ScoreboardScoreInfo,
	world,
} from "@minecraft/server";
import { removeNamespaceAndUnderscores } from "./bootifulTypeIds";
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
		public readonly defaultObjectiveId: string,
		public readonly defaultDisplayName: string,
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
		if (this.objective.isValid) {
			for (const displayId of Object.values(DisplaySlotId)) {
				const objectiveOnDisplay = world.scoreboard.getObjectiveAtDisplaySlot(displayId);
				if (objectiveOnDisplay && objectiveOnDisplay.objective.id === this.objective.id) {
					isOnDisplay[displayId] = true;
				}
			}
		}
		let scoresBackup: ScoreboardScoreInfo[],
			objectiveIdBackup: string,
			displayNameBackup: string;
		// isValid is false if user manuallay removes objective for whatever reason.
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
			const dynamicPropertyData = world.getDynamicProperty(this.dynamicPropertyId);
			objectiveIdBackup =
				typeof dynamicPropertyData === "string"
					? dynamicPropertyData
					: this.defaultObjectiveId;
			displayNameBackup = this.defaultDisplayName;
		}
		this.objective = world.scoreboard.addObjective(
			reloadOptions?.newObjectiveId ?? objectiveIdBackup,
			reloadOptions?.newDisplayName ?? displayNameBackup,
		);
		for (const score of scoresBackup) {
			this.objective.setScore(
				// Non entity participants (name tags) become invalid after removing the objective, but display names are still accessible.
				score.participant.isValid ? score.participant : score.participant.displayName,
				score.score,
			);
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

	public incrememntScore(entity: Entity | string): void {
		if (!this.objective.isValid) {
			this.reloadScoreboard();
		}
		if (typeof entity === "string") {
			this.objective.addScore(entity, 1);
			return;
		}
		if (entity instanceof Player) {
			this.objective.addScore(entity, 1);
		} else {
			MobManager.incrementMobScore(this.objective, entity);
		}
	}

	public initScore(player: Player): void {
		if (this.objective.isValid) {
			this.objective.addScore(player, 0);
		} else {
			this.reloadScoreboard();
			for (const p of world.getAllPlayers()) {
				this.objective.addScore(p, 0);
			}
		}
	}

	public clear(clearMode: string): void {
		if (!this.objective.isValid) {
			return;
		}
		if (clearMode === ENUMS.resetMode.players) {
			for (const p of this.objective.getParticipants()) {
				if (p.type === ScoreboardIdentityType.Player) {
					this.objective.removeParticipant(p);
				}
			}
		} else if (clearMode === ENUMS.resetMode.mobs) {
			for (const p of this.objective.getParticipants()) {
				if (p.type !== ScoreboardIdentityType.Player) {
					this.objective.removeParticipant(p);
				}
			}
		} else if (clearMode === ENUMS.resetMode.all) {
			for (const p of this.objective.getParticipants()) {
				this.objective.removeParticipant(p);
			}
		}
	}
}

interface ScoreboardNameTag {
	nameTag: string;
	// If mobs have the same nametag. instanceCounts greater than 1 are appended Ex: "Name(2)"
	instanceCount: number;
}

class ScoreboardMobManager {
	// Key is entityId and value is their scoreboard display name.
	public nametags: Map<string, ScoreboardNameTag>;

	constructor(public dynamicProperty: string) {
		this.nametags = new Map<string, ScoreboardNameTag>();
	}

	private addNewDisplayName(entity: Entity): ScoreboardNameTag | undefined {
		if (!entity.isValid || entity.nameTag.length === 0) {
			return undefined;
		}
		let instanceNum = 1;
		// To avoid a situation where a mob with the same nametag as a typeid gets merged
		if (BOOTIFUL_ENTITY_TYPEIDS.includes(entity.nameTag)) {
			instanceNum++;
		}
		for (const [, data] of this.nametags) {
			if (data.nameTag === entity.nameTag && data.instanceCount >= instanceNum) {
				instanceNum = data.instanceCount + 1;
			}
		}
		return {
			instanceCount: instanceNum,
			nameTag: entity.nameTag,
		};
	}

	private getNumberedNametag(data: ScoreboardNameTag): string {
		return `${data.nameTag}${data.instanceCount > 1 ? `(${data.instanceCount})` : ""}`;
	}

	private getDisplayNames(entity: Entity, mobInclusionMode: string, onScoreboard: ScoreboardObjective): { displayName?: string, mobName?: string, oldNameTagScore?: number | undefined } {
		const modes = ENUMS.mobInclusionMode;
		if (
			mobInclusionMode === modes.disabled ||
			mobInclusionMode === modes.help ||
			!Object.values(modes).includes(mobInclusionMode)
		) {
			return {};
		}
		if (mobInclusionMode === modes.typeId) {
			return {
				mobName: removeNamespaceAndUnderscores(entity.typeId, true, true)
			};
		}
		const returnArr: string[] = [];
		let scoreboardNameTag = this.nametags.get(entity.id);
		let oldNameTag: number | undefined;
		if (entity.isValid) {
			// Mobs name has been changed from previous display name
			if (scoreboardNameTag !== undefined && scoreboardNameTag.nameTag !== entity.nameTag) {
				const oldDisplayName: string = this.getNumberedNametag(scoreboardNameTag)
				oldNameTag = onScoreboard.getScore(oldDisplayName);
				onScoreboard.removeParticipant(oldDisplayName);
				this.nametags.delete(entity.id);
				scoreboardNameTag = undefined;
			}
			if (scoreboardNameTag === undefined && entity.nameTag.length !== 0) {
				scoreboardNameTag = this.addNewDisplayName(entity);
				if (scoreboardNameTag) {
					this.nametags.set(entity.id, scoreboardNameTag);
					this.saveDataToWorld();
				}
			}
		}
		// Mob doesnt have a nametag
		if (!scoreboardNameTag) {
			if (mobInclusionMode === modes.nameTagOnly) {
				return {};
			}
			return {
				mobName: removeNamespaceAndUnderscores(entity.typeId, true, true)
			}
		}

		returnArr.push(this.getNumberedNametag(scoreboardNameTag));
		if (mobInclusionMode === modes.allNameTaggedIncluded) {
			return {
				displayName: this.getNumberedNametag(scoreboardNameTag),
				mobName: removeNamespaceAndUnderscores(entity.typeId, true, true),
				oldNameTagScore: oldNameTag
			}
		}
		return {
				displayName: this.getNumberedNametag(scoreboardNameTag),
				oldNameTagScore: oldNameTag
		}
	}

	public incrementMobScore(scoreboard: ScoreboardObjective, entity: Entity): void {
		const result = this.getDisplayNames(
			entity,
			DYNAMIC_PROPERTIES.mobInclusionMode.value,
			scoreboard
		);

		if (result.displayName) {
			scoreboard.addScore(result.displayName, 1 + (result.oldNameTagScore ?? 0));
		}
		if (result.mobName) {
			scoreboard.addScore(result.mobName, 1);
		}
	}

	public shouldTrackEntity(entity: Entity): boolean {
		if (entity instanceof Player) {
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

	public removeEntityFromKillsObjective(entity: Entity): void {
		const nameTagData = this.nametags.get(entity.id);
		if (nameTagData === undefined) {
			return;
		}
		KillsManager.objective.removeParticipant(this.getNumberedNametag(nameTagData));
		this.nametags.delete(entity.id);
	}

	public saveDataToWorld(): void {
		const mapAsArr = Array.from(this.nametags.entries());
		const dataToSave = {
			nametags: mapAsArr,
		};
		world.setDynamicProperty(this.dynamicProperty, JSON.stringify(dataToSave));
	}

	public loadDataFromWorld(): Map<string, ScoreboardNameTag> {
		const dynamicPropertyData = world.getDynamicProperty(this.dynamicProperty);
		if (typeof dynamicPropertyData !== "string") {
			this.saveDataToWorld();
			return this.nametags;
		}
		// Since JSON.parse will throw an error if the data is invalid
		try {
			const parsedData = JSON.parse(dynamicPropertyData);
			if (parsedData && Array.isArray(parsedData.nametags)) {
				this.nametags = new Map<string, ScoreboardNameTag>(parsedData.nametags);
			} else {
				this.saveDataToWorld();
			}
		} catch (e) {
			world.sendMessage(`§cFailed to load ScoreboardMobManager dynamic data: ${e}`);
			this.saveDataToWorld();
		}
		return this.nametags;
	}
}

// What if a mob has the same name as one of the mob categories?
const BOOTIFUL_ENTITY_TYPEIDS: string[] = [];
// ScoreboardManager constructor needs to be in system.run()
export let KillsManager: ScoreboardManager;
export let DeathsManager: ScoreboardManager;
export const MobManager = new ScoreboardMobManager("fkt:mob_manager");
world.afterEvents.worldLoad.subscribe(() => {
	const types = EntityTypes.getAll();
	for (const t of types) {
		BOOTIFUL_ENTITY_TYPEIDS.push(removeNamespaceAndUnderscores(t.id, true, true));
	}
	KillsManager = new ScoreboardManager("fkt:kills_property", "FKT_Kills", "Kills");
	DeathsManager = new ScoreboardManager("fkt:deaths_property", "FKT_Deaths", "Deaths");
	MobManager.loadDataFromWorld();
	for (const p of world.getAllPlayers()) {
		KillsManager.initScore(p);
		DeathsManager.initScore(p);
	}
});
