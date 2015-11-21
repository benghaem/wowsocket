#What is WowSocket.js?
WowSocket.js is tiny wrapper around `WebSocket()` that adds promise-like functionality to websocket messages as well as timeout and message retry.

WowSocket was designed as a wrapper for a browser's built-in `WebSocket()` implementation to enhance an existing JSON protocol. Because of this, WowSocket can be used as a near drop-in replacement for the WebSocket class while introducing the concept of response states and timeouts. WowSocket uses pure WebSockets and does not require any special software server-side and only requires the application to send and receive JSON objects that contain a customizable "id" key. The remainder of the structure of the JSON objects is completely customizable (Though WowSocket's "strict mode" can be used to enforce JSON-RPC 2.0 or any other custom protocol).

#Who should use this?
#### Individuals interested in...
* enhancing existing projects by adding timeouts to WebSocket communications as well as completion / failure states
* a websocket wrapper with a minor impact on existing JSON websocket protocols and the ability to define custom protocols
* features based on pure websockets instead of a framework such as socket.io or WAMP/Autobhan

#Documentation?
Build the docs with `jsdoc wowsocket.js`
