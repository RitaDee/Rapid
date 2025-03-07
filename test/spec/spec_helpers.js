/* globals chai:false */
/* eslint no-extend-native:off */

// Try not to load imagery
window.location.hash = '#background=none';

mocha.setup({
  timeout: 5000,  // 5 sec
  ui: 'bdd',
  globals: [
    '__onmousemove.zoom',
    '__onmouseup.zoom',
    '__onkeydown.select',
    '__onkeyup.select',
    '__onclick.draw',
    '__onclick.draw-block'
  ]
});

expect = chai.expect;

window.d3 = Rapid.d3;   // Remove this if we can avoid exporting all of d3.js
window.sdk = Rapid.sdk;
delete window.PointerEvent;  // force the brower to use mouse events

fetchMock.config.fallbackToNetwork = false;
fetchMock.config.overwriteRoutes = false;
