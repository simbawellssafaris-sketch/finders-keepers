@echo off
cd /d "%~dp0"
set PORT=3010
if not exist node_modules (call npm install)
echo Starting the site at http://localhost:3010 - leave this window open.
call npm run dev
