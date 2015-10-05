:: An electron-app updater script for Windows platforms
:: https://github.com/mugifly/electron-updater-gh-releases

set APP_NAME=%1
set APP_DIR=%2
set NEW_VER_DIR=%3

@echo off

echo "-- Updater script --"

timeout 5

call :restore_special_filename

call :do_app_self_test

call :replace_files

echo "--------------------"
echo "  Update was done"
echo "--------------------"

call :launch_new_ver

exit 0


:: Restore a special filename
:restore_special_filename
	:: resources/atom.asar -- Because can not extract atom.asar in Electron apps
	if exist %NEW_VER_DIR%\resources\atom-asar (
		echo "Restore a special filename: atom.asar"
		copy %NEW_VER_DIR%\resources\atom-asar %NEW_VER_DIR%\resources\atom.asar
	)
exit /b 0


:: Execute the startup testing for the new app
:do_app_self_test
	echo "Now testing..."
	:: Launch the app of new version under self testing mode
	FOR /F "usebackq" %t IN (`start /wait %NEW_VER_DIR%\%APP_NAME% --upd-self-test`) DO SET TEST_RESULT=%t
	:: Check the testing result
	echo %TEST_RESULT% | find "OKAY" >NUL
	if ERRORLEVEL 1 (
		echo "New version was broken :("
		exit 255
	)
exit /b 0


:: Replace the old version with the new version
:replace_files
	echo "Updating..."
	for /F %%file_path in ('dir %NEW_VER_DIR% /b /s') do (
		move /Y %file_path% %APP_DIR%\
	)
exit /b 0


: Launch the new app
:launch_new_ver
	echo "Launching new version... Enjoy :)"
	%APP_DIR%\%APP_NAME%
exit /b 0
