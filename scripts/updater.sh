#!/bin/sh
# An electron-app updater script for UNIX platforms
# https://github.com/mugifly/electron-updater-github-releases

# An arguments
APP_NAME=$1
APP_DIR=$2
NEW_VER_DIR=$3

# Execute the startup testing for the new app
do_app_self_test() {
	# Change a permission
	chmod u+x "${NEW_VER_DIR}/${APP_NAME}"
	# Launch the app of new version under self testing mode
	"${NEW_VER_DIR}/${APP_NAME}" --self-test
	# Check the testing result
	if [ $? -ne 0 ]; then
		# Failed
		echo "New version was broken :("
		exit 255
	fi
}


# Restore a special filename
restore_special_filename() {
	# resources/atom.asar -- Because can't extract atom.asar in Electron apps
	if [ -f "${NEW_VER_DIR}/resources/atom-asar" ]; then
		echo "Restore a special filename: atom.asar"
		mv "${NEW_VER_DIR}/resources/atom-asar" "${NEW_VER_DIR}/resources/atom.asar"
	fi
}


# Replace the old version with the new version
replace_files() {
	echo "Updating..."
	app_root_files="${NEW_VER_DIR}/*"
	for file_path in ${app_root_files}; do
		cp --force --recursive --verbose "${file_path}" "${APP_DIR}/"
		rm --force --recursive "${file_path}"
	done
}


# Launch the new app
launch_new_ver() {
	echo "Launching new version... Enjoy :)"
	cd "${APP_DIR}"
	"./${APP_NAME}" &
}


# ----

echo "-- Updater script --"

sleep 1

restore_special_filename
do_app_self_test

set -e

replace_files

echo "--------------------"
echo "  Update was done"
echo "--------------------"

launch_new_ver

exit 0
