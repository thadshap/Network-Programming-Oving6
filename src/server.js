const crypto = require("crypto");
const net = require("net");
const fs = require('fs');
var clients = [];

const chatHTML = 'index.html';

const HTTPPORT  = 3001;
const WSPORT = 3000;

// Simple HTTP server responds with a simple WebSocket client test
const httpServer = net.createServer((connection) => {
    connection.on('data', () => {
        try{
            fs.readFile(chatHTML, (err, data) => {
                if(err){
                    console.log("Error during reading");
                }
                connection.write('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: ' + data.length + '\r\n\r\n' + data);

            });
        }catch(error){
            console.log("Couldn't open HTML file");
        }
    });
});

httpServer.listen(HTTPPORT, () => {
    console.log("HTTP server listening on port: " + HTTPPORT);
});

httpServer.on("error", (error) =>{
    console.log(error);
});

const wsServer = net.createServer((connection) => {
    connection.on('data', (data) => {
        let string = data.toString();
    if ((/GET \/ HTTP\//i).test(string)) {
            if(!checkHeaderFields(string)){
                connection.write("HTTP/1.1 400 Bad Request\r\n");
                console.log(string);
                connection.end();
            }
        // Reads key from  client's GET-request
        let key = getHeaderValue(data, 'Sec-WebSocket-Key');
        // Creates acceptKey
        let acceptKey = generateAcceptValue(key);

        // Writes answer with acceptKey to client
        connection.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n`+
            `Connection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey}\r\n\r\n`);
        // Adds client to an array of clients/sockets
        clients.push(connection);
    }
    else{
        //Checks opcode for connection closing
        if((data[0] & 0b1111) === 0x8) {
            connection.end();
            return;
        }
        // Client message
        let message = parseMessage(data);
        console.log(message);
        // Finds client index and creates a response
        let response = "";
        if((/chat/).test(chatHTML)){
            for(let i = 0; i < clients.length; i++){
                if(clients[i] === connection){
                    response = `Client ${i+1}: ${message}`;
                }
            }
        }
        else response = message;

        let buf = constructReply(response);

        for(socket of clients){
            if(socket) socket.write(buf);
        }
    }
    });
    connection.on('end', () => {
        for(let i = 0; i < clients.length; i++){
            if(clients[i] === connection){
                clients.splice(i);
            }
        }
        console.log("Client disconnected");
    });
});

wsServer.on('error', (error) => {
    console.error('Error: ', error);
    if (error.code === 'EADDRINUSE') {
        console.log('Address in use, retrying...');
        setTimeout(function () {
            wsServer.close();
            wsServer.listen(3000, "localhost");
        }, 1000);
    }
});

wsServer.on("close", () => {
    console.log('Client disconnected');
});

wsServer.listen(WSPORT, () => {
    console.log('Websocket server listening on port: ', WSPORT);
});

function parseMessage(data) {
    let masked = data[1]>>7 === 1;
    let length, maskStart;

    length = data[1] & 0b1111111;

    maskStart = 2;

    if(length === 126){
        length = ((data[2] << 8)| data[3]);

        maskStart = 4;
    }
    else if(length === 127){
        length = data[2];
        for(let i = 3; i<10;i++){
            length = (length << 8)|data[i];
        }

        maskStart = 10;
    }
    let result = "";
    if(masked){
        let dataStart = maskStart + 4;
        for(let i = dataStart; i< dataStart+length; i++){
            let byte = data[i] ^ data[maskStart + ((i - dataStart) % 4)]
            result += String.fromCharCode(byte);
        }
    }else{
        for(let i = maskStart; i<maskStart+length; i++){
            result += String.fromCharCode(data[i]);
        }
    }

    return result;
}

/**
 * Method decodes the frames sent by the client
 * %x1 = text frame
 * %x8 = closing connection
 * This server will only deal with text, and closing connection,
 * although binary frames (%x2) would be a good implementation for
 * images, audio and such (bit-stream)
 *
 * @param text consist of the (encoded) frames sent from the client
 * @return null if connection termination frame, and a decoded message if text frame
 */
function constructReply(text) {
    let textByteLength = Buffer.from(text).length;

    let secondByte, buffer1;
    if(textByteLength < 126){
        secondByte = textByteLength;
        buffer1 = Buffer.from([0b10000001, secondByte]);
    }
    else if(textByteLength > 125 && textByteLength < 65535){
        secondByte = 126;
        buffer1 = Buffer.alloc(4);
        buffer1.writeUInt8(0b10000001,0)
        buffer1.writeUInt8(secondByte,1);
        buffer1.writeUInt16BE(textByteLength,2);
    }
    else {
        throw Error("Message was too long");
    }

    const buffer2 = Buffer.from(text);

    const buffer = Buffer.concat([buffer1,buffer2]);
    return buffer;
}

// Don't forget the hashing function described earlier:
function generateAcceptValue (acceptKey) {
    return crypto
        .createHash('sha1')
        .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');
}

function checkHeaderFields(headers){
    let connectionReg = /Connection:.+Upgrade.*?\s/i
    let hostReg = /Host:/i
    let upgradeReg = /Upgrade:.+websocket.*?\s/i
    let keyReg = /Sec-WebSocket-Key:/i
    let versionReg = /Sec-WebSocket-Version: 13\s/i
    if(connectionReg.test(headers) && hostReg.test(headers) && upgradeReg.test(headers) && keyReg.test(headers) && versionReg.test(headers))
        return true;

    return false;
}

/**
 * @param data = buffer
 * @param headerName = name to search for in header-lines
 */
function getHeaderValue(data, headerName) {
    let array = data.toString().split("\r\n");
    for (let line of array) {
        let header = line.split(":")
        if(header[0].trim() === headerName) {
            return header[1].trim(); // <-- headerValue
        }
    }
}