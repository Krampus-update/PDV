@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Instalador Completo PDV (GitHub -> Windows)
color 0A

:: ==========================================================
:: INSTALADOR COMPLETO:
:: 1) Instala Git e Node.js LTS (winget)
:: 2) Clona repo do GitHub
:: 3) Instala dependencias do backend (npm install)
:: 4) Cria scripts/atalhos para iniciar e parar
:: ==========================================================

set "DESKTOP=%USERPROFILE%\Desktop"
set "DEFAULT_DIR=C:\PDV"
set "DEFAULT_REPO=https://github.com/Krampus-update/PDV"

echo.
echo =====================================================
echo   PDV - Instalador Completo (Windows + GitHub)
echo =====================================================
echo.

where winget >nul 2>&1
if errorlevel 1 (
  echo [ERRO] winget nao encontrado neste Windows.
  echo Atualize o App Installer pela Microsoft Store e tente novamente.
  echo.
  pause
  exit /b 1
)

:: ---------- Elevacao ----------
net session >nul 2>&1
if errorlevel 1 (
  echo Solicitando permissao de Administrador...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

:: ---------- Perguntas ----------
set "REPO_URL="
set /p REPO_URL=URL do repositorio GitHub do PDV ^(ENTER para %DEFAULT_REPO%^): 
if "%REPO_URL%"=="" set "REPO_URL=%DEFAULT_REPO%"

set "INSTALL_DIR="
set /p INSTALL_DIR=Diretorio de instalacao ^(ENTER para %DEFAULT_DIR%^): 
if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%DEFAULT_DIR%"

set "APP_DIR=%INSTALL_DIR%"

echo.
echo [1/7] Instalando Git...
winget install --id Git.Git --exact --silent --accept-package-agreements --accept-source-agreements >nul
if errorlevel 1 (
  echo [AVISO] Falha ao instalar Git via winget. Tentando continuar...
)

echo [2/7] Instalando Node.js LTS...
winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements >nul
if errorlevel 1 (
  echo [AVISO] Falha ao instalar Node.js via winget. Tentando continuar...
)

:: Atualiza PATH da sessao atual com locais padrao
if exist "C:\Program Files\Git\cmd\git.exe" set "PATH=C:\Program Files\Git\cmd;%PATH%"
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"

where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao esta disponivel no PATH apos instalacao.
  echo Feche e abra o terminal, ou reinicie o Windows e rode novamente.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao esta disponivel no PATH apos instalacao.
  echo Feche e abra o terminal, ou reinicie o Windows e rode novamente.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao esta disponivel no PATH apos instalacao.
  pause
  exit /b 1
)

echo.
echo [3/7] Preparando pasta de instalacao...
if not exist "%APP_DIR%" mkdir "%APP_DIR%" >nul 2>&1

echo [4/7] Baixando/atualizando codigo do GitHub...
echo Se o repositorio for privado, o Git pode solicitar login/token nesta etapa.
if exist "%APP_DIR%\.git" (
  pushd "%APP_DIR%"
  git pull
  if errorlevel 1 (
    popd
    echo [ERRO] Falha no git pull.
    pause
    exit /b 1
  )
  popd
) else (
  set "FILECOUNT=0"
  set "COUNT_FILE=%TEMP%\pdv_count_%RANDOM%.txt"
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c = (Get-ChildItem -LiteralPath '%APP_DIR%' -Force -ErrorAction SilentlyContinue | Measure-Object).Count; [Console]::Out.WriteLine($c)" > "%COUNT_FILE%"
  set /p FILECOUNT=<"%COUNT_FILE%"
  del /f /q "%COUNT_FILE%" >nul 2>&1
  for /f "delims=0123456789" %%X in ("!FILECOUNT!") do set "FILECOUNT=0"
  if "!FILECOUNT!"=="" set "FILECOUNT=0"
  if not "!FILECOUNT!"=="0" (
    echo [ERRO] A pasta "%APP_DIR%" nao esta vazia e nao e um repositorio git.
    echo Use outra pasta ou limpe esta pasta.
    echo Itens encontrados: !FILECOUNT!
    pause
    exit /b 1
  )
  git clone "%REPO_URL%" "%APP_DIR%"
  if errorlevel 1 (
    echo [ERRO] Falha no git clone.
    pause
    exit /b 1
  )
)

if not exist "%APP_DIR%\backend\package.json" (
  echo [ERRO] Estrutura esperada nao encontrada: backend\package.json
  echo Verifique se a URL informada e do repositorio correto do PDV.
  pause
  exit /b 1
)

echo.
echo [5/7] Instalando dependencias do backend...
pushd "%APP_DIR%\backend"
set "NPM_LOG=%APP_DIR%\install_backend.log"
if exist "%NPM_LOG%" del /f /q "%NPM_LOG%" >nul 2>&1

