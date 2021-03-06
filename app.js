if (!Array.prototype.findIndex)//4 old browser like chromium 31 (don't have)
	Array.prototype.findIndex = function (predicate, thisValue) {//src : http://2ality.com/2013/12/array-prototype-find.html
		var arr = Object(this);
		if (typeof predicate !== 'function') {
			throw new TypeError();
		}
		for(var i=0; i < arr.length; i++) {
			if (i in arr) {// skip holes
				var elem = arr[i];
				if (predicate.call(thisValue, elem, i, arr)) {
					return i;//[find()] elem;
				}
			}
		}
		return -1;//[find()] undefined;
	}

const PARAMS = JSON.parse(document.querySelector('script[data-params]').getAttribute('data-params'));

require.config({
	// baseUrl	: PARAMS.baseUrl,
	paths: {
		ace: PARAMS.ace
	}
});

define(
	PARAMS.pluginName,
	['ace/ace'],
	function(ace) {

		'use strict';
		function myFullScreen(editor) {
			const FULL_SCREEN = 'fullScreen';

			document.body.classList.toggle(FULL_SCREEN);
			const fullScreen = document.body.classList.contains(FULL_SCREEN);
			if(fullScreen) {
				editor.container.classList.add(FULL_SCREEN);
			} else {
				editor.container.classList.remove(FULL_SCREEN);
			}
			editor.setAutoScrollEditorIntoView(!fullScreen);

			// hack against Ace !
			if(fullScreen) {
				editor.container.maxLines = editor.getOption('maxLines');
				editor.container.removeAttribute('style');
				editor.setOption('maxLines', '');
			} else if(editor.container.maxLines) {
				editor.setOption('maxLines', editor.container.maxLines);
			}

			editor.resize();
		}

		console.log('< ' + '-'.repeat(25) + ' These are modules for the ' + PARAMS.pluginName + ' plugin ' + '-'.repeat(25) + ' >');

		function focusOn(focus, editor) {
			// Ace does not manage resize event !
			// So drop and get the focus for enforcing repaint of the editor
			const container = editor.container;
			if(container.classList.contains('resize')) {
				const h = container.style.height;
				if(typeof container.previousHeight == 'undefined') {
					// console.log('I have the focus for the 1st time');
					container.previousHeight = h;
				}
				else if(container.previousHeight != h) {
					// console.log('I have the focus');
					const maxLines = editor.getOption('maxLines');
					if(typeof maxLines == 'number') {
						editor.setOption('maxLines', '');
					}
					editor.resize();
					container.previousHeight = h;
				}
			}
		}

		function createEditor(node, mode, context='normal') {
			const editor = ace.edit(node);
			if('theme' in PARAMS) {
				editor.setTheme('ace/theme/' + PARAMS.theme);
			}
				editor.getSession().setMode('ace/mode/' + mode);
				const options = {
				normal: {
					minLines	: 4,
					maxLines	: 25, // remove style in the editor.container in fullscreen mode !
					autoScrollEditorIntoView: true,
					// enableEmmet	: true,
					vScrollBarAlwaysVisible: true
				},
				sandbox: {
					minLines	: 2,
					maxLines	: 15,
					autoScrollEditorIntoView: true
				}
			}
			if(context in options) {
			    editor.setOptions(options[context]);
			}

			// Fix recommended by Ace Editor
			editor.$blockScrolling = Infinity

			return editor;
		}

		function showShortcuts(editor) {
			require('ace/ace').config.loadModule("ace/ext/keybinding_menu", function(module) {
				module.init(editor);
				editor.showKeyboardShortcuts()
			});
		}

		// Alter shortcuts for the keyboard
		ace.config.loadModule(
			"ace/commands/default_commands",
			function(module) {
				console.log('ace/commands/default_commands module loaded');
				[
					{ name: 'fullscreen', bindKey: 'F11', exec: myFullScreen },
					{ name: 'helpMe', bindKey: 'Ctrl-F1', exec: showShortcuts }
				].forEach(function(item) { module.commands.push(item); });

				// resolve conflict about "Ctrl-," between Ace and Emmet
				var ind = module.commands.findIndex(function(command) {
					return (command.name == 'showSettingsMenu');
				});
				if(ind != null) {
					module.commands[ind].bindKey = 'Ctrl-F11';
				}
			}
		);

		var statusbarExists = false;

		const TEXTAREAS = 'content chapo backend frontend sandbox'.split(' ').map(function(item) {
			return item.replace(/^(\w+)$/, 'textarea[name="$1"]')
		});
		var nodes = Array.prototype.slice.call(document.querySelectorAll(TEXTAREAS),0);//add forEach 2 nodeList //stackoverflow.com/a/15398145
		nodes.forEach(function(node) {
			if(node.name == 'sandbox') {
				// For testing in config.php
				const ed = createEditor(node, 'php', 'sandbox');
				const select = document.querySelector('select[name="theme"]');
				if(select != null) {
					select.addEventListener('change', function(event) {
						event.preventDefault();
						ed.setTheme('ace/theme/' + this.value);
					});
				}
			} else {
				const form1 = node.form;
				// Pour modifier z-index de .section .action-bar
				if((form1 != null)) {
					form1.classList.add(PARAMS.pluginName);
				}

				// container for editor
				const pre1 = document.createElement('PRE');
				pre1.id = 'ace-' + node.name;
				pre1.className = 'resize';
				node.parentElement.appendChild(pre1);

				// Container for statusbar
				const statusBar = document.createElement('DIV');
				statusBar.classList.add('statusbar');
				statusBar.innerHTML =
					'<div>' +
						'<span>' + PARAMS.pluginName + ' plugin</span>' +
						'<span data-command="helpMe">' + PARAMS.i18n.help + ': Ctrl-F1</span>' +
						'<span data-command="fullscreen">' + PARAMS.i18n.fullscreen + ': F11</span>' +
						'<span data-command="showSettingsMenu">' + PARAMS.i18n.settings + ': Ctrl-F11</span>' +
					'</div>' +
					'<div class="spacer">&nbsp;</div>';
				node.parentElement.appendChild(statusBar);
				statusbarExists = true;
				// Ace doesn't hide textarea element. So we do that !
				node.classList.add('hide');
				var mode = 'php';
				if(/^(?:back|front)end/.test(node.name)) {
					mode = 'css';
				} else if('template' in form1.elements) {
					const ext = form1.elements.template.value.replace(/^.*\.(\w+)$/, '$1');
					if(/^(?:css|html|javascript|json|xml|yaml)$/.test(ext)) {
						mode = ext;
					}
				}
				const ed = createEditor(pre1, mode);
				ed.setValue(node.value);
				ed.on('focus', focusOn);
				statusBar.editor = ed;
				statusBar.addEventListener('click', function(event) {
					if(event.target.tagName == 'SPAN' && event.target.hasAttribute('data-command')) {
						event.preventDefault();
						this.editor.execCommand(event.target.getAttribute('data-command'));
					}
				});

				// Traitement avant envoi du formulaire
				if(form1 != null) {
					if(form1.editors == undefined) {
						form1.editors = [];
						form1.addEventListener('submit', function(event) {
							this.editors.forEach(function(item) {
								item.node.value = item.editor.getValue();
							});
						});
					}
					form1.editors.push({
						editor	: ed,
						node	: node
					});
				}
			}
		});

		// Add indicator on each statusbar
		if(statusbarExists) { // no statusbar for config.php
			ace.config.loadModule(
				"ace/ext/statusbar",
				function(module) {
					// chaque statusbar a une class="statusbar" et this.editor
					console.log('ace/ext/statusbar module loaded');
					const version = require('ace/ace').version;
					var nodes = Array.prototype.slice.call(document.querySelectorAll('.statusbar'),0);//add forEach 2 nodeList*
					nodes.forEach(function(node) {
						const span = document.createElement('SPAN');
						span.innerHTML = 'Ace version ' + version;
						node.querySelector('div').appendChild(span);
						if(typeof node.editor != 'undefined') {
							const indicator = node.querySelector('ace_status-indicator');
							if(indicator == null) {
								const StatusBar = module.StatusBar;
								const st = new StatusBar(node.editor, node);
							}
						}
					});
				}
			);

			// And we don't want Emmet for config.php anymore.
			ace.config.loadModule(
				'ace/ext/emmet',
				function(Emmet) {
					console.log('ace/ext/emmet loaded');
					var net = require('ace/lib/net');
					net.loadScript(PARAMS.emmetCoreUrl, function() {
						Emmet.setCore(window.emmet);
						var nodes = Array.prototype.slice.call(document.querySelectorAll('.statusbar'),0);
						console.log(nodes);
						nodes.forEach(function(node) {
							if(typeof node.editor != 'undefined') {
								const mode = node.editor.getSession().getMode();
								node.editor.setOption('enableEmmet', true);
							}
						});
					});
				}
			);
		}
	}
);

require([PARAMS.pluginName]);