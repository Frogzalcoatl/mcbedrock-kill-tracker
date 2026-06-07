// Frogzalcoatl's Kill Tracker (FKT)

import {
	type Entity,
	EntityComponentTypes,
	EntityDamageCause,
	type EntityTameableComponent,
	world,
} from "@minecraft/server";
import { DYNAMIC_PROPERTIES } from "./dynamicProperties";
import { DeathsManager, KillsManager, MobManager } from "./scoreboard";
import "./commands";

// Last player in combat with, timestamp of last hit
interface CombatData {
	entityId: string;
	timestamp: number;
}

// Key is playerid
const COMBAT_TRACKER = new Map<string, CombatData>();

function trackHitBetween(damagingEntity: Entity, hitEntity: Entity): void {
	COMBAT_TRACKER.set(damagingEntity.id, {
		entityId: hitEntity.id,
		timestamp: Date.now(),
	});

	COMBAT_TRACKER.set(hitEntity.id, {
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
	// Clear mob nametag from scoreboard if applicable
	MobManager.removeEntityName(e.deadEntity);

	// selfDestruct means /kill
	if (
		!MobManager.shouldTrackEntity(e.deadEntity) ||
		e.damageSource.cause === EntityDamageCause.selfDestruct
	) {
		return;
	}

	// Deaths only count for players since theyre the only entities that respawn
	if (e.deadEntity.typeId === "minecraft:player") {
		DeathsManager.incrememntScore(e.deadEntity);
	}

	if (e.damageSource.damagingEntity) {
		KillsManager.incrememntScore(e.damageSource.damagingEntity);
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

	// If direct killer not found, resort to entity who hit dead entity last (if within cooldown)
	const trackerData: CombatData | undefined = COMBAT_TRACKER.get(e.deadEntity.id);
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
