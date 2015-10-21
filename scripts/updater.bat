:: An electron-app updater script for Windows platforms
:: https://github.com/mugifly/electron-updater-gh-releases

set APP_NAME=%1
set APP_DIR=%2
set NEW_VER_DIR=%3

@echo off

echo -- Updater script --

timeout 5

call :check_app_dir_perm

if %errorLevel% equ 1 (
	call :run_uac_prompt
)

call :restore_special_filename

::call :do_app_test

call :replace_files

echo --------------------
echo   Update was done
echo --------------------

call :launch_new_ver

exit 0

:: Check a permission of the app directory
:check_app_dir_perm
	echo Checking a permission of app directory...
	if exist "%APP_DIR%\upd-perm-test" (
		rmdir "%APP_DIR%\upd-perm-test"
	)
	mkdir "%APP_DIR%\upd-perm-test"
	if %errorLevel% neq 0 (
		echo Permission: NG
		echo An administrator privilege required.
		exit /b 1
	)
	rmdir "%APP_DIR%\upd-perm-test"
	echo Permission: OK
exit /b 0


:: Run the UAC prompt (Get the administrator privilege)
:run_uac_prompt
	echo Requesting administrator privilege...
	echo Set UAC = CreateObject^("Shell.Application"^) > "%APP_DIR%\run-uac.vbs"
	echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%APP_DIR%\run-uac.vbs"
	"%APP_DIR%\run-uac.vbs"
exit /b 0


:: Restore a special filename
:restore_special_filename
	:: resources/atom.asar -- Because can not extract atom.asar in Electron apps
	if exist %NEW_VER_DIR%\resources\atom-asar (
		echo Restore a special filename: atom.asar
		copy %NEW_VER_DIR%\resources\atom-asar %NEW_VER_DIR%\resources\atom.asar
	)
exit /b 0


:: Execute the startup testing for the new app
:do_app_test
	echo Now testing...
	:: Launch the app of new version under self testing mode
	for /f "usebackq tokens=*" %%t in (`cmd %NEW_VER_DIR%\\%APP_NAME% --upd-self-test`) do @set RESULT=%%t
	:: Check the testing result
	echo %RESULT% | find "OKAY" >NUL
	if %errorLevel% equ 1 (
		echo "New version was broken :("
		exit 255
	)
exit /b 0


:: Replace the old version with the new version
:replace_files
	echo Updating...
	for /f "usebackq" %%f in (`"dir %NEW_VER_DIR% /b /ad"`) do (
		echo robocopy %NEW_VER_DIR%\%%f %APP_DIR%\%%f /IS /E /PURGE
		robocopy %NEW_VER_DIR%\%%f %APP_DIR%\%%f /IS /E /PURGE
	)
	for /f "usebackq" %%f in (`"dir %NEW_VER_DIR% /b /a-d"`) do (
		echo copy %NEW_VER_DIR%\%%f %APP_DIR%\ /Y
		copy %NEW_VER_DIR%\%%f %APP_DIR%\ /Y
	)
exit /b 0


: Launch the new app
:launch_new_ver
	echo Launching new version... Enjoy!
	%APP_DIR%\%APP_NAME%
exit /b 0
