const net = require('net');

const parser = require("./parser.js");
// 请求API
class Request {
    constructor(options) {
        this.method = options.method || 'GET';
        this.host = options.host;
        this.port = options.port || 80;
        this.path = options.path || "/";
        this.body = options.body || {};
        this.headers = options.headers || {};

        if (!this.headers['Content-Type']) {
            this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        if (this.headers['Content-Type'] === 'application/json') {
            this.bodyText = JSON.stringify(this.body);
        } else if (
            this.headers['Content-Type'] === 'application/x-www-form-urlencoded'
        ) {
            this.bodyText = Object.keys(this.body).map((key) => `${key}=${encodeURIComponent(this.body[key])}`).join('&');
        }
        this.headers['Content-Length'] = this.bodyText.length;
    }

    // 转换数据
    toString() {
        return `${this.method} ${this.path} HTTP/1.1\r${Object.keys(this.headers).map((key) => key + ': ' + this.headers[key]).join('\r\n')}\r\r${this.bodyText}`;
    }

    send(connection) {
        return new Promise((resolve, reject) => {
            const parser = new ResponseParser();
            if (connection) {
                connection.write(this.toString());
            } else {
                // 主动创建connection
                connection = net.createConnection({
                        host: this.host,
                        port: this.port,
                    },
                    () => {
                        // 成功回调
                        connection.write(this.toString());
                    }
                );
                connection.on('data', (data) => {
                    parser.receive(data.toString());
                    //resolve(data.toString());
                    // 如果是结束, 则成功返回
                    if (parser.isFinished) {
                        resolve(parser.response);
                    }
                    // console.log(parser.statusLine);
                    // console.log(parser.headers);
                    connection.end();
                });
                connection.on('error', (err) => {
                    reject(err);
                    connection.end();
                });
            }
        });
    }
}

class Response {

}

class ResponseParser {
    constructor() {
        this.WAITING_STATUS_LINE = 0;
        this.WAITING_STATUS_LINE_END = 1;
        this.WAITING_HEADER_NAME = 2;
        this.WAITING_HEADER_SPACE = 3;
        this.WAITING_HEADER_VALUE = 4;
        this.WAITING_HEADER_LINE_END = 5;
        this.WAITING_HEADER_BLOCK_END = 6;
        this.WAITING_BODY = 7;

        this.current = this.WAITING_STATUS_LINE;
        this.statusLine = '';
        this.headers = {};
        this.headerName = '';
        this.headerValue = '';

        // 初始化bodyParser, 会在解析完header之后创建
        this.bodyParser = null;
    }

    // 保证有 bodyParser 并且是最后一个
    get isFinished() {
        return this.bodyParser && this.bodyParser.isFinished;
    }

    // Response API
    get response() {
        this.statusLine.match(/HTTP\/1.1 ([0-9]+)([\s\S]+)/);

        return {
            statusCode: RegExp.$1,
            statusText: RegExp.$2,
            headers: this.headers,
            body: this.bodyParser.content.join('')
        }
    }

    receive(string) {
        for (let i = 0; i < string.length; i++) {
            this.receiveChar(string.charAt(i));
        }
    }

