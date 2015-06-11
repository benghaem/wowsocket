function WowSocket(url, protocols){
	//Define values

	//The wrapped websocket
	this.ws = new WebSocket(url)
	//The basic functions asscociated with the wrapped websocket
	//Can and should be overwritten
	this.onopen = function(){console.log('WowSocket Opened')}
	this.onmessage = function(e){console.log(e)}
	this.onclose = function(){console.log('WowSocket Closed')}
	this.onerror = function(e){}
	
	var root_wow = this

	this.send_id_counter = 0;
	this.true_id_counter = 0;

	this.wsm_dict = {}

	this.ws.onopen = function(){
		root_wow.onopen()
	}
	this.ws.onmessage = function(e){
		root_wow.handle_message(e)
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

//WowSocket send
WowSocket.prototype.send = function(obj, timeout){
	wsm = new WowSocketMessage(obj, this, timeout)
	wsm.on_fail(wsm.built_in_retry())
	wsm.send()
}

WowSocket.prototype.send_wsm = function(wsm){
	this.add_wsm(wsm);
	this.ws.send(wsm.to_json())
}

WowSocket.prototype.handle_message = function(event){
	try{
		var wsm_response_obj = JSON.parse(event.data);
		var handle_id = wsm_response_obj['trackid'].toString()
		if (Object.keys(this.wsm_dict).indexOf(handle_id) != -1){
			this.wsm_dict[handle_id].complete(wsm_response_obj)
			this.remove_wsm(handle_id)
		}
	}
	catch(e){
		console.error(e);
	}
}

WowSocket.prototype.get_send_id = function(event){
	this.send_id_counter++;
	return this.send_id_counter;
}

WowSocket.prototype.get_true_id = function(event){
	this.true_id_counter++;
	return this.true_id_counter;
}

WowSocket.prototype.add_wsm = function(wsm){
	this.wsm_dict[wsm.send_id.toString()] = wsm;
}

WowSocket.prototype.remove_wsm = function(wsm_id){
	delete this.wsm_dict[wsm_id]
}

function WowSocketMessage(msg_obj, wowsocket, timeout_length, verbose){
		if (typeof msg_obj !== "object") {
			throw new TypeError("msg_obj must be an object");
		};

		//Take input msg_object and attach trackid
		this.msg = msg_obj;
		this.send_id = undefined;

		//The wowsocket the message is associated with
		this.wowsocket = wowsocket;

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

	WowSocketMessage.prototype.reset_state = function(){
		this.state = 0;
		this.result = "";
	}

	WowSocketMessage.prototype.get_result = function(){
		return this.result;
	}

	WowSocketMessage.prototype.on_complete = function(funct){
		this.complete_action = funct;
	}

	WowSocketMessage.prototype.on_fail = function(funct){
		this.fail_action = funct;
	}

	WowSocketMessage.prototype.to_json = function(){
		return JSON.stringify(this.msg)
	}


	//This function sets up retry related variables within the object and will retry the send the set number of tries. If no value is passed for num retry the default is set to 3. If -1 is passed for num_retry the message will retry forever. The function observes the object level verbosity setting.
	WowSocketMessage.prototype.built_in_retry = function(num_retry, retry_callback, retry_failed_callback){
		this.retry_count = 0
		if (num_retry === undefined) {
			this.retry_max = 3;
		}else{
			this.retry_max = num_retry
		}

		this.rc = retry_callback || function(){}
		this.rfc = retry_failed_callback || function(){}

		return function(err){
			if ((err && this.retry_count < this.retry_max) || (err && this.retry_max === -1)){
				this.rc()
				if (this.verbose) {
					console.log("WSM with trackid:"+this.send_id+" Retrying")
				};
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