@echo off
setlocal

echo Installing dependencies in root...
cmd /c npm i

echo.
echo Installing electron dependencies in src...

if exist "src" (
    pushd src
    cmd /c npm i
    popd
) else (
    echo src folder not found, skipping...
)

echo.
echo Starting application...
node index.js

pause