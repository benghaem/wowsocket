// WowSocketJS V 0.2.2
// The MIT License (MIT)

// Copyright (c) 2015 Benjamin Ghaemmaghami

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/**
 * Create the wowsocket with the given parameters.
 *
 * @class
 * @example
 *     WowSocket("ws://localhost/ws",false,{'id':'trackerid'})
 *     // => WowSocket() 
 *
 * @param {String} url url to connect to
 * @param {Boolean} [verbose=false] verbose mode
 * @param {Object} [custom_response_keys={'id':'id','result':'result','error':'error'}] Custom keys to be used instead of the default when determining id, result, and error keys
 * @param {String} [protocols] Protocols to be passed to the underlying websocket
 * @return {WowSocket} A new WowSocket
 * @access public
 */

function WowSocket(url, verbose, custom_response_keys, protocols){

	//The wrapped websocket

	// protocols causes some trouble. The documentation states
	// the protocols argument is set to an empty string if
	// empty, but passing an empty string causes an error.
	// Passing an empty array works, but I consider that undocumeted behavior.

	if (protocols) {
		this.ws = new WebSocket(url, protocols)
	} else {
		this.ws = new WebSocket(url)
	}

	//The basic functions associated with the wrapped websocket
	//Can and should be overwritten
	this.onopen = function(){console.log('WowSocket Opened')}
	this.onmessage = function(e){console.log(e)}
	this.onclose = function(){console.log('WowSocket Closed')}
	this.onerror = function(e){}
	
	//Setup base states of counters 
	this.send_id_counter = 0;
	this.true_id_counter = 0;

	//Setup verbosity
	this.verbose = verbose || false;

	//Create obj where we will store future WSMs
	this.wsm_dict = {}

	//Set response keys 
	this.response_keys = {};
	this.response_keys['id'] = custom_response_keys['id'] || 'id';
	this.response_keys['result'] = custom_response_keys['result'] || 'result';
	this.response_keys['error'] = custom_response_keys['error'] || 'error';

	//save this context for mapping to base ws
	var root_wow = this

	//bind events of the root websocket to the same events on the wowsocket for ease of use
	this.ws.onopen = function(){
		root_wow.onopen()
	}
	this.ws.onmessage = function(e){
		//Call special message handler to check for WSM action
		root_wow.handle_message(e)

		//Call whatever the user's custom handler is
		root_wow.onmessage(e)
	}
	this.ws.onclose = function(){
		root_wow.onclose()
	}
	this.ws.onerror = function(e){
		root_wow.onerror(e)
	}
}

/**
 * Send a message directly over the internal WebSocket
 *
 * @param {String} msg Message to send over the WebSocket
 * @access public
 */

WowSocket.prototype.send_raw = function(msg){
	this.ws.send(msg)
}

/**
 * Close the WowSocket
 *
 * @access public
 */
WowSocket.prototype.close = function(){
	this.ws.close()
}

/**
 * Send an object over the WowSocket. This is a simple way to get most of the behavior of the WowSocket without creating WSMs. As long as you are sending JSON objects this will add timeouts and three retries for free
 *
 * @param {Object} obj Object to send over the WebSocket
 * @param {Integer} [timeout=5000] Timeout in ms of the message
 * @access public
 */
WowSocket.prototype.send = function(obj, timeout){
	wsm = new WowSocketMessage(obj, this, timeout)
	wsm.on_fail(wsm.built_in_retry())
	wsm.send()
}

/**
 * Internal method to directly send a WSM. WSM.send() should be used instead of this method
 *
 * @param {WowSocketMessage} wsm WowSocketMessage to send over the WebSocket
 * @access private
 */
WowSocket.prototype.send_wsm = function(wsm){
	this.add_wsm(wsm);
	this.ws.send(wsm.to_json())
}

//The message handler which will call callbacks
WowSocket.prototype.handle_message = function(event){
	try{
		var wsm_response_obj = JSON.parse(event.data);
		// Check to ensure that id is actually part of the obj
		if (wsm_response_obj[this.response_keys['id']]){
			var handle_id = wsm_response_obj[this.response_keys['id']].toString();
			// if (Object.keys(this.wsm_dict).indexOf(handle_id) != -1){
			var handler = null;
			if (handler = this.wsm_dict[handle_id]){
				// var handler = this.wsm_dict[handle_id]
				if (wsm_response_obj[this.response_keys['result']]){
					handler.complete(wsm_response_obj['result'])
				}
				else if (wsm_response_obj[this.response_keys['error']]){
					handler.fail(wsm_response_obj['error'])
				}
				else {
				 	handler.fail(new Error("Message structure incorrect"))
				}
				
			}
		}
	}
	catch(e){
		console.error(e);
	}
}

//Counter incrementing getters
WowSocket.prototype.get_send_id = function(event){
	this.send_id_counter++;
	return this.send_id_counter;
}

WowSocket.prototype.get_true_id = function(event){
	this.true_id_counter++;
	return this.true_id_counter;
}

//Management of wsm_dict
WowSocket.prototype.add_wsm = function(wsm){
	this.wsm_dict[wsm.send_id.toString()] = wsm;
}

WowSocket.prototype.remove_wsm = function(wsm_id){
	delete this.wsm_dict[wsm_id]
}


function SendWowSocketMessage(msg_obj,wowsocket,timeout_length){
    var msg = new WowSocketMessage(msg_obj, wowsocket, timeout_length)
    msg.send();
    return msg;
}

