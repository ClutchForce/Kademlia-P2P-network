# Kademlia DHT Peer-to-Peer Network Application

This application simulates a simplified Kademlia-like distributed hash table (DHT) network. It allows each node (peer) to function both as a client and a server within a peer-to-peer (P2P) network, managing connections and data distribution among multiple peers dynamically.

## 📖 Description

KADpeer is designed to explore DHT-based P2P networking by implementing a network where nodes are both servers and clients. This setup facilitates decentralized data sharing and dynamic network topology adjustments without a central coordination point.

## ✨ Features

- **Dual Functionality**: Each peer acts as both server and client, handling incoming connections and reaching out to other peers.
- **DHT Implementation**: Utilizes a Kademlia-like DHT for efficient data location without querying all nodes.
- **Dynamic Network Growth**: Peers can join the network dynamically with automatic adjustment of the DHT.
- **Simplified Protocol**: Uses a custom peer-to-peer transport protocol (kadPTP) to handle peer communications.
- **Resilient Network Structure**: Designed to handle joins seamlessly with a protocol that ensures consistent network performance.

## 🛠 Install Guide

Ensure Node.js is installed on your system. This project requires Node.js version 20.11.0 (LTS) or higher, which can be downloaded from [Node.js official website](http://nodejs.org/).

### Dependencies Installation

Install necessary Node.js packages using npm:

```
npm install
```

This will install all required dependencies as listed in the `package.json` file.

## 🔧 Set Up and Run

### Initial Peer Setup

To start the first peer and initialize the network:

```
node KADpeer -n <peerName>
```

This command starts a peer named `<peerName>` which will form a new DHT Kademlia network.

### Joining an Existing Network

To connect a peer to an existing network:

```
node KADpeer -n <peerName> -p <peerIP>:<port>
```

Specify the IP address and port of an existing peer to connect to the network. This peer will then integrate into the network based on the DHT protocol.

## 📝 Conclusion

This project demonstrates the practical implementation of a DHT-based P2P network using Node.js, highlighting the dynamic and decentralized nature of modern networked applications. It provides a foundational structure for building more complex systems that require distributed state management and peer-to-peer communication.

### Future Work

Future enhancements can include implementing secure peer connections, handling peer departures, and optimizing the network's response to high churn rates.
