/**
 * An electron app updater with GitHub releases
 * https://github.com/mugifly/electron-updater-gh-releases
 *
 * @param  {Object} options Options
 * @return {Object}         Instance
 */
'use strict';

var Updater = function(options) {

	// Current verson string
	// e.g. 1.0.0
	if (!options.appVersion) throw 'Not specified appVersion';
	this.appVersion = options.appVersion;

	// Executable file name of the app
	// e.g. example.exe -> example
	if (!options.execFileName) throw 'Not specified execFileName';
	this.execFileName = options.execFileName;

	// Prefix for release filename (zip-archive) on GitHub
	// e.g. example-win32-ia32-v1.0.0.zip -> example-
	if (!options.releaseFileNamePrefix) throw 'Not specified releaseFileNamePrefix';
	this.releaseFileNamePrefix = options.releaseFileNamePrefix;

	// Account and Repository name of GitHub
	if (!options.ghAccountName || !options.ghRepoName) throw 'Not specified ghAccountName or ghRepoName';
	this.ghApiReleasesUrl = 'https://api.github.com/repos/' + options.ghAccountName + '/' + options.ghRepoName +  '/releases';

	// Prefix for temporary directory
	this.tmpDirPrefix = options.tmpDirPrefix || 'update-';

	// User-Agent string
	this.userAgent = options.userAgent || 'electron-updater-gh-releases';

	// Update check date
	this.updateCheckedAt = options.updateCheckedAt || 0;

	// Function for save the update check date
	this.funcSaveUpdateCheckdAt = options.funcSaveUpdateCheckdAt || null;

	// Minimum interval for Update checking
	this.updateCheckInterval = options.updateCheckInterval || 60 * 60 * 24 * 1000; // 24 hours

	// Debug loggin mode
	this.isDebug = options.isDebug || false;
	// Dry run mode -- If true, it will not to update a files of the app
	this.isDryRun = options.isDryRun || false;

	// Get the platfrom string -- e.g. win32, linux
	var os = require('os');
	this.devicePlatform = options.devicePlatform || os.platform();
	// Get the architecture string -- e.g. ia32, x64, arm
	this.deviceArch = options.deviceArch || os.arch();

};


/**
 * Execute the self testing mode if needed.
 * This method can called as a static method; Please call it when the app started.
 */
Updater.doSelfTestIfNeeded = function() {

	// Check whether the app started as self testing mode
	if (process.execArgv.indexOf('--self-test') == -1) return; // If not needed

	// Quit the app for indicate as successful
	process.exit(0);

};


/**
 * Check a newer version and update myself
 * @param  {Function} callback Callback function: function(is_successful, is_available, version_string, error_string)
 */
Updater.prototype.checkAndUpdate = function(callback) {

	var self = this;

	// Check the update check date
	if (self.updateCheckedAt != 0 && new Date().getTime() - self.updateCheckedAt < self.updateCheckInterval) {
		self._dlog('checkAndUpdate - Not yet reached to interval');
		callback(false, false, self.appVersion, null);
		return;
	}

	// Check a newer version
	self.checkUpdateAvailable(function(is_available, version_str, asset, error_str) {

		// Check the update check date
		if (self.updateCheckedAt != 0 && new Date().getTime() - self.updateCheckedAt < self.updateCheckInterval) {
			self._dlog('checkAndUpdate - Not yet reached to interval');
			callback(false, false, self.appVersion, null);
			return;
		}

		if (error_str) {
			callback(false, false, version_str, error_str);
			return;
		}

		// Save a current date as the update check date
		if (self.funcSaveUpdateCheckdAt == null) {
			self._dlog('checkAndUpdate - Could not save the update check date!');
		} else {
			self.updateCheckedAt = new Date().getTime();
			self.funcSaveUpdateCheckdAt(self.updateCheckedAt);
		}

		if (!is_available) { // Already latest
			callback(false, false, version_str, null);
			return;
		}

		// Update to the new version
		self.update(version_str, asset, function(is_success, error_str) {
			callback(is_success, true, version_str, error_str);
		});

	});

};


/**
 * Check whether there is newer version
 * @param  {Function} callback Callback function: function(is_available, version_string, asset, error_string)
 */
Updater.prototype.checkUpdateAvailable = function(callback) {

	var self = this;

	self._getLatestVersion(function(version_str, asset, error_str) {

		if (error_str) {
			callback(false, null, asset, error_str);
			return;
		}

		// Split parts of version number
		var cur_ver_parts = self.appVersion.split(/\./);
		var new_ver_parts = version_str.split(/\./);

		// Compare each parts
		var is_new = false;
		for (var i = 0, l = Math.min(cur_ver_parts.length, new_ver_parts.length); i < l; i++) {
			if (cur_ver_parts[i] < new_ver_parts[i]) {
				is_new = true;
				break;
			}
		}

		// Call the callback
		callback(is_new, version_str, asset, null);

	});

};