/**
 * @class
 * Create a WowSocketMessage
 *
 * @param {Object} msg_obj Object to send over the WowSocket
 * @param {WowSocket} wowsocket WowSocket to associate with
 * @param {Integer} [timeout_length=5000] Length of time in ms before timeout occurs
 * @return {WowSocketMessage} A new WowSocketMessage
 * @api public
 */


function WowSocketMessage(msg_obj, wowsocket, timeout_length){
		if (typeof msg_obj !== "object") {
			throw new TypeError("Message in must be an object");
		};

		//Take input msg_object and attach id
		this.msg = msg_obj;
		this.send_id = undefined;

		//The wowsocket the message is associated with
		this.wowsocket = wowsocket;

		//true id will never change whereas send_id will change on retry
		this.true_id = this.wowsocket.get_true_id()

		//Set base state of state machine
		this.result = "";
		this.state = 0;
		// 0 pending
		// 1 complete
		// 2 failure

		//Setup timeout
		this.timeout = undefined;
		this.timeout_ms = timeout_length || 5000;

		//Setup callbacks
		this.fail_action = function(e){
			throw e
		}
		this.complete_action = function(e){
			console.log("complete" + e)
		}
	}
 
    /**
     * Send the WowSocketMessage. This is the correct way to send a custom WSM
     *
     * @api public
     */
	WowSocketMessage.prototype.send = function () {
		//Get a new id before sending
		var new_id = this.wowsocket.get_send_id()
		this.send_id = new_id
		this.msg['id'] = new_id
		
		//Save this context for use in timeout
		var root_wsm = this
		timeout = window.setTimeout(function(){root_wsm.fail(new Error('Timeout'))},this.timeout_ms)

		//Send WSM
		this.wowsocket.send_wsm(this)
	};

	//Internal function to set WSM to fail state
	WowSocketMessage.prototype.fail = function(err){
		if (this.state === 0) {
				if (this.wowsocket.verbose) {
					console.error("WSM with id:"+this.send_id+" failed for "+err+" and was marked as failed")
				};
				this.state = 2
				//Unregister from wsm_dict
				this.wowsocket.remove_wsm(this.send_id);
				this.result = err;
				this.fail_action(err)
			};
	}
		
	//Internal function to set WSM to complete state
	WowSocketMessage.prototype.complete = function(val){
		if (this.state === 0){
			if (this.wowsocket.verbose) {
				console.log("WSM with id:"+this.send_id+" recived response and was marked as completed")
			};
			this.state = 1;
			//Unregister from wsm_dict
			this.wowsocket.remove_wsm(this.send_id);
			window.clearTimeout(this.timeout);
			this.result = val;
			this.complete_action(val);
		}
	}

     /**
     * Get the state of the WowSocketMessage in human readable form
     * @returns {String} "Pending", "Completed", or "Failed"
     * @api public
     */
	WowSocketMessage.prototype.get_state = function(){
		switch (this.state){
			case 0:
				return "Pending";
			case 1:
				return "Completed";
			case 2:
				return "Failed";
		}
	}

	//Internal function to reset state
	WowSocketMessage.prototype.reset_state = function(){
		this.state = 0;
		this.result = "";
	}

	//Getter for result
	WowSocketMessage.prototype.get_result = function(){
		return this.result;
	}

     /**
     * Bind a function to the WebSocketMessage complete state
     *
     * @param {Function} funct Function to call when WebSocketMessage completes
     * @api public
     */
	//These functions can be used to bind custom behavior to the message's state changes
	WowSocketMessage.prototype.on_complete = function(funct){
		this.complete_action = funct;
	}

    /**
     * Bind a function to the WebSocketMessage failure state
     * @function=
     * @param {Function} funct Function to call when WebSocketMessage fails
     * @api public
     */
	WowSocketMessage.prototype.on_fail = function(funct){
		this.fail_action = funct;
	}

	//Internal function to convert WSM msg to JSON
	WowSocketMessage.prototype.to_json = function(){
		return JSON.stringify(this.msg)
	}

    /**
     * This function sets up retry related variables within the object and will retry the send the set number of tries. If no value is passed for num retry the default is set to 3. If -1 is passed for num_retry the message will retry forever. The function observes the object level verbosity setting.
     *
     * @param {Integer} [num_retry=3] Number of times to retry sending
     * @param {Function} [WowSocketMessage~retry_callback] Function to call on retry
     * @param {Function} [retry_failed_callback] Function to call on failure after final retry
     * @api public
     * @returns {Function} 
     */
	WowSocketMessage.prototype.built_in_retry = function(num_retry, retry_callback, retry_failed_callback){
		this.retry_count = 0

		//Set defaults
		if (num_retry === undefined) {
			this.retry_max = 3;
		}else{
			this.retry_max = num_retry
		}

		// rc is the retry callback -- called on retry
		this.rc = retry_callback || function(){}
		// rfc is the retry failed callback -- called when retry limit is met
		this.rfc = retry_failed_callback || function(){}

		//This function acts as more of a macro so it returns a function
		return function(err){
			//check retry counter and if an error was received
			if ((err && this.retry_count < this.retry_max) || (err && this.retry_max === -1)){
				
				this.rc()
				if (this.wowsocket.verbose) {
					console.log("WSM with id:"+this.send_id+" Retrying")
				};

				//Reset WSM to the base state
				this.retry_count++;
				this.reset_state();
				this.send();
			}
			else{
				this.rfc()
				if (this.wowsocket.verbose) {
					console.log("WSM with id:"+this.send_id+" exceeded max retry count")
				}
			}
		}
	}