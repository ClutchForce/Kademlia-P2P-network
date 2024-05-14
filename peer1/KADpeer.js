//KADpeer.js
const net = require("net");
const singleton = require("./Singleton");
const ptp = require("./kadPTP");
const os = require("os");
const { parse } = require("path");
const { send } = require("process");

singleton.init();

// Retrieve the peer's name from the directory name
const path = __dirname.split("/");
const myName = path[path.length - 1];

// Find the local IPv4 address (localhost)
const ifaces = os.networkInterfaces();
let HOST = "";
Object.keys(ifaces).forEach((ifname) => {
  ifaces[ifname].forEach((iface) => {
    if ("IPv4" == iface.family && iface.internal !== false) {
      HOST = iface.address;
    }
  });
});


const PORT = singleton.getPort();
const serverID = singleton.getPeerID(HOST, PORT);


const args = process.argv.slice(2);
const peerNameIndex = args.indexOf("-n") + 1;
const peerAddressIndex = args.indexOf("-p") + 1;

const K_VALUE = 1; // Assuming a k-value of 1 for this assignment

// peer format
// {
//   peerName: peer's name (folder name)  
//   peerIP: peer ip address,
//   peerPort: peer port number,
//   peerID: the node DHT ID
// }
//
// DHT format
// {
//   owner: a peer
//   table: array of k_buckets  
// }
//
// k-bucket format (it is one object because k=1 in this assignment)
// {
//  prefix: i, (the maximum number of the leftmost bits shared between the owner of the DHTtable and the node below)
//  node: peer
// }

if (peerNameIndex > 0) {
  const peerName = args[peerNameIndex];

  if (peerAddressIndex > 0) {
    const [knownHost, knownPort] = args[peerAddressIndex].split(":");

    initializeClient(knownHost, knownPort, peerName, singleton.getPeerID(knownHost, knownPort));


  } else {
    initializeServer(HOST, PORT, peerName, serverID);
  }
} else {
  console.error("Usage: node KADpeer -n <peerName> [-p <peerIP>:<port>]");
  process.exit(1);
}

//initializeServer function
function initializeServer(host, port, peerName, peerID) {

  //initialize the server peer and DHT
  let serverPeer = {
    peerName: peerName,
    peerIP: host,
    peerPort: port,
    peerID: peerID
  };
  let serverDHT = {
    owner: serverPeer,
    table: []
  };

  const server = net.createServer();

  server.on('connection', (socket) => {
    handleClientJoining(socket, serverDHT);
  });

  server.listen(port, host, () => {
    console.log(`This peer address is ${HOST}:${PORT} located at ${peerName} [${serverID}]`);
  });

  server.on('error', (err) => {
    console.error('Socket error', err);
  });

}

//initializeClient function
function initializeClient(host, port, peerName, peerID) {

  //initialize the client peer and DHT
  let clientPeer;
  let clientDHT;

  let client = new net.Socket();

  //connect to the server
  client.connect(port, host, () => {
    const timestamp = singleton.getTimestamp();
    console.log(`Connected to ${myName}:${port} at timestamp: ${timestamp}`);
    host = client.localAddress;
    port = client.localPort;
    peerID = singleton.getPeerID(host, port);
    console.log(`\nThis peer is ${host}:${port} located at ${peerName} [${peerID}]`);
    clientPeer = {
      peerName: peerName,
      peerIP: host,
      peerPort: port,
      peerID: peerID
    };
    clientDHT = {
      owner: clientPeer,
      table: []
    };
    handleCommunication(client, clientDHT);
  });


}