/**
 * Update to specific version
 * @param  {String}   version_str Version string -- e.g. 1.0.0
 * @param  {Object}   asset       Asset object which got from GitHub Releases API
 * @param  {Function} callback    Callback function: function(is_successful, error_string)
 */
Updater.prototype.update = function(version_str, asset, callback) {

	var self = this;

	var asset_name = asset.name;
	var asset_url = asset.browser_download_url;
	self._dlog('checkAndUpdate - Selected asset: ' + asset_name + ' - ' + asset_url);

	// Get an archive url which hosted on Amazon S3 from the browser download url
	self._getArchiveUrlByBrowserDownloadUrl(asset_url, function(archive_url, error_str) {

		if (error_str != null) {
			callback(false, error_str);
			return;
		} else if (self.isDryRun) {
			self._dlog('checkAndUpdate - Dry-run mode was enabled; It doesn\'t download the archive file.');
			callback(true, null);
			return;
		}

		self._dlog('checkAndUpdate - Archive url: ' + archive_url);

		// Make a save path for temporary
		var fs = require('fs'), temp = require('temp');
		var tmp_file_path = temp.path({suffix: '.zip'});

		// Download the asset
		var request = require('request');
		var out_file = fs.createWriteStream(tmp_file_path);
		self._dlog('checkAndUpdate - Download: ' + archive_url + ' -> ' + tmp_file_path);
		try {
			request(archive_url).pipe(out_file)
			.on('close', function() {

				// Make a temporary directory
				temp.mkdir(self.tmpDirPrefix, function(err, tmp_dir_path) {
					if (err) { // If failed
						callback(false, err.toString());
						return;
					}

					// Extract the asset file (ZIP archive)
					self._extractZipArchive(tmp_file_path, tmp_dir_path, function(is_success, error_str) {

						if (!is_success) { // If failed
							callback(false, error_str);
							return;
						}

						// Call an callback
						callback(true, null);

						// Execute the post processing in shell script
						var spawn_error_str = self._doPostProcess(tmp_dir_path);
						if (spawn_error_str != null) {
							callback(false, spawn_error_str);
							return;
						}

						// Quit my self
						var timer = setTimeout(function() {
							process.exit(0);
						}, 500);

					});
				});

			})
			.on('error', function(e) {
				callback(false, e.toString());
			});
		} catch (e) {
			callback(false, e.toString());
		}

	});

};


/**
 * Choose a suitable asset and get it
 * @param  {Array} assets  An array of asset which got from GitHub Releases API
 * @return {Object}        Get an asset which suited for this device
 */
Updater.prototype.getSuitableAsset = function(assets) {

	var self = this;

	// Make a priority for find a suitable asset
	var asset_keywords = [];
	if (self.deviceArch == 'ia32' || self.deviceArch == 'arm') {
		asset_keywords = [self.devicePlatform + '-' + self.deviceArch];
	} else if (self.deviceArch == 'x64') {
		asset_keywords = [self.devicePlatform + '-x64', self.devicePlatform + '-ia32'];
	} else {
		self._dlog('getSuitableAsset - Unknown architecture: ' + self.deviceArch);
		return null;
	}

	// Find an suitable asset
	var asset = null;
	for (var i = 0, l = asset_keywords.length; i < l; i++) {
		var asset_keyword = asset_keywords[i];
		for (var j = 0, l_ = assets.length; j < l_; j++) {
			var regexp = new RegExp('^' + self.releaseFileNamePrefix + asset_keyword + '.*');
			if (!assets[j].name.match(regexp) || assets[j].state != 'uploaded') continue;
			return assets[j];
		}
	}

	return null;

};


/**
 * Extract the archive file
 * @param  {String}   zip_file_path Path of ZIP archive file
 * @param  {String}   dest_dir_path Path of destination direction
 * @param  {Function} callback      Callback function: function(is_successful, error_string)
 */
Updater.prototype._extractZipArchive = function(zip_file_path, dest_dir_path, callback) {

	var self = this;

	var fs = require('fs'), path = require('path'),
		JSZip = new require('jszip'), mkdirp = require('mkdirp');

	// Read the archive
	fs.readFile(zip_file_path, function(err, data) {
		if (err) throw err;

		// Make an instance of unzipper
		var zip = new JSZip(data);

		// Extract each items from the archive
		var files = zip.files;
		var filenames = Object.keys(files);
		var replaced_filenames = [];
		var extractItem = function(index) {

			if (filenames.length <= index) { // All was done
				self._dlog('_extractZipArchive - Done: ' + dest_dir_path);
				callback(true, null);
				return;
			}

			var name = filenames[index], f = files[name],
				abs_path = dest_dir_path + path.sep + f.name;

			if (f.dir) { // Directory

				// Make the directory
				mkdirp(abs_path, function(err){

					if (err) {
						callback(false, err.toString());
						return;
					}
					self._dlog('_extractZipArchive - Directory created: ' + abs_path);
					extractItem(index + 1); // To next item

				});

			} else { // File

				// Replace special file name; Because can't extract atom.asar in Electron apps
				abs_path = abs_path.replace(/atom\.asar/, 'atom-asar');
				replaced_filenames.push(abs_path);

				// Extract the file
				fs.writeFile(abs_path, f.asNodeBuffer(), function (err) {

					if (err) {
						callback(false, err.toString());
						return;
					}
					self._dlog('_extractZipArchive - File created: ' + abs_path);
					extractItem(index + 1); // To next item

				});

			}

		};

		// To first item
		extractItem(0);

	});

};


