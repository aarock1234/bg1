addRefreshScript();
void import('./bg1');

// Sets up React Fast Refresh by hand, which Vite's dev server normally does
// in the page it serves. BG1 runs in a page it doesn't serve.
function addRefreshScript() {
  const devServerOrigin = new URL('', import.meta.url).origin;
  const refreshRuntimeUrl = `${devServerOrigin}/bg1/@react-refresh`;

  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import RefreshRuntime from '${refreshRuntimeUrl}'
    RefreshRuntime.injectIntoGlobalHook(self)
    self.$RefreshReg$ = () => {}
    self.$RefreshSig$ = () => type => type
    self.__vite_plugin_react_preamble_installed__ = true
  `;
  document.head.append(script);
}
