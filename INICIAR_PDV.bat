@echo off
setlocal EnableExtensions
title PDV - Servidor
cd /d "%~dp0"
if exist ".git" (
  where git >nul 2>&1
  if errorlevel 1 (
    echo [AVISO] Git nao encontrado. Pulando atualizacao.
  ) else (
    echo Atualizando codigo do PDV...
    git pull --rebase --autostash
    if errorlevel 1 echo [AVISO] Falha ao atualizar via git.
  )
)
cd /d "%~dp0backend"
if not exist logs mkdir logs >nul 2>&1
echo Iniciando servidor PDV...
echo Logs em: backend\logs\server.log
start "" "http://localhost:3000"
npm start 1>> logs\server.log 2>&1
echo.
echo Servidor encerrado.
pause