/**
 * Get a latest version from repository
 * @param  {Function} callback Callback function: function(version_string, asset, error_string)
 */
Updater.prototype._getLatestVersion = function(callback) {

	var self = this;

	var request = require('request');
	request.get({
		'url': self.ghApiReleasesUrl,
		'headers': {
			'User-Agent': self.userAgent
		}
	}, function(err, res, body) {

		// Parse the json data
		var json = null;
		try {
			json = JSON.parse(body);
		} catch (e) {
			callback(null, null, e.toString());
			return;
		}
		if (json == null || json.length <= 0) {
			callback(null, null, 'Releases JSON format was invalid');
			return;
		} else if (!Array.isArray(json)) {
			callback(null, null, 'Releases item is empty or not found project: ' + self.ghApiReleasesUrl);
			return;
		}

		// Get a latest version
		var latest_ver = -1;
		if (json[0].name.match(/([0-9\.]+)/)) {
			latest_ver = RegExp.$1;
		} else {
			callback(null, null, 'Latest release was not found');
			return;
		}

		// Get latest assets
		var latest_assets = [];
		for (var i = 0, l = json[0].assets.length; i < l; i++) {
			latest_assets.push(json[0].assets[i]);
		}

		// Select a suitable asset
		var asset = self.getSuitableAsset(latest_assets);
		if (asset == null) {
			callback(false, 'Suitable asset is not found.\n\n'
				+ 'That filename should be as: ' + self.releaseFileNamePrefix
				+ self.devicePlatform + '-' + self.deviceArch + '-v' + latest_ver + '.zip');
			return;
		}

		// Call the callback
		callback(latest_ver, asset, null);

	});

};


/**
 * Get the archive url
 * @param  {[type]} browser_download_url  The browserDownloadUrl of asset data
 * @param  {Function} callback            Callback function: function(archive_url, error_string)
 */
Updater.prototype._getArchiveUrlByBrowserDownloadUrl = function(browser_download_url, callback) {

	var self = this;

	var request = require('request');
	request.get({
		'url': browser_download_url,
		'followRedirect': false,
		'followAllRedirects': false,
		'rejectUnauthorized': true
	}, function(err, res, body) {

		if (err) {
			callback(null, err.toString());
		} else if ((res.statusCode == 301 || res.statusCode == 302)) { // HTTP Redirect
			callback(res.headers.location, null);
		} else if (body.match(/(http|https):\/\/[^"]*/)) {
			callback(RegExp.$0, null);
		} else {
			callback(null, 'Could not get an archive url: ' + body);
		}

		return;

	});

};


/**
 * Execute the post processing in the shell script
 * The app must be quit self.
 * @return {String} Error string (if error occurred when an command spawned)
 */
Updater.prototype._doPostProcess = function(new_ver_dir) {

	var self = this;

	var fs = require('fs'), path = require('path'), child_process = require('child_process');

	// Get an root path of the current app
	var app_dir = path.resolve(__dirname, '../../../../');

	// Get an root path of the new app
	var files = fs.readdirSync(new_ver_dir);
	if (files.indexOf(self.executableFileName) == -1) { // If not found an executable file of the app in root
		for (var i = 0, l = files.length; i < l; i++) {
			var f = files[i];
			var regexp = new RegExp('^' + self.releaseFileNamePrefix);
			if (f.match(regexp)) {
				new_ver_dir = new_ver_dir + path.sep + f;
				self._dlog('Found an root path of the new app: ' + new_ver_dir);
				break;
			}
		}
	}

	// Get a path of shell script
	var sh_dir = path.join(new_ver_dir, 'resources', 'app', 'scripts');
	var sh_path = null;
	if (self.devicePlatform == 'win32') { // Windows
		sh_path = sh_dir + path.sep + 'updater.bat';
	} else { // Unix
		sh_path = 'sh ' + sh_dir + path.sep + 'updater.sh';
	}

	// Execute the shell script
	self._dlog('_doPostProcess - Execute: ' + sh_path + ' ' + self.executableFileName + ' ' + app_dir + ' ' + new_ver_dir);
	var sh_args = [self.executableFileName, app_dir, new_ver_dir];
	var child = null;
	try {
		child = child_process.spawn(sh_path, sh_args, {
			detached: true
		});
		child.unref();
	} catch (e) {
		return e.toString();
	}
	return null;
};


/**
 * Output a log string
 * @param  {String} str Output string
 */
Updater.prototype._dlog = function(str) {

	if (!this.isDebug) return;
	console.log('[DEBUG] ' + str);

};


/* ---- */

module.exports = Updater;
