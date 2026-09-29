@echo off
title Visibill Architecture Dashboard
cd /d "%~dp0"
echo Starting Graphify Live Dashboard...
python scripts\run_graphify_dashboard.py
pause
