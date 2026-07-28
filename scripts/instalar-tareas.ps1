# Instala las dos tareas programadas del dashboard.
#
#   Juampi servidor  -> levanta el servidor al iniciar sesion
#   Juampi captura   -> dispara una captura de escuchas cada 20 minutos
#
# Y retira las tareas del proyecto Voidtify, que quedo superado cuando su
# codigo se migro a src/modules/musica: seguian capturando hacia su propia base
# de datos, que ya no lleva a ninguna parte.
#
# Se puede ejecutar sin administrador: instala lo que puede y avisa de lo que
# no. Solo hace falta elevar para retirar "Voidtify captura", que se creo en su
# dia con permisos elevados y quedo siendo propiedad del grupo Administradores.
#
#   powershell -ExecutionPolicy Bypass -File "C:\PROYECTO JUAMPI\scripts\instalar-tareas.ps1"
#
# Es idempotente: se puede ejecutar las veces que haga falta.

$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$usuario = "$env:USERDOMAIN\$env:USERNAME"

# Los ajustes de abajo arreglan tres fallos que traia la version original:
#
#   DisallowStartIfOnBatteries=false  corria solo con el portatil enchufado, y
#                                     en bateria dejaba de capturar en silencio
#   StopIfGoingOnBatteries=false      la mataba a mitad si se desenchufaba
#   StartWhenAvailable=true           si el equipo estaba apagado a la hora
#                                     exacta, esperaba al siguiente multiplo de
#                                     20 minutos en vez de recuperarla
#
# La accion pasa por oculto.vbs: es lo que evita la ventana de consola.
$plantilla = @'
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>__DESC__</Description></RegistrationInfo>
  <Triggers>__TRIGGER__</Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>__USUARIO__</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>__LIMITE__</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>C:\Windows\System32\wscript.exe</Command>
      <Arguments>"__RAIZ__\scripts\oculto.vbs" "__RAIZ__\scripts\__SCRIPT__"</Arguments>
    </Exec>
  </Actions>
</Task>
'@

function Nueva-Tarea {
    param($Nombre, $Descripcion, $Disparador, $Limite, $Script)

    $xml = $plantilla.
        Replace('__DESC__',    $Descripcion).
        Replace('__TRIGGER__', $Disparador).
        Replace('__USUARIO__', $usuario).
        Replace('__LIMITE__',  $Limite).
        Replace('__RAIZ__',    $raiz).
        Replace('__SCRIPT__',  $Script)

    $tmp = Join-Path $env:TEMP "juampi-$Script.xml"
    # UTF-16 con BOM: es lo que espera el Programador de tareas.
    $xml | Out-File -FilePath $tmp -Encoding Unicode

    schtasks /Delete /TN $Nombre /F 2>$null | Out-Null
    schtasks /Create /TN $Nombre /XML $tmp /F
    Remove-Item $tmp -Force
}

# El servidor no lleva limite de ejecucion (PT0S): esta pensado para no parar
# nunca. Con MultipleInstancesPolicy=IgnoreNew, volver a iniciar sesion no
# arranca un segundo servidor sobre la misma base de datos.
Nueva-Tarea `
    -Nombre      'Juampi servidor' `
    -Descripcion 'Dashboard: levanta el servidor al iniciar sesion, para que la captura tenga a quien llamar tras un reinicio.' `
    -Disparador  "<LogonTrigger><Enabled>true</Enabled><UserId>$usuario</UserId><Delay>PT20S</Delay></LogonTrigger>" `
    -Limite      'PT0S' `
    -Script      'servidor.cmd'

# Repeticion sin <Duration>, que en este formato significa indefinida.
Nueva-Tarea `
    -Nombre      'Juampi captura' `
    -Descripcion 'Dashboard: dispara una captura de escuchas recientes cada 20 minutos. Sin ventana.' `
    -Disparador  '<TimeTrigger><Repetition><Interval>PT20M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><StartBoundary>2026-07-28T12:00:00</StartBoundary><Enabled>true</Enabled></TimeTrigger>' `
    -Limite      'PT10M' `
    -Script      'capture.cmd'

Write-Host ''
Write-Host 'Retirando las tareas del proyecto viejo...' -ForegroundColor Cyan

$pendientes = @()
foreach ($vieja in 'Voidtify servidor', 'Voidtify captura') {
    if (-not (Get-ScheduledTask -TaskName $vieja -ErrorAction SilentlyContinue)) {
        Write-Host "  $vieja : ya no existe"
        continue
    }
    schtasks /End /TN $vieja 2>$null | Out-Null
    schtasks /Delete /TN $vieja /F 2>$null | Out-Null
    if (Get-ScheduledTask -TaskName $vieja -ErrorAction SilentlyContinue) {
        Write-Host "  $vieja : NO se pudo retirar" -ForegroundColor Yellow
        $pendientes += $vieja
    } else {
        Write-Host "  $vieja : retirada"
    }
}

if ($pendientes) {
    Write-Host ''
    Write-Host 'Vuelve a ejecutar este script COMO ADMINISTRADOR para retirar:' -ForegroundColor Yellow
    $pendientes | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host 'Son propiedad del grupo Administradores y un usuario normal no puede borrarlas.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Estado de las tareas:' -ForegroundColor Green
Get-ScheduledTask -TaskName 'Juampi *', 'Voidtify *' -ErrorAction SilentlyContinue |
    Select-Object TaskName, State,
        @{n='Bateria';  e={ if ($_.Settings.DisallowStartIfOnBatteries) { 'NO corre' } else { 'corre' } }},
        @{n='Recupera'; e={ $_.Settings.StartWhenAvailable }} |
    Format-Table -AutoSize
