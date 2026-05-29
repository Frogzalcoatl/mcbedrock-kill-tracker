import { CommandPermissionLevel, CustomCommand, CustomCommandOrigin, CustomCommandParamType, CustomCommandResult, CustomCommandStatus, Player, system, world } from "@minecraft/server";
import { ResultWithMessage, SCOREBOARD_DATA, ScoreboardData, setScoreboardDisplayName, setScoreboardObjectiveName } from "./scoreboard";

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

const COMMANDS = new Array<{ command: CustomCommand, callback: (origin: CustomCommandOrigin, ...args: any[]) => CustomCommandResult | undefined }>();

// If last hit occurred in less time, counts as kill
export let COMBAT_TIME_MS: number = 7000;
export const COMBAT_TIME_DYNAMIC_PROPERTY = "fkt:combat_cooldown_ms";

world.afterEvents.worldLoad.subscribe(() => {
	const dynamicProperty = world.getDynamicProperty(COMBAT_TIME_DYNAMIC_PROPERTY);
	if (typeof dynamicProperty !== "number") {
		world.setDynamicProperty(COMBAT_TIME_DYNAMIC_PROPERTY, COMBAT_TIME_MS);
	} else {
		COMBAT_TIME_MS = dynamicProperty;
	}
});



COMMANDS.push({
	command: {
		cheatsRequired: true,
		description: "Set hit cooldown time (seconds)",
		optionalParameters: [{
			name: "cooldownSeconds",
			type: CustomCommandParamType.Float
		}],
		name: "fkt:setcooldown",
		permissionLevel: CommandPermissionLevel.GameDirectors
	},
	callback: (origin: CustomCommandOrigin, cooldownSeconds?: number): CustomCommandResult | undefined => {
		if (cooldownSeconds === undefined) {
			return {
				status: CustomCommandStatus.Success,
				message: `Combat cooldown currently set to ${COMBAT_TIME_MS / 1000} seconds`
			};
		}
		if (cooldownSeconds < 0) {
			return {
				status: CustomCommandStatus.Failure,
				message: "Combat cooldown must be at least 0 seconds"
			};
		}

		const cooldownMS = Math.floor(cooldownSeconds * 1000);
		COMBAT_TIME_MS = cooldownMS;
		cooldownSeconds = cooldownMS / 1000; // for rounding in return message
		world.setDynamicProperty(COMBAT_TIME_DYNAMIC_PROPERTY, Math.floor(cooldownSeconds * 1000));

		return {
			status: CustomCommandStatus.Success,
			message: `Set combat cooldown to ${cooldownSeconds} seconds`
		};
	}
});

enum CustomCommandObjective {
	Kills = "kills",
	Deaths = "deaths"
};
enum CustomCommandEdit {
	SetObjective = "setobjective",
	SetDisplay = "setdisplay"
};

COMMANDS.push({
	command: {
		cheatsRequired: true,
		description: "Edit scoreboard properties.",
		mandatoryParameters: [{
			name: "fkt:objective",
			type: CustomCommandParamType.Enum
		}, {
			name: "fkt:edit",
			type: CustomCommandParamType.Enum
		}, {
			name: "newName",
			type: CustomCommandParamType.String
		}],
		name: "fkt:config",
		permissionLevel: CommandPermissionLevel.GameDirectors
	},
	callback: (origin: CustomCommandOrigin, objective: string, edit: string, newName: string): CustomCommandResult | undefined => {
		let result: ResultWithMessage;

		let scoreboardData: ScoreboardData;
		if (objective === CustomCommandObjective.Kills) {
			scoreboardData = SCOREBOARD_DATA.kills;
		} else if (objective === CustomCommandObjective.Deaths) {
			scoreboardData = SCOREBOARD_DATA.deaths;
		} else {
			return {
				status: CustomCommandStatus.Failure,
				message: `Invalid objective argument "${objective}"`
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
					message: `Invalid edit argument "${edit}"`
				};
			}

			// Cannot return a CustomCommandResult since above func needs to be run after a tick, not before.
			handleCommandResult(origin, result);
		});

		return undefined;
	}
});

system.beforeEvents.startup.subscribe(e => {
	e.customCommandRegistry.registerEnum("fkt:objective", Object.values(CustomCommandObjective));
	e.customCommandRegistry.registerEnum("fkt:edit", Object.values(CustomCommandEdit));
	COMMANDS.forEach(c => {
		e.customCommandRegistry.registerCommand(c.command, c.callback)
	});
})
