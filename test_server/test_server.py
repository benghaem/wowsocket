#!/usr/bin/python
 
import tornado.web
from tornado.web import RequestHandler, Application, url, gen
import tornado.websocket
import tornado.ioloop
import os
import simplejson as json
import websocket_msg_layer as wml

 
class WebSocketHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print("New client connected")

    @tornado.gen.coroutine
    def on_message(self, msg):
        print(msg)
        yield gen.sleep(3)
        if type(msg) is str:
            try:
                #load message json and grab type
                msg_obj = json.loads(msg)
                msg_type = msg_obj['mtype']
                msg_id = msg_obj['trackid']
                print(msg_obj)
                
                # Request type
                if msg_type == 'request':
                    print("got request")
                    request_content = msg_obj['content']
                    if request_content == 'test':
                        print("got test content")
                        self.write_message(wml.req_response('testreturn','test',msg_id))
                else:
                    pass
            except:
                self.write_message(msg)
                print(msg)

    def on_close(self):
        print("Client disconnected")

class WebLaunch(RequestHandler):
    def get(self):
        self.render(template_name="index.html")

settings = {
    "static_path": os.path.join(os.path.dirname(__file__), "static"),
    "cookie_secret": os.environ.get("SECRET_KEY", os.urandom(50)),
    "xsrf_cookies": True,
    "debug": True,
}

application = tornado.web.Application([

    url(r"/", WebLaunch),
    url(r"/ws/", WebSocketHandler),
    url(r"/static/(.*)", tornado.web.StaticFileHandler,dict(path=settings['static_path']))
        ], **settings)
 
if __name__ == "__main__":
    application.listen(8888)
    tornado.ioloop.IOLoop.instance().start()

