@echo off
cd /d "%~dp0"
set PORT=3010
if not exist node_modules (call npm install)
echo Starting the site at http://localhost:3010 - leave this window open.
rem Next.js is started through node directly because npm's launcher scripts break in folders whose name contains an ampersand.
node node_modules\next\dist\bin\next dev
