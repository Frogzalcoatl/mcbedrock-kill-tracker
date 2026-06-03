import {
	EntityComponentTypes,
	type EntityHitInformation,
	type Player,
	world
} from "@minecraft/server";
import { CombatTimeMs } from "./commands";
import { initScoreboardData, SCOREBOARD_DATA } from "./scoreboard";

function killTrackerPlayerInit(player: Player) {
	if (SCOREBOARD_DATA.kills.objective) {
		SCOREBOARD_DATA.kills.objective.addScore(player, 0);
	}
	if (SCOREBOARD_DATA.deaths.objective) {
		SCOREBOARD_DATA.deaths.objective.addScore(player, 0);
	}
}

world.afterEvents.playerSpawn.subscribe((e) => {
	if (!e.initialSpawn) {
		return;
	}
	killTrackerPlayerInit(e.player);
});

world.afterEvents.worldLoad.subscribe(() => {
	initScoreboardData(SCOREBOARD_DATA.kills);
	initScoreboardData(SCOREBOARD_DATA.deaths);
	for (const p of world.getAllPlayers()) {
		killTrackerPlayerInit(p);
	}
});

// Last player in combat with, timestamp of last hit
interface CombatData {
	playerId: string;
	timestamp: number;
}

// Key is playerid
const COMBAT_TRACKER = new Map<string, CombatData>();

function trackHitBetween(hitter: Player, victim: Player): void {
	COMBAT_TRACKER.set(hitter.id, {
		playerId: victim.id,
		timestamp: Date.now(),
	});

	COMBAT_TRACKER.set(victim.id, {
		playerId: hitter.id,
		timestamp: Date.now(),
	});
}

world.afterEvents.entityHitEntity.subscribe(event => {
	if (
		event.damagingEntity.typeId !== "minecraft:player" ||
		event.hitEntity.typeId !== "minecraft:player"
	) {
		return;
	}

	const damagingPlayer: Player = event.damagingEntity as Player;
	const hitPlayer: Player = event.hitEntity as Player;

	trackHitBetween(damagingPlayer, hitPlayer);
});

world.afterEvents.projectileHitEntity.subscribe(event => {
	if (event.source?.typeId !== "minecraft:player") {
		return;
	}
	const sourcePlayer: Player = event.source as Player;

	const entityHit: EntityHitInformation = event.getEntityHit();
	if (entityHit.entity?.typeId !== "minecraft:player") {
		return;
	}
	const playerHit: Player = entityHit.entity as Player;

	trackHitBetween(sourcePlayer, playerHit);
});

world.afterEvents.entityDie.subscribe(event => {
	if (event.deadEntity.typeId !== "minecraft:player") {
		return;
	}
	const deadPlayer: Player = event.deadEntity as Player;

	if (!SCOREBOARD_DATA.deaths.objective) {
		return;
	}
	const DeathsScoreboard = SCOREBOARD_DATA.deaths.objective;

	DeathsScoreboard.addScore(deadPlayer, 1);

	if (!SCOREBOARD_DATA.kills.objective) {
		return;
	}
	const KillsScoreboard = SCOREBOARD_DATA.kills.objective;

	if (event.damageSource.damagingEntity) {
		if (event.damageSource.damagingEntity.typeId === "minecraft:player") {
			const killer: Player = event.damageSource.damagingEntity as Player;
			KillsScoreboard.addScore(killer, 1);
			return;
		} else {
			// Tried to use tameable component but it doesnt seem to be working. Will leave this here anyways.
			const tameable = event.damageSource.damagingEntity.getComponent(
				EntityComponentTypes.Tameable,
			);
			if (tameable?.tamedToPlayer) {
				const killer: Player = tameable.tamedToPlayer;
				KillsScoreboard.addScore(killer, 1);
				return;
			}
		}
	}

	// If direct killer not found, resort to player who hit deadPlayer last (if within cooldown)
	const trackerData = COMBAT_TRACKER.get(deadPlayer.id);
	if (!trackerData || trackerData.timestamp + CombatTimeMs <= Date.now()) {
		return;
	}

	const killerId: string = trackerData.playerId;
	const killer: Player | undefined = world.getAllPlayers().find((p) => p.id === killerId);
	if (!killer) {
		return;
	}
	KillsScoreboard.addScore(killer, 1);
});