//handlecommunicaion function
function handleCommunication(client, clientDHT) {
  // handle incoming data

  let senderPeerID = singleton.getPeerID(client.remoteAddress, client.remotePort);
  let senderPeerIDlocal = singleton.getPeerID(client.localAddress, client.localPort);


  client.on('data', (data) => {
    let packetObj = handlePacket(data);



    let senderName = packetObj.senderName.split(':')[0];
    //console.log(`\nReceived packet from `, senderName);
    // let senderPeer = {
    //   peerName: 'peer',
    //   peerIP: '127.0.0.1',
    //   peerPort: senderName,
    //   peerID: senderPeerIDlocal
    // };
    let senderPeer = {
      peerName: senderName,
      peerIP: client.remoteAddress,
      peerPort: client.remotePort,
      peerID: senderPeerID
    };

    if (packetObj.msgType == 1) {

      //Run server
      let clientRecivingPort = client.localPort;
      let clientRecivingIP = client.localAddress;
      let serverPeer = net.createServer();
      serverPeer.listen(clientRecivingPort, clientRecivingIP);

      //Wait for other clients/peers to connect
      serverPeer.on('connection', (socket) => {
        handleClientJoining(socket, clientDHT);
      });

      // Extract peer info and update DHT 
      console.log(`\nReceived Welcome Message from ${senderName} ${senderPeer.peerID} along with DHT`);
      //printDHT(clientDHT);
      if (packetObj.peers.length > 0) {
        packetObj.peers.forEach(peer => {
          console.log(`[${peer.peerIP}:${peer.peerPort}, ${peer.peerID}]`);
        });
      }
      else {
        console.log("[]");
      }


      //Add welcome node into DHT if its not already existant 
      let existant = clientDHT.table.find(n => n.node.peerPort == client.remotePort);
      //let existant = clientDHT.table.find(n => n.node.peerPort == client.remotePort + 1);

      if (!existant) {
        pushBucket(clientDHT, senderPeer);
      }
      else {
        console.log(senderPeer.peerPort, " already exists.");
      }

      refreshDHT(clientDHT, packetObj.peers);

    }
    else {
      console.log("Invalid message type.");
    }

  });


  // handle connection end
  client.on('end', () => {
    //send hello message
    sendHello(clientDHT);
  });
}

//handleClientJoining function 
function handleClientJoining(socket, serverDHT) {

  packetObj = null;

  //PROMPT:
  //This is where the problem lies when we send a hello message it comes from NOT the correct port because its establishing a new connection thus creathing a new port which messess up the NewPeer initialization 
  //This makes it impossible to add the peer to that is sending the hello message and instead adds a random one.
  //We need to figure out how to get the correct peer information from the hello message and add it to the DHT

  //console.log(`\n Handling client joinning from  ${socket.remoteAddress}:${socket.remotePort}`);

  // Extract joining peer information from socket
  // init client DHT table
  let NewPeer = {
    peerName: "", // Name will be assigned later
    peerIP: socket.remoteAddress,
    peerPort: socket.remotePort, // Adjusted to match the client port number
    peerID: singleton.getPeerID(socket.remoteAddress, socket.remotePort)
  };
      //console.log(`\nReceived packet from `, senderName);
    // let senderPeer = {
    //   peerName: 'peer',
    //   peerIP: '127.0.0.1',
    //   peerPort: senderName,
    //   peerID: senderPeerIDlocal
    // };

  socket.on('data', (data) => {
    packetObj = handlePacket(data);
  });

  socket.on('end', () => {
    //client ended connection
    //TODO sometimes does not print that it revieved a hello message FIXXXXXEDDDDDD

    if (packetObj) {
      // Extract peer info and update DHT from hello message
      if (packetObj.msgType == 2) {


        //find the object in packetObj.peers that has the same peerName as the packetObj.senderName
        //let senderPeerID = packetObj.owner.peerID;//packetObj.peers.find(n => n.peerName == packetObj.senderName).peerID;
        //should be the ID of the sender currently id of the reciver
        //senderPeerID --> should be the ID of the sender currently id of the reciver
        //------
        //console.log(`\nReceived Hello Message from PORT ${packetObj.senderName} `);
        //senderName is [string]:[number] so we need to split it
        let senderNameeee = packetObj.senderName.split(':');
        let AHHHHHNAME = senderNameeee[0];
        let AHHHHPORT = senderNameeee[1];
        //console.log(`\nAHHHHHH ${senderName[0]} ${senderName[1]}`);

        //------
        NewPeer.peerName = AHHHHHNAME;
        NewPeer.peerPort = AHHHHPORT;
        NewPeer.peerID = singleton.getPeerID(socket.remoteAddress, AHHHHPORT);

        console.log(`Received Hello Message from ${NewPeer.peerName} ${NewPeer.peerID} along with DHT`);
        //printDHT(serverDHT);
        if (packetObj.peers.length > 0) {
          
          packetObj.peers.forEach(peer => {
            console.log(`[${peer.peerIP}:${peer.peerPort}, ${peer.peerID}]`);
          });
        }




        let EXISTsenderPeer = serverDHT.table.find(n => n.node.peerPort == NewPeer.peerPort);

        //Add sender node into DHT if its not already existant 
        if (EXISTsenderPeer) {
          EXISTsenderPeer.node.peerName = NewPeer.peerName;
          //console.log(`\n${NewPeer.peerName} ${NewPeer.peerID} already exists.`);
          pushBucket(serverDHT, NewPeer);

        }
        else {
          //Sometimes does not print like its supposed to for console.log(`\nBucket P${i} is full, checking if we need to change the stored value`);
          pushBucket(serverDHT, NewPeer);
        }

                //Update DHT with the peers from the hello message

        refreshDHT(serverDHT, packetObj.peers);

      }

      else {
        console.log("Invalid message type.");
      }

    }
    else {
      // This was a welcome message
      console.log(`\nConnected from peer ${socket.remoteAddress}:${socket.remotePort}`);
      // add the peer to the server DHT
      pushBucket(serverDHT, NewPeer);
      console.log("\nMy DHT:");
      printMyDHT(serverDHT);
    }

  });

  // Send welcome message to the joining peer
  if (packetObj == null) {

    // Construct welcome message
    const welcomeMessage = {
      version: 9, // protocol version is 9
      messageType: 1, // 1 for welcome message
      DHT: serverDHT
    };

    let wpkt = ptp; //idk why I did this

    // Send welcome message packet (hours wasted here: 3h)
    wpkt.init(welcomeMessage.version, welcomeMessage.messageType, welcomeMessage.DHT);
    try {
      socket.write(wpkt.getBytePacket());
    }
    catch (e) {
      console.log("Probably an error with buffer conversion--> ", e);
    }
    socket.end();
  }
}

