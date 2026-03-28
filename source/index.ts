import { world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(function (): void {
	world.sendMessage("Hello World.");
});
