# Kill Tracker for Minecraft Bedrock
Stores kills and deaths in scoreboard objectives. Tracks this using the following scripting events:
- world.afterEvents.entityHurt
- world.afterEvents.entityDie

Includes an optional hit cooldown. If a player(1) dies within a set amount of time after being hit by another player(2), player(2) will be awarded the kill, even if they did not kill them directly. This can be useful for void kills, for example.

## Commands

- **/fkt:mobinclusion \<mobInclusionMode\>**

	Include mobs on kills and deaths scoreboards. Players are always incremented by their username.

	| Inclusion Mode     | Description      |
	| ------------- | ------------- |
	| all_nametaggedincluded | If mob has a name tag, scoreboard increments both their name tag and mob type. If mob has no namtag, only increments their mob type. |
	| all_nametaggedseperated | If mob has a name tag, scoreboard only increments their name tag. If mob has no nametag, increments their mob type. |
	| disabled | Disables all mob kill tracking. |
	| help | Displays the text in this table in game. |
	| nametagonly | Scoreboard increments by name tag only. |
	| typeid | Scoreboard increments by mob type only. |

- **/fkt:reset \<resetMode\>**

	Reset participants on kills and deaths scoreboards.

- **/fkt:scoreboards \<objective\> \<edit\> \<newName\>**

	Change the scoreboard objective or display name.

- **/fkt:setcooldown \<cooldownSeconds\>**

	Set the max amount of time a kill will be counted after last hit. cooldownSeconds of 0 will disable hit tracking.

## How to Access Scoreboard Objectives
Scoreboards are a feature built into Minecraft and can be accessed using the /scoreboard command. For example, to show the kills objective as a sidebar:
```
/scoreboard objectives setdisplay sidebar FKT_Kills
```
(Given you havent changed the kills objective name from the default FKT_Kills)

For more information on scoreboards, see [Microsoft's Official Documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/scoreboardintroduction?view=minecraft-bedrock-stable).

## Known issues
Kills caused by pets are not counted. This is bc mojang is ah and their tameable property doesn't work as of May 2026. If this is fixed, or I realize I simply implemented it wrong, I will fix.