//pushBucket function only two arguments DHT and a peers information
function pushBucket(T, P) {
  //NEED TO CAP IT AT 32 BUCKETS

  if (T.owner.peerID !== P.peerID) {
    //add a condition that discards the packet if the port is +- 1 of the other port

    const localIDBin = singleton.Hex2Bin(T.owner.peerID);
    const peerIDBin = singleton.Hex2Bin(P.peerID);
    const localID = T.owner.peerID;
    const peerID = P.peerID;

    //Calculate how many left most bits the two IDs share
    let i = 0;

    for (i = 0; i < localIDBin.length; i++) {
      if (localIDBin[i] != peerIDBin[i]) {
        break;
      }
    }

    let newBucket = {
      prefix: i,
      node: P
    };

    // Find or create the k-bucket for this prefix
    let existingBucket = T.table.find(bucket => bucket.prefix === i);
    if (!existingBucket) {
      console.log(`\nBucket P${i} has no value, adding ${peerID}`);
      T.table.push(newBucket);
    } else {
      console.log(`\nBucket P${i} is full, checking if we need to change the stored value`);
      // Calculate distances using XOR metric
      let newDistance = singleton.XORing(localIDBin, peerIDBin);
      let existingDistance = singleton.XORing(localIDBin, singleton.Hex2Bin(existingBucket.node.peerID));

      // Compare distances to decide whether to replace the existing peer
      if (newDistance < existingDistance) {
        console.log(`Update needed, removing peer ${existingBucket.node.peerID}, and adding peer ${P.peerID}`);
        T.table = T.table.filter(bucket => bucket.node.peerID !== existingBucket.node.peerID);
        T.table.push(newBucket);
      } else {
        console.log(`Current value is closest, no update needed`);
      }
    }
  } else {
    //console.log("Attempted to add the local peer to its own DHT. Operation skipped.");
  }

  // Debug: Print the updated DHT for debugging
  //console.log("\nUpdated DHT: ", JSON.stringify(T, null, 2));
}




//handlePacket function
function handlePacket(packet) {
  let pasredPacket = {};

  let version = parseBitPacket(packet, 0, 4);
  if (version !== 9) {
    console.error("Invalid version number");
    return null;
  }
  let msgType = parseBitPacket(packet, 4, 7);
  let numPeers = parseBitPacket(packet, 11, 9);
  let senderNameLength = parseBitPacket(packet, 20, 12);
  let senderName = bytes2string(packet.slice(4, 4 + senderNameLength)); // Adjusted to slice correctly

  let offset = 32 + (senderNameLength * 8); // Correct starting offset after sender name
  let peers = [];
  if (numPeers > 0) {
    for (let i = 0; i < numPeers; i++) {
      // Adjust to start at correct offset for peer information
      let baseOffset = offset + (i * 64); // 64 bits per peer
      let ip0 = parseBitPacket(packet, baseOffset, 8);
      let ip8 = parseBitPacket(packet, baseOffset + 8, 8);
      let ip16 = parseBitPacket(packet, baseOffset + 16, 8);
      let ip24 = parseBitPacket(packet, baseOffset + 24, 8);
      let peerPort = parseBitPacket(packet, baseOffset + 32, 16);
      if (peerPort == 0) {
        console.log("Invalid port number of 0. Packet dropped.");
        return null;
      }

      let AHHHHHHHHHHHHHHHHHHH = senderName.split(':');

      peers.push({
        peerName: senderName,
        peerIP: `${ip0}.${ip8}.${ip16}.${ip24}`,
        peerPort: peerPort,
        peerID: singleton.getPeerID(`${ip0}.${ip8}.${ip16}.${ip24}`, peerPort)
      });
      // peers.push({
      //   peerName: AHHHHHHHHHHHHHHHHHHH[0],
      //   peerIP: `${ip0}.${ip8}.${ip16}.${ip24}`,
      //   peerPort: AHHHHHHHHHHHHHHHHHHH[1],
      //   peerID: singleton.getPeerID(`${ip0}.${ip8}.${ip16}.${ip24}`, AHHHHHHHHHHHHHHHHHHH[1])
      // });
    }
  }

  pasredPacket = {
    version: version,
    msgType: msgType,
    senderName: senderName,
    numPeers: numPeers,
    peers: peers
  };




  return pasredPacket;

}

