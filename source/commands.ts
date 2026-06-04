import {
	CommandPermissionLevel,
	type CustomCommand,
	type CustomCommandOrigin,
	CustomCommandParamType,
	type CustomCommandResult,
	CustomCommandStatus,
	type Player,
	system,
	world,
} from "@minecraft/server";
import {
	type ResultWithMessage,
	SCOREBOARD_DATA,
	type ScoreboardData,
	setScoreboardDisplayName,
	setScoreboardObjectiveName,
} from "./scoreboard";

function handleCommandResult(origin: CustomCommandOrigin, result: ResultWithMessage): void {
	if (!world.gameRules.sendCommandFeedback) {
		return;
	}

	let player: Player | undefined;
	if (origin.sourceEntity && origin.sourceEntity.typeId === "minecraft:player") {
		player = origin.sourceEntity as Player;
	} else if (origin.initiator && origin.initiator.typeId === "minecraft:player") {
		player = origin.initiator as Player;
	}
	if (player) {
		player.sendMessage(`${result.bool ? "" : "§c"}${result.message}`);
	}
}

const COMMANDS: {
	command: CustomCommand;
	// biome-ignore lint/suspicious/noExplicitAny: Is easier fr. Also is what mojang uses
	callback: (origin: CustomCommandOrigin, ...args: any[]) => CustomCommandResult | undefined;
}[] = [];

// If last hit occurred in less time, counts as kill
export let CombatTimeMs: number = 7000;
export const COMBAT_TIME_DYNAMIC_PROPERTY = "fkt:combat_cooldown_ms";

world.afterEvents.worldLoad.subscribe(() => {
	const dynamicProperty = world.getDynamicProperty(COMBAT_TIME_DYNAMIC_PROPERTY);
	if (typeof dynamicProperty !== "number") {
		world.setDynamicProperty(COMBAT_TIME_DYNAMIC_PROPERTY, CombatTimeMs);
	} else {
		CombatTimeMs = dynamicProperty;
	}
});

COMMANDS.push({
	callback: (
		origin: CustomCommandOrigin,
		cooldownSeconds?: number,
	): CustomCommandResult | undefined => {
		if (cooldownSeconds === undefined) {
			return {
				message: `Combat cooldown currently set to ${CombatTimeMs / 1000} second${CombatTimeMs / 1000 === 1 ? "" : "s"}`,
				status: CustomCommandStatus.Success,
			};
		}
		if (cooldownSeconds < 0) {
			return {
				message: "Combat cooldown must be at least 0 seconds",
				status: CustomCommandStatus.Failure,
			};
		}

		const cooldownMs = Math.floor(cooldownSeconds * 1000);
		CombatTimeMs = cooldownMs;
		cooldownSeconds = cooldownMs / 1000; // for rounding in return message
		world.setDynamicProperty(COMBAT_TIME_DYNAMIC_PROPERTY, Math.floor(cooldownSeconds * 1000));

		return {
			message: `Set combat cooldown to ${cooldownSeconds} second${cooldownSeconds === 1 ? "" : "s"}`,
			status: CustomCommandStatus.Success,
		};
	},
	command: {
		cheatsRequired: true,
		description: "Set hit cooldown time (seconds).",
		name: "fkt:setcooldown",
		optionalParameters: [
			{
				name: "cooldownSeconds",
				type: CustomCommandParamType.Float,
			},
		],
		permissionLevel: CommandPermissionLevel.GameDirectors,
	},
});

enum CustomCommandObjective {
	Kills = "kills",
	Deaths = "deaths",
}
enum CustomCommandEdit {
	SetObjective = "setobjective",
	SetDisplay = "setdisplay",
}

COMMANDS.push({
	callback: (
		origin: CustomCommandOrigin,
		objective: string,
		edit: string,
		newName: string,
	): CustomCommandResult | undefined => {
		let result: ResultWithMessage;

		let scoreboardData: ScoreboardData;
		if (objective === CustomCommandObjective.Kills) {
			scoreboardData = SCOREBOARD_DATA.kills;
		} else if (objective === CustomCommandObjective.Deaths) {
			scoreboardData = SCOREBOARD_DATA.deaths;
		} else {
			return {
				message: `Invalid objective argument "${objective}"`,
				status: CustomCommandStatus.Failure,
			};
		}

		system.run(() => {
			if (edit === CustomCommandEdit.SetDisplay) {
				result = setScoreboardDisplayName(scoreboardData, newName);
			} else if (edit === CustomCommandEdit.SetObjective) {
				result = setScoreboardObjectiveName(scoreboardData, newName);
			} else {
				result = {
					bool: false,
					message: `Invalid edit argument "${edit}"`,
				};
			}

			// Cannot return a CustomCommandResult since above func needs to be run after a tick, not before.
			handleCommandResult(origin, result);
		});

		return undefined;
	},
	command: {
		cheatsRequired: true,
		description: "Edit scoreboard properties.",
		mandatoryParameters: [
			{
				name: "fkt:objective",
				type: CustomCommandParamType.Enum,
			},
			{
				name: "fkt:edit",
				type: CustomCommandParamType.Enum,
			},
			{
				name: "newName",
				type: CustomCommandParamType.String,
			},
		],
		name: "fkt:config",
		permissionLevel: CommandPermissionLevel.GameDirectors,
	},
});

system.beforeEvents.startup.subscribe((e) => {
	e.customCommandRegistry.registerEnum("fkt:objective", Object.values(CustomCommandObjective));
	e.customCommandRegistry.registerEnum("fkt:edit", Object.values(CustomCommandEdit));
	for (const c of COMMANDS) {
		e.customCommandRegistry.registerCommand(c.command, c.callback);
	}
});
