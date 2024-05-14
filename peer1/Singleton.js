//Singleton.js
let timerInterval = 10;
let timer;
const crypto = require("crypto");

function timerRun() {
    timer ++;
    if (timer == 4294967295) {
        timer = Math.floor(1000 * Math.random()); // reset timer to be within 32 bit size
    }
}

module.exports = {
    init: function() {
        timer = Math.floor(1000 * Math.random()); /* any random number */
        setInterval(timerRun, timerInterval);
    },

    //--------------------------
    //getTimestamp: return the current timer value
    //--------------------------
    getTimestamp: function() {
        return timer;
    },

    //--------------------------
    //getrandom port 65530 > x > 3000
    //--------------------------
    getPort: function() {
        //TODO DONT FORGET CHANGE THIS BACK TO 3000 to 65535
        return Math.floor(Math.random() * 62530) + 3000;
    },

    //--------------------------
    //getPeerID: takes the IP and port number and returns 20 bytes Hex number
    //--------------------------
    getPeerID: function (IP, port) {
        // Use SHA-256 for peer ID generation
        const hash = crypto.createHash('sha256');
        hash.update(`${IP}:${port}`);
        // Return first 4 bytes of SHA-256 hash as a hex string, representing the 32-bit identifier
        return hash.digest('hex').substring(0, 8);
    },

    //--------------------------
    //getKeyID: takes the key name and returns 20 bytes Hex number
    //--------------------------
    getKeyID: function (key) {
        var crypto = require('crypto')
        var sha1 = crypto.createHash('sha1')
        sha1.update(key)
        return sha1.digest('hex')
    },

    //--------------------------
    //Hex2Bin: convert Hex string into binary string
    //--------------------------
    Hex2Bin: function(hex) {
        return (parseInt(hex, 16).toString(2)).padStart(32, '0');
    },

    //--------------------------
    //XORing: finds the XOR of the two Binary Strings with the same size
    //--------------------------
    XORing: function(a, b) {
        let result = "";
        let len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            result += (a[i] === b[i]) ? "0" : "1";
        }
        return result;
    }
};