//refreshDHT function only two arguments DHT and a list of peers information
function refreshDHT(DHT, peers) {
  refreshBucket(DHT, peers);
  if (DHT.table.length > 0) {
    console.log("\nMy DHT: ");
    printMyDHT(DHT);

  }
}

//refreshBucket function only two arguments DHT and a list of peers information
function refreshBucket(DHT, peers) {
  peers.forEach(peer => {
    pushBucket(DHT, peer);
  });
  console.log("\nRefresh k-Bucket operation is performed");
 
}
//---------------------------------------------------------------
//The failed attempt sendHello graveyard hours wasted here = >13h 
// Its crazy the i have spent 13 hours on this and still have not gotten it to work i just made a work around that seem to work properly
//---------------------------------------------------------------

// this one works but it does not send the hello message from the correct port making it imposible to know where it came from and create a proper new/joinning peer object
// this is the closest we have gotten to a working sendHello function
//sendHello function one agument DHT
function sendHello(T) {
  setTimeout(() => {
    T.table.forEach((bucket) => {
      // Assuming each bucket directly contains a node object representing the peer
      const peer = bucket.node;
      if (peer) { // Check if the bucket's node is valid
        let sock = new net.Socket();

        // Connect to the peer specified in the bucket
        sock.connect({
          port: peer.peerPort, host: peer.peerIP,
          //This breaks the code
          //localPort: T.owner.peerPort
        }, () => {
          // Prepare the hello message
          const helloMessage = {
            version: 9, // Assuming protocol version is 9
            messageType: 2, // 2 for hello message
            DHT: T // Pass the entire DHT for context
          };

          // Initialize the packet with the hello message
          ptp.init(helloMessage.version, helloMessage.messageType, helloMessage.DHT);

          // Send the packet
          sock.write(ptp.getBytePacket());
          //console.log("Hello packet has been sent to", peer.peerIP + ":" + peer.peerPort);

          // Close the socket after a short delay to ensure message is sent
          setTimeout(() => {
            sock.end();
            sock.destroy();
          }, 500);
        });

        // Optional: handle socket errors
        sock.on('error', (err) => {
          //console.error(`Error on socket sending hello message to ${peer.peerIP}:${peer.peerPort} localPort: ${T.owner.peerPort}`, err.message);
        });

        // Optional: Confirmation of socket closure
        sock.on('close', () => {
          //console.log(`Connection to ${peer.peerIP}:${peer.peerPort} closed.`);
        });
      }
    });
    console.log("Hello packet has been sent");
  }, 1000);
}


// //Use a Fixed Local Port SOLUTION this one looked promising but it did not work 

// const HELLO_PORT = 55555; // Example fixed port for sending hello messages

// // Function to send a hello message to a specific peer
// function sendHelloMessage(peer, DHT, attempt = 0) {
//   const maxAttempts = 5;
  
//   let sock = new net.Socket();

//   sock.on('error', (err) => {
//     console.log(`Attempt ${attempt}: Error sending hello message to ${peer.peerIP}:${peer.peerPort}`, err.message);
//     sock.destroy();
    
//     // Retry with a new socket if under max attempts, without binding to HELLO_PORT
//     if (attempt < maxAttempts) {
//       console.log(`Retrying without binding to specific port...`);
//       sendHelloMessage(peer, DHT, attempt + 1);
//     }
//   });

