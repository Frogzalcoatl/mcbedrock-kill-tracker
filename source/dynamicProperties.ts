import { world } from "@minecraft/server";
import { ENUMS } from "./enums";

export const DYNAMIC_PROPERTIES = {
	// If last hit occurred in less time, counts as kill
	hitCooldown: {
		id: "fkt:hit_tracker_cooldown_ms",
		valueMs: 7000,
	},
	mobInclusionMode: {
		id: "fkt:mob_inclusion_mode",
		value: ENUMS.mobInclusionMode.disabled,
	},
};

world.afterEvents.worldLoad.subscribe(() => {
	const combatTimeData = world.getDynamicProperty(DYNAMIC_PROPERTIES.hitCooldown.id);
	if (typeof combatTimeData !== "number") {
		world.setDynamicProperty(
			DYNAMIC_PROPERTIES.hitCooldown.id,
			DYNAMIC_PROPERTIES.hitCooldown.valueMs,
		);
	} else {
		DYNAMIC_PROPERTIES.hitCooldown.valueMs = combatTimeData;
	}

	const mobInclusionModeData = world.getDynamicProperty(DYNAMIC_PROPERTIES.mobInclusionMode.id);
	if (
		typeof mobInclusionModeData !== "string" ||
		!Object.values(ENUMS.mobInclusionMode).includes(mobInclusionModeData)
	) {
		world.setDynamicProperty(
			DYNAMIC_PROPERTIES.mobInclusionMode.id,
			DYNAMIC_PROPERTIES.mobInclusionMode.value,
		);
	} else {
		DYNAMIC_PROPERTIES.mobInclusionMode.value = mobInclusionModeData;
	}
});
