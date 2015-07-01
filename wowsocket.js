// WowSocketJS V 0.1.1

function WowSocket(url, protocols){
	//The wrapped websocket
	this.ws = new WebSocket(url)

	//The basic functions associated with the wrapped websocket
	//Can and should be overwritten
	this.onopen = function(){console.log('WowSocket Opened')}
	this.onmessage = function(e){console.log(e)}
	this.onclose = function(){console.log('WowSocket Closed')}
	this.onerror = function(e){}
	
	//Setup base states of counters 
	this.send_id_counter = 0;
	this.true_id_counter = 0;

	//Create obj where we will store future WSMs
	this.wsm_dict = {}

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

//Expose base behavior
WowSocket.prototype.send_raw = function(msg){
	this.ws.send(msg)
}

WowSocket.prototype.close = function(){
	this.ws.close()
}

//WowSocket send: This is a simple way to get most of the behavior of the wowsocket without creating WSMs. As long as you are sending JSON objects this will add timeouts and a three retries for free
WowSocket.prototype.send = function(obj, timeout){
	wsm = new WowSocketMessage(obj, this, timeout)
	wsm.on_fail(wsm.built_in_retry())
	wsm.send()
}

//Internal method to directly send a WSM. WSM.send() should be used not this method.
WowSocket.prototype.send_wsm = function(wsm){
	this.add_wsm(wsm);
	this.ws.send(wsm.to_json())
}

//The message handler which will call callbacks
WowSocket.prototype.handle_message = function(event){
	try{
		var wsm_response_obj = JSON.parse(event.data);
		if (wsm_response_obj['trackid']){
			var handle_id = wsm_response_obj['trackid'].toString()
			if (Object.keys(this.wsm_dict).indexOf(handle_id) != -1){
				this.wsm_dict[handle_id].complete(wsm_response_obj)
				this.remove_wsm(handle_id)
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

//The WSM object
function WowSocketMessage(msg_obj, wowsocket, timeout_length, verbose){
		if (typeof msg_obj !== "object") {
			throw new TypeError("msg_obj must be an object");
		};

		//Take input msg_object and attach trackid
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
		this.timeout_ms = timeout_length || 10000;

		//Setup verbosity
		this.verbose = verbose || false;

		//Setup callbacks
		this.fail_action = function(e){
			throw e
		}
		this.complete_action = function(e){
			console.log("complete" + e)
		}
	}
 
 	//Sends the WSM. This is the correct way to send a custom WSM
	WowSocketMessage.prototype.send = function () {
		//Get a new id before sending
		var new_id = this.wowsocket.get_send_id()
		this.send_id = new_id
		this.msg['trackid'] = new_id
		
		//Save this context for use in timeout
		var root_wsm = this
		timeout = window.setTimeout(function(){root_wsm.fail(new Error('Timeout'))},this.timeout_ms)

		//Send WSM
		this.wowsocket.send_wsm(this)
	};

	//Internal function to set WSM to fail state
	WowSocketMessage.prototype.fail = function(err){
		if (this.state === 0) {
				if (this.verbose) {
					console.log("WSM with trackid:"+this.send_id+" failed for "+err+" and was marked as failed")
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
			if (this.verbose) {
				console.log("WSM with trackid:"+this.send_id+" recived response and was marked as completed")
			};
			this.state = 1;
			window.clearTimeout(this.timeout);
			this.result = val;
			this.complete_action(val);
		}
	}

	//Gets state in human readable form
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

	//These functions can be used to bind custom behavior to the message's state changes
	WowSocketMessage.prototype.on_complete = function(funct){
		this.complete_action = funct;
	}

	WowSocketMessage.prototype.on_fail = function(funct){
		this.fail_action = funct;
	}

	//Internal function to convert WSM msg to JSON
	WowSocketMessage.prototype.to_json = function(){
		return JSON.stringify(this.msg)
	}


	//This function sets up retry related variables within the object and will retry the send the set number of tries. If no value is passed for num retry the default is set to 3. If -1 is passed for num_retry the message will retry forever. The function observes the object level verbosity setting.
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
				if (this.verbose) {
					console.log("WSM with trackid:"+this.send_id+" Retrying")
				};

				//Reset WSM to the base state
				this.retry_count++;
				this.reset_state();
				this.send();
			}
			else{
				this.rfc()
				if (this.verbose) {
					console.log("WSM with trackid:"+this.send_id+" exceeded max retry count")
				}
			}
		}
	}