//   sock.connect({port: peer.peerPort, host: peer.peerIP, localPort: attempt === 0 ? HELLO_PORT : 0}, () => {
//     const helloMessage = {
//       version: 9,
//       messageType: 2,
//       DHT: DHT
//     };

//     ptp.init(helloMessage.version, helloMessage.messageType, helloMessage.DHT);
//     sock.write(ptp.getBytePacket());
//     console.log(`Hello message sent to ${peer.peerIP}:${peer.peerPort} from ${sock.localPort}`);
    
//     setTimeout(() => {
//       sock.end();
//     }, 500);
//   });
// }

// Revised sendHello function that iterates over all peers in the DHT
// function sendHello(DHT) {
//   DHT.table.forEach(bucket => {
//     const peer = bucket.node;
//     if (peer) {
//       sendHelloMessage(peer, DHT);
//     }
//   });
// }

// This one works properly sometimes both other times it timesout and does not send the hello message
// The method scans the k-buckets of T and send hello message packet to every peer P in T, one at a time.
// function sendHello(T) {
//   let i = 0;
//   // we use echoPeer method to do recursive method calls
//   echoPeer(T, i);
// }

// // This method call itself (T.table.length) number of times,
// // each time it sends hello messags to all peers in T
// function echoPeer(T, i) {
//   setTimeout(() => {
//     let sock = new net.Socket();
//     sock.connect(
//       {
//         port: T.table[i].node.peerPort,
//         host: T.table[i].node.peerIP,
//         localPort: T.owner.peerPort
//       },
//       () => {
//         // send Hello packet
//         ptp.init(9, 2, T);
//         sock.write(ptp.getBytePacket());
//         setTimeout(() => {
//           sock.end();
//           sock.destroy();
//         }, 5000)
//       }
//     );
//     sock.on('close', () => {
//       i++;
//       if (i < T.table.length) {
//         echoPeer(T, i)
//       }
//     })
//     if (i == T.table.length - 1) {
//       console.log("Hello packet has been sent.\n");
//     }
//   }, 5000)
// }

//The last attempt at sendHello this will just send a hello message over and over again to everything 
// function sendHello(T) {
//   T.table.forEach((bucket, index) => {
//       sendHelloToPeer(T, bucket.node, 0); // Start with 0 retries
//   });
// }

// function sendHelloToPeer(T, peer, retryCount) {
//   const maxRetries = 5;
//   const retryInterval = 1000; // Start with 1 second

//   let sock = new net.Socket();
//   sock.setTimeout(5000); // Set a reasonable timeout for the connection

//   sock.on('timeout', () => {
//       console.error(`Connection to ${peer.peerIP}:${peer.peerPort} timed out.`);
//       sock.destroy();
//       if (retryCount < maxRetries) {
//           console.log(`Retrying... Attempt ${retryCount + 1}`);
//           setTimeout(() => {
//               sendHelloToPeer(T, peer, retryCount + 1);
//           }, retryInterval * Math.pow(2, retryCount)); // Exponential backoff
//       }
//   });

//   sock.connect(peer.peerPort, peer.peerIP, () => {
//       const helloMessage = {
//           version: 9,
//           messageType: 2,
//           DHT: T,
//       };

//       ptp.init(helloMessage.version, helloMessage.messageType, helloMessage.DHT);
//       sock.write(ptp.getBytePacket());
//       console.log("Hello packet sent to", peer.peerIP + ":" + peer.peerPort);
//       sock.end();
//   });

//   sock.on('error', (err) => {
//       console.error(`Connection error to ${peer.peerIP}:${peer.peerPort}:`, err);
//   });
// }



//prints my DHT table
function printMyDHT(DHT) {
  if (DHT.table.length == 0) {
    console.log("[]");
  }
  else {
    DHT.table.forEach((bucket) => {
      if (bucket) {
        console.log(`[P${bucket.prefix}, ${bucket.node.peerIP}:${bucket.node.peerPort}, ${bucket.node.peerID}]`);
      }
    });
    console.log("");
  }
}

// return integer value of a subset bits
function parseBitPacket(packet, offset, length) {
  let number = "";
  for (var i = 0; i < length; i++) {
    // let us get the actual byte position of the offset
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) % 2;
    number = (number << 1) | bit;
  }
  return number;
}


// Convert byte array to string
function bytes2string(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    try {
      if (array[i] > 0) result += String.fromCharCode(array[i]);
    }
    catch (e) {
      console.log("bytes2string error --> ", e);
    }
  }
  return result;
}
