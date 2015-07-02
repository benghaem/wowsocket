//For testing/examples
window.onload = function(){
	init()
}

function init(){
	ws = new WowSocket("ws://localhost:8888/ws/", true)
	ws.onmessage = function(e){
		console.log(e.data);
	}
	display_wsm_dict(ws);
}

function display_wsm_dict(ws){
	setInterval(function(){
		var target = document.getElementById('wsm_dict_display')
		target.innerHTML = Object.keys(ws.wsm_dict) + ""
	},200)
}

function result_out(el,text,state){

	var d = new Date
	var line_prompt = document.createTextNode(d.toTimeString()+":  ")
	var line_text = document.createTextNode(text)

	var line = document.createElement('div')
	line.setAttribute('class',"example_result_line")
	line.appendChild(line_prompt)

	if (state === 2) {
		var err_wrap = document.createElement('span')
		err_wrap.setAttribute('class','err')
		err_wrap.appendChild(line_text)
		line.appendChild(err_wrap)	
	} else if (state === 1){
		var succ_wrap = document.createElement('span')
		succ_wrap.setAttribute('class','succ')
		succ_wrap.appendChild(line_text)
		line.appendChild(succ_wrap)
	}
	else{
		line.appendChild(line_text)
	}

	el.appendChild(line)
	el.scrollTop = el.scrollHeight
}

function ex1(){
	var output = document.getElementById("ex1")

	var wsm = new WowSocketMessage({'test-request':1},ws,2500,true)
	wsm.on_complete(
		function(data){
			result_out(output, "Recived response:" + wsm.true_id +":"+wsm.send_id,1)
		})
	wsm.on_fail(
		function(){
			result_out(output,"Response timeout:" + wsm.true_id +":"+wsm.send_id,2)
		})
	wsm.send()
	result_out(output, "Sent message:" + wsm.true_id +":"+wsm.send_id)
}

function ex2(){
	var output = document.getElementById("ex2")

	var wsm = new WowSocketMessage({'test-request':1},ws,1000,true)
	wsm.on_complete(
		function(data){
			result_out(output, "Recived response:" + wsm.true_id +":"+wsm.send_id,1)
		})
	wsm.on_fail(
		function(){
			result_out(output,"Response timeout:" + wsm.true_id +":"+wsm.send_id,2)
		})
	wsm.send()
	result_out(output, "Sent message:" + wsm.true_id +":"+wsm.send_id)
}

function ex3(){

	var output = document.getElementById("ex3")
	var rc = function(){
		result_out(output, "Response timeout, retrying:" + this.true_id+":"+this.send_id,2)
	}

	var rfc = function(){
		result_out(output, "Retry failed, ending:" + this.true_id+":"+this.send_id,2)
	}

	
	var wsm = new WowSocketMessage({'test-request':1},ws,1000,1)
	wsm.on_complete(
		function(data){
			result_out(output, "Recived response:" + wsm.true_id +":"+wsm.send_id,1)
		})
	wsm.on_fail(
		wsm.built_in_retry(3, rc, rfc)
		)
	wsm.send()
	result_out(output, "Sent message:" + wsm.true_id +":"+wsm.send_id)
}