    receiveChar(char) {
        if (this.current === this.WAITING_STATUS_LINE) {
            if (char === '\r') {
                this.current = this.WAITING_STATUS_LINE_END
            } else {
                this.statusLine += char;
            }
        } else if (this.current === this.WAITING_STATUS_LINE_END) {
            if (char === '\n') {
                this.current = this.WAITING_HEADER_NAME;
            }
        } else if (this.current === this.WAITING_HEADER_NAME) {
            if (char === ':') {
                this.current = this.WAITING_HEADER_SPACE;
            } else if (char === '\r') {
                this.current = this.WAITING_HEADER_BLOCK_END;
                if (this.headers['Transfer-Encoding'] === 'chunked') {
                    this.bodyParser = new TrunkedBodyParser();
                } else {
                    this.headerName += char;
                }
            } else if (this.current === this.WAITING_HEADER_SPACE) {
                if (char === '') {
                    this.current = this.WAITING_HEADER_VALUE;
                }
            } else if (this.current === this.WAITING_HEADER_VALUE) {
                if (char === '\r') {
                    this.current = this.WAITING_HEADER_LINE_END;
                    this.headers[this.headerName] = this.headerValue;
                    this.headerName = "";
                    this.headerValue = "";
                } else {
                    this.headerValue += char;
                }
            } else if (this.current === this.WAITING_HEADER_LINE_END) {
                if (char === '\r') {
                    this.current = this.WAITING_HEADER_NAME;
                }
            } else if (this.current === this.WAITING_HEADER_BLOCK_END) {
                if (char === '\n') {
                    this.current = this.WAITING_BODY;
                }
            } else if (this.current === this.WAITING_BODY) {
                this.bodyParser.receiveChar(char);
            }
        }
    }

}


class TrunkedBodyParser {
    // 根据报文格式设计各个状态
    constructor() {
        this.WAITING_LENGTH = 0;
        this.WAITING_LENGTH_LINE_END = 1;
        this.READING_TRUNK = 2;
        this.WAITING_NEW_LINE = 3;
        this.WAITING_NEW_LINE_END = 4;
        this.length = 0; // 计数器
        this.content = [];
        this.isFinished = false; // 是否结束处理
        this.current = this.WAITING_LENGTH;
    }

    // 处理接受到的char
    receiveChar(char) {
        // console.log(JSON.stringify(char));
        if (this.current === this.WAITING_LENGTH) {
            if (char === '\r') {
                if (this.length === 0) {
                    this.isFinished = true;
                } else {
                    this.current = this.WAITING_LENGTH_LINE_END;
                }
            } else {
                // 计算length
                this.length *= 16;
                this.length += parseInt(char, 16);
            }
        } else if (this.current === this.WAITING_LENGTH_LINE_END) {
            // console.log("WAITING_LENGTH_LINE_END");
            if (char === '\n') {
                this.current = this.READING_TRUNK;
            }
        } else if (this.current === this.READING_TRUNK) {
            this.content.push(char);
            this.length--;
            if (this.length === 0) {
                this.current = this.WAITING_NEW_LINE;
            }
        } else if (this.current === this.WAITING_NEW_LINE) {
            if (char === '\r') {
                this.current = this.WAITING_NEW_LINE_END;
            }
        } else if (this.current === this.WAITING_NEW_LINE_END) {
            if (char === '\n') {
                // 最后回到第一个状态, 进行循环处理
                this.current = this.WAITING_LENGTH;
            }
        }
    }
}

void async function() {
    let request = new Request({
        method: "POST",
        host: "127.0.0.1",
        port: "8088",
        path: "/",
        headers: {
            ["X-Foo2"]: "customed"
        },
        body: {
            name: "winter"
        }
    });

    let response = await Request.send();
    let dom = parser.parseHTML(response.body);

    console.log(dom);
}();

/*
const client = net.createConnection({
    host: '127.0.0.1',
    port: 8088
}, () => {
    // 'connect' listener.
    console.log('connected to server!');
    // console.log(request.toString());
    client.write("POST / HTTP/1.1\r\nContent-Type: application/x-www-form-urlencoded Content-Length: 11\r\n\r\nname=winter")
        // client.write('POST / HTTP/1.1\r\n');
        // client.write('Host: 127.0.0.1\r\n');
        // client.write('Content-Type: application/x-www-form-urlencoded\r\n');
        // client.write('\r\n');
        // client.write('filed1=aaa&code=x%3D1\r\n');
});
client.on('data', (data) => {
    console.log(data.toString());
    client.end();
});
client.on('end', () => {
    console.log('disconnected from server');
});
client.on('error', (err) => {
    console.log('error', err);
    client.end();
});
*/