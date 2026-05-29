// Frogzalcoatl's Kill Tracker (FKT)

import { EntityComponentTypes, EntityDieAfterEvent, EntityHitEntityAfterEvent, EntityHitInformation, Player, ProjectileHitEntityAfterEvent, world } from "@minecraft/server";
import { COMBAT_TIME_MS } from "./commands";
import { initScoreboardData, SCOREBOARD_DATA } from "./scoreboard";

// Last player in combat with, timestamp of last hit
interface CombatData {
	playerId: string;
	timestamp: number;
}

// Key is playerid
const COMBAT_TRACKER = new Map<string, CombatData>();

function trackHitBetween(hitter: Player, victim: Player): void {
	COMBAT_TRACKER.set(
		hitter.id, {
		playerId: victim.id,
		timestamp: Date.now()
	});

	COMBAT_TRACKER.set(
		victim.id, {
		playerId: hitter.id,
		timestamp: Date.now()
	});
}

export function playerHitPlayer(event: EntityHitEntityAfterEvent): void {
	if (event.damagingEntity.typeId !== "minecraft:player" || event.hitEntity.typeId !== "minecraft:player") {
		return;
	}

	const damagingPlayer: Player = event.damagingEntity as Player;
	const hitPlayer: Player = event.hitEntity as Player;

	trackHitBetween(damagingPlayer, hitPlayer);
}

export function projectileHitPlayer(event: ProjectileHitEntityAfterEvent): void {
	if (!event.source || event.source.typeId !== "minecraft:player") {
		return;
	}
	const sourcePlayer: Player = event.source as Player;

	const entityHit: EntityHitInformation = event.getEntityHit();
	if (!entityHit.entity || entityHit.entity.typeId !== "minecraft:player") {
		return;
	}
	const playerHit: Player = entityHit.entity as Player;

	trackHitBetween(sourcePlayer, playerHit);
}

export function playerDie(event: EntityDieAfterEvent): void {
	if (event.deadEntity.typeId !== "minecraft:player") {
		return;
	}

	const deadPlayer: Player = event.deadEntity as Player;
	if (!SCOREBOARD_DATA.kills.objective) {
		return;
	}
	const KILLS_SCOREBOARD = SCOREBOARD_DATA.kills.objective;

	if (!SCOREBOARD_DATA.deaths.objective) {
		return;
	}
	const DEATHS_SCOREBOARD = SCOREBOARD_DATA.deaths.objective;

	DEATHS_SCOREBOARD.addScore(deadPlayer, 1);

	if (event.damageSource.damagingEntity) {
		if (event.damageSource.damagingEntity.typeId === "minecraft:player") {
			const killer: Player = event.damageSource.damagingEntity as Player;
			KILLS_SCOREBOARD.addScore(killer, 1);
			return;
		} else {
			const tameable = event.damageSource.damagingEntity.getComponent(EntityComponentTypes.Tameable);
			if (tameable && tameable.tamedToPlayer) {
				const killer: Player = tameable.tamedToPlayer;
				KILLS_SCOREBOARD.addScore(killer, 1);
				return;
			}
		}
	}

	const trackerData = COMBAT_TRACKER.get(deadPlayer.id);
	if (!trackerData || trackerData.timestamp + COMBAT_TIME_MS <= Date.now()) {
		return;
	}

	const killerId: string = trackerData.playerId;
	const killer: Player | undefined = world.getAllPlayers().find(p => p.id === killerId);
	if (!killer) {
		return;
	}
	KILLS_SCOREBOARD.addScore(killer, 1);
}

function killTrackerPlayerInit(player: Player) {
	if (SCOREBOARD_DATA.kills.objective) {
		SCOREBOARD_DATA.kills.objective.addScore(player, 0);
	}
	if (SCOREBOARD_DATA.deaths.objective) {
		SCOREBOARD_DATA.deaths.objective.addScore(player, 0);
	}
}

world.afterEvents.entityHitEntity.subscribe(playerHitPlayer);
world.afterEvents.projectileHitEntity.subscribe(projectileHitPlayer);
world.afterEvents.entityDie.subscribe(playerDie);
world.afterEvents.playerSpawn.subscribe(e => {
	if (!e.initialSpawn) {
		return;
	}
	killTrackerPlayerInit(e.player);
});
world.afterEvents.worldLoad.subscribe(() => {
	initScoreboardData(SCOREBOARD_DATA.kills);
	initScoreboardData(SCOREBOARD_DATA.deaths);
	world.getAllPlayers().forEach(p => {
		killTrackerPlayerInit(p);
	});
});
