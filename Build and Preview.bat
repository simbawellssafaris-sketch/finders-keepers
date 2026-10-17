@echo off
cd /d "%~dp0"
set PORT=3010
if not exist node_modules (call npm install)
rem Next.js is started through node directly because npm's launcher scripts break in folders whose name contains an ampersand.
node node_modules\next\dist\bin\next build --webpack
echo Built. Starting the real server at http://localhost:3010 - leave this window open.
node node_modules\next\dist\bin\next start
