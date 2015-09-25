var assert = require('assert');

var Updater = require('../updater');

describe('Choosing of a suitable asset', function() {

	var assets = [
		{
			id: 0,
			url: 'https://api.github.com/repos/mugifly/electron-updater-gh-releases-example/releases/assets/0',
			name: 'example-linux-x64-v1.0.1.zip',
			browser_download_url: 'https://github.com/mugifly/electron-updater-gh-releases-example/releases/download/v1.0.1/example-linux-x64-v1.0.1.zip',
			state: 'uploaded',
			size: 0,
			download_count: 0
		},
		{
			id: 1,
			url: 'https://api.github.com/repos/mugifly/electron-updater-gh-releases-example/releases/assets/1',
			name: 'example-linux-ia32-v1.0.1.zip',
			browser_download_url: 'https://github.com/mugifly/electron-updater-gh-releases-example/releases/download/v1.0.1/example-linux-ia32-v1.0.1.zip',
			state: 'uploaded',
			size: 0,
			download_count: 0
		}
	];

	it('Suitable asset for linux ia32', function () {
		var updater = new Updater({
			appVersion: '1.0.0',
			execFileName: 'example',
			releaseFileNamePrefix: 'example-',
			ghAccountName: 'mugifly',
			ghRepoName: 'electron-updater-gh-releases-example',
			devicePlatform: 'linux',
			deviceArch: 'ia32'
		});
		var asset = updater.getSuitableAsset(assets);
		assert.equal(asset.name, 'example-linux-ia32-v1.0.1.zip');
	});

	it('Suitable asset for linux x64', function () {
		var updater = new Updater({
			appVersion: '1.0.0',
			execFileName: 'example',
			releaseFileNamePrefix: 'example-',
			ghAccountName: 'mugifly',
			ghRepoName: 'electron-updater-gh-releases-example',
			devicePlatform: 'linux',
			deviceArch: 'x64'
		});
		var asset = updater.getSuitableAsset(assets);
		assert.equal(asset.name, 'example-linux-x64-v1.0.1.zip');
	});

	it('Suitable asset (not found) for linux arm', function () {
		var updater = new Updater({
			appVersion: '1.0.0',
			execFileName: 'example',
			releaseFileNamePrefix: 'example-',
			ghAccountName: 'mugifly',
			ghRepoName: 'electron-updater-gh-releases-example',
			devicePlatform: 'linux',
			deviceArch: 'arom'
		});
		var asset = updater.getSuitableAsset(assets);
		assert.equal(asset, null);
	});

});
