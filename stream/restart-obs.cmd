@echo off
title Out Of Pocket -- restart OBS safely
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restart-obs.ps1"
