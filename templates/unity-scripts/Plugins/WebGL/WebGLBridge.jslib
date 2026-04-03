/*
 * WebGLBridge.jslib — JavaScript interop plugin for Unity WebGL builds.
 * Enables Unity C# to send messages to the parent React app via postMessage.
 *
 * The reverse direction (React → Unity) is handled by the hosting index.html
 * which listens for postMessage and calls unityInstance.SendMessage().
 */
mergeInto(LibraryManager.library, {

    /**
     * Send a JSON message from Unity to the parent React app.
     * Called from C# via: WebGLBridge.SendToReact(jsonString)
     */
    JS_SendToReact: function (msgPtr) {
        var msg = UTF8ToString(msgPtr);
        try {
            var parsed = JSON.parse(msg);
            window.parent.postMessage({ source: 'unity', payload: parsed }, '*');
        } catch (e) {
            window.parent.postMessage({ source: 'unity', payload: { type: 'raw', data: msg } }, '*');
        }
    },

    /**
     * Log a message to the browser console (useful for WebGL debugging).
     */
    JS_ConsoleLog: function (msgPtr) {
        console.log('[Unity] ' + UTF8ToString(msgPtr));
    }
});
