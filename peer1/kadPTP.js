//kadPTP.js
const { Buffer } = require("buffer");

module.exports = {
    HEADER_SIZE: 4, //Size of the ITP header
    responseHeader: "", //Bitstream of the ITP header
    payloadSize: 0, //size of the ITP payload
    payload: "", //Bitstream of the ITP payload
    

    init: function (
        version, // version
        msgType, // message type
        tableData, // DHT data
    ) {
        //HEADER
        let numPeers = tableData.table.length;
        //let senderName = stringToBytes(tableData.owner.peerName);

        //-----
        let sN = tableData.owner.peerName;
        let sP = tableData.owner.peerPort.toString();
        let tostr = sN + ':' + sP;
        let senderName = stringToBytes(tostr);
        //console.log("AHHHHHHHHHHHHHHH",senderName);
        //-----

        this.HEADER_SIZE = parseInt(4 + senderName.length);

        this.responseHeader = new Buffer.alloc(this.HEADER_SIZE );


        let offset = 0;
        //store the version
        storeBitPacket(this.responseHeader, version, offset, 4);
        offset += 4;
        //store the message type
        storeBitPacket(this.responseHeader, msgType, offset, 7);
        offset += 7;
        //store the number of peers
        storeBitPacket(this.responseHeader, numPeers, offset, 9);
        offset += 9;
        //store the sender name length
        storeBitPacket(this.responseHeader, senderName.length, offset, 12);
        offset += 12;
        //store the sender name
        //storeBitPacket(this.responseHeader, senderName, 32, senderName.length * 8);
        let z = 4;
        let y = 0;
        let x = 0;
        for (x = z; x < senderName.length + z; x++) {
            this.responseHeader[x] = senderName[y++];
        }

        //offset = 32 + (senderNameLength * 8);
        //PAYLOAD

        this.payloadSize = numPeers * 8;
        this.payload = new Buffer.alloc(this.payloadSize);

        if (numPeers > 0) {
            let bitOffset = x * 8;
            for (let i = 0; i < numPeers; i++) {
                let peerIP = tableData.table[i].node.peerIP;
                let peerPort = tableData.table[i].node.peerPort;

                // We need to fix this
                let ip0 = peerIP.split('.')[0];
                let ip8 = peerIP.split('.')[1];
                let ip16 = peerIP.split('.')[2];
                let ip24 = peerIP.split('.')[3];

                storeBitPacket(this.payload, ip0*1, 64*i, 8); // New peerip every 64 bits
                //WHY THE ACTUAL * DOES IT WORK WHEN I ip0*1 like istg this makes NO sense * this * everything (hours wasted here = 1.5h)
                bitOffset += 8;
                storeBitPacket(this.payload, ip8, 64*i+8, 8);
                bitOffset += 8;
                storeBitPacket(this.payload, ip16, 64*i+16, 8);
                bitOffset += 8;
                storeBitPacket(this.payload, ip24, 64*i+24, 8);
                bitOffset += 8;
                storeBitPacket(this.payload, peerPort, 64*i+32, 16); // Peerport is 4 bytes after ip
                bitOffset += 16;
                storeBitPacket(this.payload, 0, 64*i+48, 16); // Fill the remainder with 0s
                bitOffset += 16;
            }
        }







    },
    //--------------------------
    //getBytePacket: returns the entire packet in bytes
    //--------------------------
    getBytePacket: function () {
        let packet = new Buffer.alloc(this.payload.length + this.HEADER_SIZE );
        //construct the packet = header + payload
        for (var Hi = 0; Hi < this.HEADER_SIZE; Hi++)
            packet[Hi] = this.responseHeader[Hi];
        for (var Pi = 0; Pi < this.payload.length; Pi++)
            packet[Pi + this.HEADER_SIZE] = this.payload[Pi];

        return packet;
    },
};

// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
    // let us get the actual byte position of the offset
    let lastBitPosition = offset + length - 1;
    let number = value.toString(2);
    let j = number.length - 1;
    for (var i = 0; i < number.length; i++) {
        let bytePosition = Math.floor(lastBitPosition / 8);
        let bitPosition = 7 - (lastBitPosition % 8);
        if (number.charAt(j--) == "0") {
            packet[bytePosition] &= ~(1 << bitPosition);
        } else {
            packet[bytePosition] |= 1 << bitPosition;
        }
        lastBitPosition--;
    }
}

// Retrieve integer value from the packet bit stream
function stringToBytes(str) {
    var ch,
        st,
        re = [];
    for (var i = 0; i < str.length; i++) {
        ch = str.charCodeAt(i); // get char
        st = []; // set up "stack"
        do {
            st.push(ch & 0xff); // push byte to stack
            ch = ch >> 8; // shift value down by 1 byte
        } while (ch);
        // add stack contents to result
        // done because chars have "wrong" endianness
        re = re.concat(st.reverse());
    }
    // return an array of bytes
    return re;
}

