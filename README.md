# ITNPFT3-Finapp
UOS OBP 

Use nodemon to watch for changes and refresh automatically:
1. Install Nodemon (if you don't have it)
Run this in your terminal:
npm install -g nodemon
2. The "Auto-Run" Command
Run this in your project root folder:
nodemon --watch www -e html,css,js --exec "cordova run browser"
What this does:
✅ Watches your www folder.
✅ Detects changes in .html, .css, and .js files.
✅ Re-runs cordova run browser every time you hit Save.
3. Pro Tip: Create a Shortcut
Open your package.json and add this line inside the "scripts" section:
"dev": "nodemon --watch www -e html,css,js --exec \"cordova run browser\""
Now you can just type:
npm run dev