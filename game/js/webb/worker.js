/* Runs a kid's JavaScript plan away from the page, so a loop that never ends can't freeze the game.
   The page stops this worker if it takes too long. */
importScripts('data.js?v=14', 'model.js?v=14');
self.onmessage = e => { const {code, week} = e.data; self.postMessage(self.WEBB.runCode(code, week)); };
