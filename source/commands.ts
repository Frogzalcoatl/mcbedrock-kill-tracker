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
import { DYNAMIC_PROPERTIES } from "./dynamicProperties";
import { ENUMS } from "./enums";
import {
	DeathsManager,
	KillsManager,
	type ResultWithMessage,
	type ScoreboardManager,
} from "./scoreboard";

function handleCommandResult(origin: CustomCommandOrigin, result: CustomCommandResult): void {
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
		player.sendMessage(
			`${result.status === CustomCommandStatus.Success ? "" : "§c"}${result.message}`,
		);
	}
}

const COMMANDS: {
	command: CustomCommand;
	// biome-ignore lint/suspicious/noExplicitAny: Used any[] to match type expected by Bedrock API
	callback: (origin: CustomCommandOrigin, ...args: any[]) => CustomCommandResult | undefined;
}[] = [];

COMMANDS.push({
	callback: (
		_origin: CustomCommandOrigin,
		cooldownSeconds?: number,
	): CustomCommandResult | undefined => {
		const hitCooldown = DYNAMIC_PROPERTIES.hitCooldown;
		if (cooldownSeconds === undefined) {
			return {
				message: `Hit tracker cooldown currently set to ${hitCooldown.valueMs / 1000} second${hitCooldown.valueMs / 1000 === 1 ? "" : "s"}`,
				status: CustomCommandStatus.Success,
			};
		}
		if (cooldownSeconds < 0) {
			return {
				message: "Hit tacker cooldown must be at least 0 seconds",
				status: CustomCommandStatus.Failure,
			};
		}
		const cooldownMs = Math.round(cooldownSeconds * 1000);
		hitCooldown.valueMs = cooldownMs;
		world.setDynamicProperty(hitCooldown.id, cooldownMs);
		cooldownSeconds = cooldownMs / 1000; // Make sure return message has 3 decimal places at most.
		return {
			message: `Set hit tracker cooldown to ${cooldownSeconds} second${cooldownSeconds === 1 ? "" : "s"}`,
			status: CustomCommandStatus.Success,
		};
	},
	command: {
		description: "Set hit tracker cooldown time (seconds).",
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

COMMANDS.push({
	callback: (
		origin: CustomCommandOrigin,
		objective: string,
		edit: string,
		newName: string,
	): CustomCommandResult | undefined => {
		let scoreboardManager: ScoreboardManager;
		if (objective === ENUMS.objective.kills) {
			scoreboardManager = KillsManager;
		} else if (objective === ENUMS.objective.deaths) {
			scoreboardManager = DeathsManager;
		} else {
			return {
				message: `Invalid objective argument "${objective}"`,
				status: CustomCommandStatus.Failure,
			};
		}
		system.run(() => {
			let result: ResultWithMessage;
			if (edit === ENUMS.edit.setDisplay) {
				result = scoreboardManager.setDisplayName(newName);
			} else if (edit === ENUMS.edit.setObjective) {
				result = scoreboardManager.setId(newName);
			} else {
				result = {
					bool: false,
					message: `Invalid edit argument "${edit}"`,
				};
			}

			// Cannot return a CustomCommandResult since above func needs to be run after a tick, not before.
			handleCommandResult(origin, {
				message: result.message,
				status: result.bool ? CustomCommandStatus.Success : CustomCommandStatus.Failure,
			});
		});
		return undefined;
	},
	command: {
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
		name: "fkt:scoreboards",
		permissionLevel: CommandPermissionLevel.GameDirectors,
	},
});

const MOB_INCLUSION_HELP_MESSAGE: string = `
===================
§7*Players are always incremented by their username

§rall_nametaggedincluded:
§7If mob has a name tag, scoreboard increments both their name tag and mob type. If mob has no namtag, only increments their mob type.

§rall_nametaggedseperated:
§7If mob has a name tag, scoreboard only increments their name tag. If mob has no nametag, increments their mob type.

§rdisabled:
§7Disables all mob kill tracking

§rhelp:
§7Displays this help message

§rnametagonly:
§7Scoreboard increments by name tag only.

§rtypeid:
§7Scoreboard increments by mob type only
§r===================
`.trim();

COMMANDS.push({
	callback: (_origin: CustomCommandOrigin, value?: string): CustomCommandResult | undefined => {
		if (value === undefined) {
			return {
				message: `Mob inclusion currently set to ${DYNAMIC_PROPERTIES.mobInclusionMode.value}`,
				status: CustomCommandStatus.Success,
			};
		}
		if (!Object.values(ENUMS.mobInclusionMode).includes(value)) {
			return {
				message: `Invalid mob inclusion mode "${value}"`,
				status: CustomCommandStatus.Failure,
			};
		}
		if (value === ENUMS.mobInclusionMode.help) {
			return {
				message: MOB_INCLUSION_HELP_MESSAGE,
				status: CustomCommandStatus.Success,
			};
		}
		DYNAMIC_PROPERTIES.mobInclusionMode.value = value;
		world.setDynamicProperty(DYNAMIC_PROPERTIES.mobInclusionMode.id, value);
		return {
			message: `Mob inclusion set to ${value}`,
			status: CustomCommandStatus.Success,
		};
	},
	command: {
		description: "Include mobs on kills and deaths scoreboards.",
		name: "fkt:mobinclusion",
		optionalParameters: [{ name: "fkt:mobInclusionMode", type: CustomCommandParamType.Enum }],
		permissionLevel: CommandPermissionLevel.GameDirectors,
	},
});

COMMANDS.push({
	callback: (origin: CustomCommandOrigin, clearMode: string): CustomCommandResult | undefined => {
		if (!Object.values(ENUMS.resetMode).includes(clearMode)) {
			return {
				message: `Invalid clear mode "${clearMode}"`,
				status: CustomCommandStatus.Failure,
			};
		}
		system.run(() => {
			KillsManager.clear(clearMode);
			DeathsManager.clear(clearMode);
			let whoWasRemoved: string;
			if (clearMode === ENUMS.resetMode.all) {
				whoWasRemoved = "everyone";
			} else if (clearMode === ENUMS.resetMode.mobs) {
				whoWasRemoved = "all mobs";
			} else if (clearMode === ENUMS.resetMode.players) {
				whoWasRemoved = "all players";
			} else {
				whoWasRemoved = "nobody?";
			}
			handleCommandResult(origin, {
				message: `Removed ${whoWasRemoved} from kills and deaths scoreboards`,
				status: CustomCommandStatus.Success,
			});
		});
		return undefined;
	},
	command: {
		description: "reset participants on kills and deaths scoreboards.",
		mandatoryParameters: [
			{
				name: "fkt:resetMode",
				type: CustomCommandParamType.Enum,
			},
		],
		name: "fkt:reset",
		permissionLevel: CommandPermissionLevel.GameDirectors,
	},
});

system.beforeEvents.startup.subscribe((e) => {
	e.customCommandRegistry.registerEnum("fkt:objective", Object.values(ENUMS.objective));
	e.customCommandRegistry.registerEnum("fkt:edit", Object.values(ENUMS.edit));
	e.customCommandRegistry.registerEnum(
		"fkt:mobInclusionMode",
		Object.values(ENUMS.mobInclusionMode),
	);
	e.customCommandRegistry.registerEnum("fkt:resetMode", Object.values(ENUMS.resetMode));
	for (const c of COMMANDS) {
		e.customCommandRegistry.registerCommand(c.command, c.callback);
	}
});
