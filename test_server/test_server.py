#!/usr/bin/python
 
import tornado.web
from tornado.web import RequestHandler, Application, url, gen
import tornado.websocket
import tornado.ioloop
import os
import random
import simplejson as json

class WebSocketHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print("New client connected")

    @tornado.gen.coroutine
    def on_message(self, msg):
        msg_obj = json.loads(msg)
        msg_id = msg_obj['id']

        output_dict = {}
        output_dict['id'] = msg_id
        output_dict['resulttty'] = "success!"

        # Fake delay 
        yield gen.sleep(1.2)
        self.write_message(json.dumps(output_dict))

    def on_close(self):
        print("Client disconnected")

class WebLaunch(RequestHandler):
    def get(self):
        self.render(template_name="index.html")

settings = {
    "main_path": os.path.join(os.path.dirname(__file__), "../"),
    "extra_path": os.path.join(os.path.dirname(__file__), ""),
    "cookie_secret": os.environ.get("SECRET_KEY", os.urandom(50)),
    "xsrf_cookies": True,
    "debug": True,
}

application = tornado.web.Application([

    url(r"/", WebLaunch),
    url(r"/ws/", WebSocketHandler),
    url(r"/test/(.*)", tornado.web.StaticFileHandler,dict(path=settings['main_path'])),
    url(r"/extra/(.*)", tornado.web.StaticFileHandler,dict(path=settings['extra_path'])),
        ], **settings)
 
if __name__ == "__main__":
    application.listen(8888)
    tornado.ioloop.IOLoop.instance().start()

