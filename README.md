# mcbedrock-gametest-starter
A template repository for getting started with scripting in gametest modules for minecraft bedrock edition.

## Features
* Simple build scripts for scripts and the mcpack itself.
* Fully configured ES2023 typescript.
* Actual bundler setup with vanilla-data included. (via Esbuild)
* Proper git configuration for collaboration
* Common modules such as @minecraft/server and @minecraft/server-ui already included.
* Strict typescript configuration.
* Strict vscode configuration with extension recommendations.
* proper js.map and minification (optional)

## Requirements
You need the following utilities installed and added to your PATH:
* [pnpm](https://pnpm.io/)
* [node LTS](https://nodejs.org/en/download)
* (optional) [vscode](https://code.visualstudio.com/)

## Setup
1. [Use this repository as a template.](https://github.com/new?template_name=mcbedrock-gametest-starter&template_owner=xskutsu)
2. Navigate to your ``development_behavior_packs`` folder
	- This can be done easily by pressing ``windows + R`` and pasting ``%localappdata%/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang/development_behavior_packs/``
3. In the folder run the git command ``git clone https://github.com/YOUR_USERNAME/YOUR_PROJECT_NAME.git``
	- Replace ``YOUR_USERNAME`` with your github username.
	- Replace ``YOUR_PROJECT_NAME`` with the same project name you used for the template.
4. Within the folder, run the command ``pnpm i`` to install required modules.
5. Done! You are ready. Open the folder containing .git in vscode or your IDE of choice.

## Commands
- ⭐ ``pnpm run build-mcpack`` Automatically saves only neccessary files into a temporary directory and then zips it as a mcpack with the highest compression level, ready for share. Saves as ``addon.mcpack``
- ⭐ ``pnpm run watch`` Automatically rebuilds javascript files whenever changes are detected in typescript files for quick development.
- ``pnpm run build`` Builds the javascript files from the typescript files found in the ``source`` directory.
- ``pnpm run clean`` Removes temporary files.

# Post-setup Recommendations.
Now that you have set everything up, you should configure the project to make it truly yours.
1. Depending on who or what you are, you may want to change the license. I have the template itself as MIT. Feel free to change it to whatever if your business needs something specific or if you want your project to be AGPL or something.
2. Edit ``pack_icon.png`` to be something else. It can be any resolution, as long as it is a square. I recommend 256x256 personally.
3. In ``manifest.json`` change the header's description and name to something appropriate for your project. I wouldn't mind being credited there but know you aren't required to do so.
4. Also in ``manifest.json`` change all 3 of the the UUIDs with new unique ones. You can generate them quickly [here](https://www.uuidgenerator.net/).
5. If your project is likely bug-free, consider enabling ``minify`` in ``esbuild.cjs`` to enable minification. This will sacrafice readability (and debugability) to save A LOT of storage space and possibly make your code more runtime performant.
6. That's it I think I have bad memory.

## Notes
- This project is already set up to use the stable version of gametest scripting modules. If you want to switch to beta, there is nothing stopping you. Just make sure to update both the version in package.json and manifest.json
- Vanilla data is already integrated and ready for you to import and use.
