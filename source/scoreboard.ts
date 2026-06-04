import { DisplaySlotId, type ScoreboardObjective, world } from "@minecraft/server";

export interface ScoreboardData {
	objectiveName: string;
	displayName: string;
	objectiveDynamicPropertyId: string;
	objective?: ScoreboardObjective;
}

export enum PackScoreboardNames {
	Kills = "kills",
	Deaths = "deaths",
}

export const SCOREBOARD_DATA: Record<PackScoreboardNames, ScoreboardData> = {
	deaths: {
		displayName: "Deaths",
		objectiveDynamicPropertyId: "FKT_Deaths",
		objectiveName: "FKT_Deaths",
	},
	kills: {
		displayName: "Kills",
		objectiveDynamicPropertyId: "FKT_Kills",
		objectiveName: "FKT_Kills",
	},
};

export function initScoreboardData(sbData: ScoreboardData): ScoreboardObjective {
	const objectiveNameProperty = world.getDynamicProperty(sbData.objectiveDynamicPropertyId);

	if (typeof objectiveNameProperty !== "string") {
		world.setDynamicProperty(sbData.objectiveDynamicPropertyId, sbData.objectiveName);
	} else {
		sbData.objectiveName = objectiveNameProperty;
	}

	sbData.objective =
		world.scoreboard.getObjective(sbData.objectiveName) ??
		world.scoreboard.addObjective(sbData.objectiveName, sbData.displayName);
	sbData.displayName = sbData.objective.displayName;
	return sbData.objective;
}

export interface ResultWithMessage {
	bool: boolean;
	message: string;
}

// oldObjectiveName only needed if changing objective name
function reloadScoreboard(sbData: ScoreboardData, oldObjectiveName?: string): ResultWithMessage {
	if (!sbData.objective) {
		return {
			bool: false,
			message: `sbData.objective is undefined`,
		};
	}

	const isOnDisplay: Record<DisplaySlotId, boolean> = {
		BelowName: false,
		List: false,
		Sidebar: false
	}
	for (const displayId of Object.values(DisplaySlotId)) {
		const objectiveOnDisplay = world.scoreboard.getObjectiveAtDisplaySlot(displayId);
		if (objectiveOnDisplay && objectiveOnDisplay.objective.id === sbData.objective.id) {
			isOnDisplay[displayId] = true;
		}
	}

	const scoresBackup = sbData.objective.getScores();
	const result = world.scoreboard.removeObjective(oldObjectiveName ?? sbData.objectiveName);
	if (!result) {
		return {
			bool: false,
			message: `Failed to remove old objective`,
		};
	}

	sbData.objective = world.scoreboard.addObjective(sbData.objectiveName, sbData.displayName);
	for (const score of scoresBackup) {
		sbData.objective.setScore(score.participant, score.score);
	}

	for (const displayId of Object.values(DisplaySlotId)) {
		if (isOnDisplay[displayId]) {
			world.scoreboard.setObjectiveAtDisplaySlot(displayId, { objective: sbData.objective });
		}
	}

	return {
		bool: true,
		message: `${sbData.objectiveName} reload successful`,
	};
}

export function setScoreboardDisplayName(
	sbData: ScoreboardData,
	newDisplayName: string,
): ResultWithMessage {
	if (!sbData.objective) {
		initScoreboardData(sbData);
	}

	const oldDisplayName = sbData.displayName;
	sbData.displayName = newDisplayName;
	const result = reloadScoreboard(sbData);

	if (result.bool) {
		return {
			bool: true,
			message: `Set objective ${sbData.objectiveName} display name to ${newDisplayName}`,
		};
	} else {
		sbData.displayName = oldDisplayName;
		return {
			bool: false,
			message: `Unable to set objective ${sbData.objectiveName} display name to ${newDisplayName}. ${result.message}`,
		};
	}
}

export function setScoreboardObjectiveName(
	sbData: ScoreboardData,
	newObjectiveName: string,
): ResultWithMessage {
	if (!sbData.objective) {
		initScoreboardData(sbData);
	}

	const oldObjectiveName = sbData.objectiveName;
	sbData.objectiveName = newObjectiveName;
	const result = reloadScoreboard(sbData, oldObjectiveName);

	if (result.bool) {
		world.setDynamicProperty(sbData.objectiveDynamicPropertyId, sbData.objectiveName);
		return {
			bool: true,
			message: `Changed objective name ${oldObjectiveName} to ${newObjectiveName}`,
		};
	} else {
		sbData.objectiveName = oldObjectiveName;
		return {
			bool: false,
			message: `Unable to change objective ${sbData.objectiveName} to ${newObjectiveName}. ${result.message}`,
		};
	}
}