echo Executando npm install...
call npm cache verify >> "%NPM_LOG%" 2>&1
call npm install --no-audit --no-fund >> "%NPM_LOG%" 2>&1
if errorlevel 1 (
  echo [AVISO] npm install falhou. Tentando modo alternativo...
  call npm install --build-from-source --no-audit --no-fund >> "%NPM_LOG%" 2>&1
)
if errorlevel 1 (
  popd
  echo [ERRO] Falha no npm install.
  echo Log completo: %NPM_LOG%
  echo.
  echo Ultimas linhas do erro:
  powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path '%NPM_LOG%') { Get-Content -Path '%NPM_LOG%' -Tail 40 }"
  pause
  exit /b 1
)

echo [6/7] Criando .env padrao (se necessario)...
if not exist ".env" (
  > ".env" echo PORT=3000
  >> ".env" echo NODE_ENV=production
)
popd

echo [7/7] Criando scripts e atalhos...
set "START_SCRIPT=%APP_DIR%\INICIAR_PDV.bat"
set "STOP_SCRIPT=%APP_DIR%\PARAR_PDV.bat"

> "%START_SCRIPT%" (
  echo @echo off
  echo setlocal EnableExtensions
  echo title PDV - Servidor
  echo cd /d "%%~dp0backend"
  echo if not exist logs mkdir logs ^>nul 2^>^&1
  echo echo Iniciando servidor PDV...
  echo echo Logs em: backend\logs\server.log
  echo npm start 1^>^> logs\server.log 2^>^&1
  echo echo.
  echo echo Servidor encerrado.
  echo pause
)

> "%STOP_SCRIPT%" (
  echo @echo off
  echo setlocal EnableExtensions
  echo title PDV - Parar Servidor
  echo echo Encerrando janela do servidor PDV...
  echo taskkill /FI "WINDOWTITLE eq PDV - Servidor*" /T /F ^>nul 2^>^&1
  echo if errorlevel 1 ^(
  echo   echo Nenhum servidor PDV ativo encontrado.
  echo ^) else ^(
  echo   echo Servidor PDV encerrado.
  echo ^)
  echo pause
)
set "SHORTCUT_LOG=%APP_DIR%\install_shortcuts.log"
if exist "%SHORTCUT_LOG%" del /f /q "%SHORTCUT_LOG%" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference='Stop'; ^
 $desktop = [Environment]::GetFolderPath('Desktop'); ^
 if ([string]::IsNullOrWhiteSpace($desktop)) { $desktop = Join-Path $env:USERPROFILE 'Desktop' }; ^
 if (-not (Test-Path -LiteralPath $desktop)) { New-Item -ItemType Directory -Path $desktop -Force | Out-Null }; ^
 $ws = New-Object -ComObject WScript.Shell; ^
 $lnk1Path = Join-Path $desktop 'PDV - Iniciar.lnk'; ^
 $lnk1 = $ws.CreateShortcut($lnk1Path); ^
 $lnk1.TargetPath = '%START_SCRIPT%'; ^
 $lnk1.WorkingDirectory = '%APP_DIR%'; ^
 $lnk1.IconLocation = Join-Path $env:SystemRoot 'System32\shell32.dll,25'; ^
 $lnk1.Save(); ^
 $lnk2Path = Join-Path $desktop 'PDV - Parar.lnk'; ^
 $lnk2 = $ws.CreateShortcut($lnk2Path); ^
 $lnk2.TargetPath = '%STOP_SCRIPT%'; ^
 $lnk2.WorkingDirectory = '%APP_DIR%'; ^
 $lnk2.IconLocation = Join-Path $env:SystemRoot 'System32\shell32.dll,28'; ^
 $lnk2.Save(); ^
 Write-Output ('DesktopAtalhos=' + $desktop)" > "%SHORTCUT_LOG%" 2>&1

if errorlevel 1 (
  echo [AVISO] Nao foi possivel criar atalhos automaticamente.
  echo         Veja: %SHORTCUT_LOG%
  echo         A instalacao do PDV continuou normalmente.
)

echo.
echo =====================================================
echo   Instalacao concluida com sucesso.
echo =====================================================
echo.
echo Pasta: %APP_DIR%
echo Inicio: %START_SCRIPT%
echo Parar : %STOP_SCRIPT%
if exist "%SHORTCUT_LOG%" type "%SHORTCUT_LOG%"
echo.
echo Acesso local apos iniciar:
echo http://localhost:3000
echo.

set /p RUNNOW="Deseja iniciar o servidor agora? (S/N): "
if /I "%RUNNOW%"=="S" (
  start "" "%START_SCRIPT%"
)

echo.
pause
exit /b 0
