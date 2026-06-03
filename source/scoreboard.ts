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

function reloadScoreboard(sbData: ScoreboardData, oldObjectiveName?: string): ResultWithMessage {
	if (!sbData.objective) {
		return {
			bool: false,
			message: `sbData.objective is undefined`,
		};
	}

	let isbelowName: boolean = false;
	const belowName = world.scoreboard.getObjectiveAtDisplaySlot(DisplaySlotId.BelowName);
	if (belowName && belowName.objective.id === sbData.objective.id) {
		isbelowName = true;
	}

	let isList: boolean = false;
	const list = world.scoreboard.getObjectiveAtDisplaySlot(DisplaySlotId.List);
	if (list && list.objective.id === sbData.objective.id) {
		isList = true;
	}

	let isSidebar: boolean = false;
	const sidebar = world.scoreboard.getObjectiveAtDisplaySlot(DisplaySlotId.Sidebar);
	if (sidebar && sidebar.objective.id === sbData.objective.id) {
		isSidebar = true;
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

	if (isbelowName) {
		world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.BelowName, {
			objective: sbData.objective,
		});
	}
	if (isList) {
		world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.List, {
			objective: sbData.objective,
		});
	}
	if (isSidebar) {
		world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
			objective: sbData.objective,
		});
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
