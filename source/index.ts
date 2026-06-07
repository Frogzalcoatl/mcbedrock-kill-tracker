// Frogzalcoatl's Kill Tracker (FKT)

import {
	type Entity,
	EntityComponentTypes,
	EntityDamageCause,
	type EntityTameableComponent,
	Player,
	system,
	world,
} from "@minecraft/server";
import { DYNAMIC_PROPERTIES } from "./dynamicProperties";
import { DeathsManager, KillsManager, MobManager } from "./scoreboard";
import "./commands";
import { removeNamespaceAndUnderscores } from "./bootifulTypeIds";
import { ENUMS } from "./enums";

// Last player in combat with, timestamp of last hit
interface HitData {
	entityId: string;
	timestamp: number;
}

// Key is playerid
const HIT_TRACKER = new Map<string, HitData>();

function trackHitBetween(damagingEntity: Entity, hurtEntity: Entity): void {
	HIT_TRACKER.set(hurtEntity.id, {
		entityId: damagingEntity.id,
		timestamp: Date.now(),
	});
}

// Chose entityHurt event over entityHitEntity/projectileHitEntity because it includes creeper explosions.
world.afterEvents.entityHurt.subscribe((e) => {
	if (
		e.damageSource.damagingEntity === undefined ||
		!MobManager.shouldTrackEntity(e.damageSource.damagingEntity)
	) {
		return;
	}
	if (!MobManager.shouldTrackEntity(e.hurtEntity)) {
		return;
	}
	trackHitBetween(e.damageSource.damagingEntity, e.hurtEntity);
});

world.afterEvents.entityDie.subscribe((e) => {
	// Clear dead mob's nametag from kills scoreboard if applicable
	MobManager.removeEntityFromKillsObjective(e.deadEntity);
	// selfDestruct damage cause means /kill
	if (
		!MobManager.shouldTrackEntity(e.deadEntity) ||
		e.damageSource.cause === EntityDamageCause.selfDestruct
	) {
		return;
	}
	if (e.deadEntity instanceof Player) {
		DeathsManager.incrememntScore(e.deadEntity);
	} else if (
		DYNAMIC_PROPERTIES.mobInclusionMode.value !== ENUMS.mobInclusionMode.nameTagOnly &&
		DYNAMIC_PROPERTIES.mobInclusionMode.value !== ENUMS.mobInclusionMode.disabled
	) {
		DeathsManager.incrememntScore(removeNamespaceAndUnderscores(e.deadEntity.typeId, true, true));
	}
	if (e.damageSource.damagingEntity) {
		KillsManager.incrememntScore(e.damageSource.damagingEntity);
		// getComponent throws errors if entity is not valid
		if (e.damageSource.damagingEntity.isValid) {
			// Tried to use tameable component but it doesnt seem to be working. Will leave this here anyways.
			// Adds kill for pet owner if applicable
			const tameable: EntityTameableComponent | undefined =
				e.damageSource.damagingEntity.getComponent(EntityComponentTypes.Tameable);
			if (tameable?.tamedToPlayer) {
				KillsManager.incrememntScore(tameable.tamedToPlayer);
			}
			return;
		}
	}
	// If direct killer not found, resort to hit tracker (if within cooldown)
	const trackerData: HitData | undefined = HIT_TRACKER.get(e.deadEntity.id);
	if (
		!trackerData ||
		trackerData.timestamp + DYNAMIC_PROPERTIES.hitCooldown.valueMs <= Date.now()
	) {
		return;
	}
	const killerId: string = trackerData.entityId;
	const killer: Entity | undefined = world.getEntity(killerId);
	if (!killer) {
		return;
	}
	if (MobManager.shouldTrackEntity(killer)) {
		KillsManager.incrememntScore(killer);
	}
});

world.afterEvents.playerSpawn.subscribe((e) => {
	if (!e.initialSpawn) {
		return;
	}
	KillsManager.initScore(e.player);
	DeathsManager.initScore(e.player);
});

system.runInterval(() => {
	const now = Date.now();
	const cooldownMs = DYNAMIC_PROPERTIES.hitCooldown.valueMs;
	for (const [entityId, hitData] of HIT_TRACKER.entries()) {
		if (now - hitData.timestamp > cooldownMs) {
			HIT_TRACKER.delete(entityId);
		}
	}
}, 1200); // Clean in case of despawned mobs
