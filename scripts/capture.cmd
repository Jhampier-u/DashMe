@echo off
REM Dispara una ejecucion de captura contra el endpoint del cron.
REM
REM Existe como script en vez de meter el curl directamente en schtasks /TR
REM porque el parser de schtasks rompe con comillas anidadas: el secreto
REM acababa interpretandose como un argumento suelto.
REM
REM Lee CRON_SECRET de .env.local, asi que el secreto no aparece ni en la
REM definicion de la tarea programada ni en ningun log.

setlocal

for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b "CRON_SECRET=" "%~dp0..\.env.local"`) do set "SECRET=%%b"

if "%SECRET%"=="" (
  echo ERROR: no se encontro CRON_SECRET en .env.local
  exit /b 1
)

curl.exe -s -S -X POST -H "x-cron-secret: %SECRET%" http://127.0.0.1:3000/api/cron/capture

endlocal
