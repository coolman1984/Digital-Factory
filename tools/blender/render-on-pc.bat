@echo off
rem Renders Mounter B in the owner's own Blender, on the graphics card, into out\blender\ next to this repository.
rem Double-click it. It finds Blender in the usual install folders; set BLENDER=C:\path\to\blender.exe to point at another.
rem Same script as the cloud session (tools\blender\mounter.py), so the pictures match; only the speed differs.
setlocal enabledelayedexpansion
cd /d "%~dp0..\.."
if not defined BLENDER (
  for /d %%D in ("%ProgramFiles%\Blender Foundation\Blender*") do if exist "%%D\blender.exe" set "BLENDER=%%D\blender.exe"
)
if not defined BLENDER (
  for /f "delims=" %%B in ('where blender 2^>nul') do if not defined BLENDER set "BLENDER=%%B"
)
if not defined BLENDER (
  echo Blender was not found. Install it from blender.org, or set BLENDER to the full path of blender.exe.
  pause & exit /b 1
)
echo Using "%BLENDER%"
if not exist out\blender mkdir out\blender
for %%S in (assembled exploded ghost cut) do (
  echo Rendering %%S ...
  "%BLENDER%" -b --factory-startup -P tools\blender\mounter.py -- --gpu --state %%S --samples 256 --res 2560x1600 --out "%CD%\out\blender\%%S.png" --anchors "%CD%\out\blender\%%S.json"
)
"%BLENDER%" -b --factory-startup -P tools\blender\mounter.py -- --gpu --shot head --samples 256 --res 2560x1600 --out "%CD%\out\blender\head.png" --anchors "%CD%\out\blender\head.json" --blend "%CD%\out\blender\mounter.blend"
echo.
echo Done. The pictures are in out\blender\ and the Blender file is out\blender\mounter.blend (open it to look around).
explorer out\blender
pause
