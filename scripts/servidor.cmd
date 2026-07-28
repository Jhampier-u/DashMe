@echo off
REM Levanta el servidor del dashboard si no hay ya uno escuchando.
REM
REM Lo lanza la tarea programada "Juampi servidor" al iniciar sesion. Sin esto,
REM tras cada reinicio la tarea de captura seguia disparandose puntual cada 20
REM minutos contra un puerto muerto: la ventana parpadeaba igual y no se
REM guardaba nada, asi que la captura moria en silencio hasta acordarse de
REM arrancar el servidor a mano.
REM
REM Comprueba el puerto antes de arrancar porque el disparador de inicio de
REM sesion se repite: bloquear y desbloquear la sesion lo vuelve a lanzar, y
REM sin la comprobacion acabariamos con dos servidores sobre la misma base.

setlocal

set "PUERTO=3000"

REM curl sale con 0 si algo responde, con 7 si el puerto esta muerto. Da igual
REM que la respuesta sea una redireccion: lo que importa es que hay alguien al
REM otro lado.
curl.exe -s -o nul --max-time 5 http://127.0.0.1:%PUERTO%/
if not errorlevel 1 (
  echo Ya habia un servidor escuchando en el %PUERTO%. No hago nada.
  exit /b 0
)

cd /d "%~dp0.."

REM El log vive en data\ porque esa carpeta ya esta en .gitignore. Sin el, un
REM fallo de arranque seria invisible: la tarea corre sin ventana.
echo [%date% %time%] Arrancando el servidor en el %PUERTO%... >> "data\servidor.log"
call npm run dev >> "data\servidor.log" 2>&1

echo [%date% %time%] El servidor termino con codigo %errorlevel%. >> "data\servidor.log"

endlocal
