// require("update-electron-app")(); // uncomment this line to enable auto-updates.
// we commented out because of https://github.com/smol-ai/menubar/issues/17

// Logging library
const log = require('electron-log');
const { dialog } = require('electron') 

// Menubar library to create electron applications that reside in the system's menubar
const { menubar } = require('menubar');

// Path module for handling and transforming file paths
const path = require('path');

// Importing necessary modules from electron
const {
	app,
	BrowserWindow,
	nativeImage,
	Tray,
	Menu,
	globalShortcut,
	shell,
} = require('electron');

// Getting the application's version from package.json
const { version } = require('./package.json');

// Providers for different services
const providers = {
	OpenAi: require('./providers/openai'),
	Bard: require('./providers/bard'),
	Bing: require('./providers/bing'),
	Claude: require('./providers/claude'),
	Claude2: require('./providers/claude2'),
	OobaBooga: require('./providers/oobabooga'),
	Smol: require('./providers/smol'),
};

// Getting all the providers in an array
const allProviders = Object.values(providers);

// Electron-store used for persistent data storage
const Store = require('electron-store');
const store = new Store();
console.log('if process.env.NODE_ENV is development, reset the store', process.env.NODE_ENV )
if (process.env.NODE_ENV === 'development') {
	store.clear() // reset to defaults when in dev
}
log.info('store reset', store); // Logging the store

// Context menu for electron apps
const contextMenu = require('electron-context-menu');

// Creating an icon image
const image = nativeImage.createFromPath(
	path.join(__dirname, `images/iconTemplate.png`)
);

