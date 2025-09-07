@echo off
echo Starting ChatLLM Application...
echo.

echo Installing dependencies...
call npm install

echo.
echo Starting backend server...
start "Backend Server" cmd /k "node server.js"

echo.
echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo.
echo Starting frontend...
echo Open your browser to: http://localhost:3001
echo.
echo Press any key to stop both servers...
pause > nul

echo.
echo Stopping servers...
taskkill /f /im node.exe > nul 2>&1
echo Done!