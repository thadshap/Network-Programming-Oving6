const http = require('http');
const crypto = require("crypto");
const client = require('./client');

const server = http.createServer(client.requestListener);

const port = 3001;
server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
server.on('upgrade', (req, socket) => {
    if (req.headers['upgrade'] !== 'websocket') {
        socket.end('HTTP/1.1 400 Bad Request');
        return;
    }
    // Read the websocket key provided by the client:
    const acceptKey = req.headers['sec-websocket-key'];
    // Generate the response value to use in the response:
    console.log("første")
    const hash = generateAcceptValue(acceptKey);
    console.log("andre")
    // Write the HTTP response into an array of response lines:
    const responseHeaders = [ 'HTTP/1.1 101 Web Socket Protocol Handshake', 'Upgrade: WebSocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${hash}` ];
    console.log("tredje")
    // Read the sub-protocol from the client request headers:
    const protocol = req.headers['sec-websocket-protocol'];
    console.log("femte")
    // If provided, they'll be formatted as a comma-delimited string of protocol
    // names that the client supports; we'll need to parse the header value, if
    // provided, and see what options the client is offering:
    const protocols = !protocol ? [] : protocol.split(',').map(s => s.trim());
    console.log("sjette")
    // To keep it simple, we'll just see if JSON was an option, and if so, include
    // it in the HTTP response:
    if (protocols.includes('json')) {
        // Tell the client that we agree to communicate with JSON data
        responseHeaders.push(`Sec-WebSocket-Protocol: json`);
        console.log("syvende")
    }
    // Write the response back to the client socket, being sure to append two
    // additional newlines so that the browser recognises the end of the response
    // header and doesn't continue to wait for more header data:
    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
    const buffer = constructReply('response')
    socket.write(buffer)
    console.log("åttende")
});

socket.on('data', buffer => {
    const message = parseMessage(buffer);
    if (message) {
        // For our convenience, so we can see what the client sent
        console.log(message);
        // We'll just send a hardcoded message in this example
        socket.write(constructReply({ message: 'Hello from the server!' }));
    } else if (message === null) {
        console.log('WebSocket connection closed by the client.');
    }
});
function constructReply(data) {
    // TODO: Construct a WebSocket frame Node.js socket buffer
}
function parseMessage(buffer) {
    // TODO: Parse the WebSocket frame from the Node.js socket buffer
}

// Don't forget the hashing function described earlier:
function generateAcceptValue (acceptKey) {
    return crypto
        .createHash('sha1')
        .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');
}

function constructReply(data) {
    // Retrieving the byte-length of data
    const byteLength = Buffer.byteLength(data);
    // Note: byte-length > 65535 are not supported (by me)
    // Explanation:
    // condition jsonByteLength < 126
    // if true: lengthByteCount = 0
    // if false: lengthByteCount = 2
    const lengthByteCount = byteLength < 126 ? 0 : 2;

    // Explanation:
    // condition lengthByteCount === 0
    // if true: lengthByteCount = jsonByteLength
    // if false: lengthByteCount = 126
    const payloadLength = lengthByteCount === 0 ? byteLength : 126;

    // We must allocate enough space in our buffer for payload, payload length AND
    // the two first bytes w/ FIN-bit, RSV's, MASK-bit etc.
    const buffer = Buffer.alloc(2 + lengthByteCount + byteLength);

    // Write out the first byte, using opcode `1` to indicate
    // that the message frame payload contains text data
    buffer.writeUInt8(0b10000001, 0); // 0b = binary; FIN-bit = 1; OPCODE = 1

    // Write the length of the JSON payload to the second byte
    buffer.writeUInt8(payloadLength, 1);

    let payloadOffset = 2;
    if (lengthByteCount > 0) {
        buffer.writeUInt16BE(byteLength, 2); payloadOffset += lengthByteCount;
    }
    // Write the JSON data to the data buffer
    buffer.write(data, payloadOffset);
    return buffer;
}