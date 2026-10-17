@echo off
cd /d "%~dp0"
if not exist node_modules (call npm install)
call npm run build
echo Built. Starting the real server at http://localhost:3010 - leave this window open.
call npm start