// Once the app is ready, the following code will execute
app.on('ready', () => {

	const tray = new Tray(image);

	const mb = menubar({
		browserWindow: {
			icon: image,
			transparent: path.join(__dirname, `images/iconApp.png`),
			autoHideMenuBar: false,
			webPreferences: {
				webviewTag: true,
				nodeIntegration: true,
				contextIsolation: false,
				enableWebView: true, // from chatgpt
				// nativeWindowOpen: true,
			},
			width: 1200,
			height: 750,
		},
		tray,
		showOnAllWorkspaces: true,
		preloadWindow: true,
		showDockIcon: false,
		icon: image,
	});

  // On menubar ready, the following code will execute
	mb.on('ready', () => {
		const { window } = mb;

		if (process.platform !== 'darwin') {
			window.setSkipTaskbar(true);
		} else {
			app.dock.hide();
		}

    // The createContextMenuTemplate function creates the context menu template
		// It contains the header, providers' toggles, links, and footer of the menu
    const createContextMenuTemplate = () => {
      const menuHeader = [
        {
          label: 'Quit',
          accelerator: 'CommandorControl+Q',
          click: () => {
            app.quit();
          },
        },
        {
          label: 'Reload',
          accelerator: 'CommandorControl+R',
          click: () => {
            window.reload();
          },
        },
        {
          label: 'Quick Open (use this!)',
          accelerator: 'CommandorControl+Shift+G',
          click: () => {
            window.reload();
          },
        }
      ];

      const separator = { type: 'separator' };

			const providersToggles = allProviders.map(provider => {
				return {
					label: provider.fullName,
					type: 'checkbox',
					checked: store.get(`${provider.webviewId}Enabled`, provider.isEnabled()),
					click: () => {
						store.set(
							`${provider.webviewId}Enabled`,
							!provider.isEnabled()
						);
						setTimeout(() => {
							window.reload();
						}, 100)
					},
				};
			});

			const superPromptEnterKey = {
				label: '"Enter" Key also submits chat (vs Cmd+Enter)',
				type: 'checkbox',
				checked: store.get('SuperPromptEnterKey', false),
				click: () => {
					store.set(
						'SuperPromptEnterKey',
						!store.get('SuperPromptEnterKey', false)
					);
					window.reload();
				},
			};

      const providerLinks = allProviders.map(provider => {
        return {
          label: `Visit ${provider.name} website`,
          click: () => {
            shell.openExternal(provider.url);
          },
        };
      });

      const menuFooter = [
        {
          label: 'View on GitHub',
          click: () => {
            shell.openExternal('https://github.com/smol-ai/menubar');
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Version ' + version,
        }
      ]

      // Return the complete context menu template
      return [
        ...menuHeader,
        separator,
        ...providersToggles,
        {
          label: 'Custom Pane 0',
					type: 'checkbox',
					checked: !!store.get(`customPane0`, false),
          click: () => {
            dialog.showMessageBox({
              type: 'question',
              buttons: allProviders.map(provider => provider.fullName),
              title: 'Select a provider',
              message: 'Which preset provider do you want to add?',
            }).then(result => {
							// find result.response in allProviders
							const provider = allProviders[result.response]
							store.set(`customPane0`, provider.fullName);
							console.log('set ', provider)
							setTimeout(() => {
								window.reload();
							}, 100)
            }).catch(err => {
              console.log(err)
            })
						// dialog.showOpenDialog(options).then(result => {
						// 	// result.canceled will be true if user canceled
						// 	// result.filePaths will have array of selected file paths 
						// 	window.reload();
						// })
          },
        },
        separator,
        superPromptEnterKey,
        separator,
        ...providerLinks,
        separator,
        ...menuFooter,
      ]
    };

    // Create the context menu when right-clicking the tray icon
		tray.on('right-click', () => {
      const contextMenuTemplate = createContextMenuTemplate();
			mb.tray.popUpContextMenu(Menu.buildFromTemplate(contextMenuTemplate));
		});

    // Create the context menu when clicking the tray icon with control or meta key
		tray.on('click', e => {
			//check if ctrl or meta key is pressed while clicking
			if (e.ctrlKey || e.metaKey) {
        const contextMenuTemplate = createContextMenuTemplate();
        mb.tray.popUpContextMenu(Menu.buildFromTemplate(contextMenuTemplate));
      }
		});
		const menu = new Menu();

		globalShortcut.register('CommandOrControl+Shift+g', () => {
			if (window.isVisible()) {
				mb.hideWindow();
			} else {
				mb.showWindow();
				if (process.platform == 'darwin') {
					mb.app.show();
				}
				mb.app.focus();
			}
		});

		Menu.setApplicationMenu(menu, { autoHideMenuBar: false });

		// open devtools if in dev mode
		if (process.env.NODE_ENV === 'development') {
			window.webContents.openDevTools();
		}

		console.log('Menubar app is ready.');
	});

	app.on('web-contents-created', (e, contents) => {
		if (contents.getType() == 'webview') {
			// contents.on("will-navigate", (event, url, frameName, disposition, options, additionalFeatures) => {
			//   console.log({frameName})
			//   if (frameName === 'my_popup') {
			//     // Open `url` in a new window...
			//     event.preventDefault()
			//     Object.assign(options, {
			//       parent: win,
			//       width: 500,
			//       height: 400
			//     })
			//     event.newGuest = new BrowserWindow(options)
			//   }
			// })
			// open link with external browser in webview
			contents.setWindowOpenHandler('new-window', (e, url) => {
				e.preventDefault();
				shell.openExternal(url);
			});
			// set context menu in webview
			contextMenu({
				window: contents,
			});

			// we can't set the native app menu with "menubar" so need to manually register these events
			// register cmd+c/cmd+v events
			contents.on('before-input-event', (event, input) => {
				const { control, meta, key } = input;
				if (!control && !meta) return;
				if (key === 'c') contents.copy();
				if (key === 'x') contents.cut();
				// if (key === "v") contents.paste(); // we will handle this manually
				if (key === 'a') contents.selectAll();
				if (key === 'z') contents.undo();
				if (key === 'y') contents.redo();
				if (key === 'q') app.quit();
				if (key === 'r') contents.reload();
			});
		}
		// we can't set the native app menu with "menubar" so need to manually register these events
		// register cmd+c/cmd+v events
		contents.on('before-input-event', (event, input) => {
			const { control, meta, key } = input;
			if (!control && !meta) return;
			if (key === 'c') contents.copy();
			if (key === 'v') contents.paste();
			if (key === 'x') contents.cut();
			if (key === 'a') contents.selectAll();
			if (key === 'z') contents.undo();
			if (key === 'y') contents.redo();
			if (key === 'q') app.quit();
			if (key === 'r') contents.reload();
		});
	});

	if (process.platform == 'darwin') {
		// restore focus to previous app on hiding
		mb.on('after-hide', () => {
			mb.app.hide();
		});
	}

	// open links in new window
	// app.on("web-contents-created", (event, contents) => {
	//   contents.on("will-navigate", (event, navigationUrl) => {
	//     event.preventDefault();
	//     shell.openExternal(navigationUrl);
	//   });
	// });

	// prevent background flickering
	app.commandLine.appendSwitch(
		'disable-backgrounding-occluded-windows',
		'true'
	);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
