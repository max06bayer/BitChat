import socket
import requests
import json
import time
from threading import Thread
import hashlib
import os
import random

class Node:
    def __init__(self, port:int, bootstrapNodes:list):
        # initialize the network
        self.publicIP = requests.get('https://api.ipify.org').content.decode('utf8')
        if self.publicIP in bootstrapNodes: bootstrapNodes.remove(self.publicIP)
        self.localIP = self.get_local_ip()
        self.port = port

        # initialize the Storage
        self.DHT = [[] for bucket in range(160)]
        self.CID = hashlib.sha1(os.urandom(20)).hexdigest()
        self.bootstrapIPs = bootstrapNodes

        # run server & bootstrapping in parallel
        Thread(target=self.receiveData).start()
        Thread(target=self.bootstrap).start()

    def bootstrap(self):
        # Fill up the DHT with the bootstrap nodes
        for node in self.bootstrapIPs:
            self.send_data(node, {'nodeInfoRequest': (self.publicIP, self.CID)})

        bucketTargets = []
        for i in range(160):
            targetCID = self.generateTargetCID(i)
            bucketTargets.append(targetCID)

        # print(bucketTargets)
            
        # TODO: Implement whole Bootstrap process

    def get_local_ip(self):
        server = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        server.connect(('8.8.8.8', 80)); local_ip = server.getsockname()[0];
        server.close(); return local_ip
    
    def get_bucket_index(self, otherCid: str):
        # Finds in which bucket the other_cid belongs
        hash_0 = int(self.CID, base=16)
        hash_1 = int(otherCid, base=16)
        distance = hash_0 ^ hash_1
        return distance.bit_length() - 1

    def add_node(self, ip: str, cid: str):
        # Adds the node to the DHT
        dht_index = self.get_bucket_index(cid)
        self.DHT[dht_index].append({cid:ip})

    def receiveData(self):
        # Start the server
        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        listener.bind((self.localIP, self.port)); listener.listen(5)
        print(f"Started FileSytem Node on IP: {self.publicIP}, PORT: {self.port}, CID: {self.CID}")

        while True:
            clientSocket, clientAddress = listener.accept()
            data = json.loads(clientSocket.recv(1024).decode("utf-8"))
            # Handle the incoming data

            if 'nodeInfoRequest' in data:
                self.add_node(data['nodeInfoRequest'][0], data['nodeInfoRequest'][1])
                self.send_data(data['nodeInfoRequest'][0], {'nodeInfoResponse': (self.publicIP, self.CID)})

            elif 'nodeInfoResponse' in data:
                self.add_node(data['nodeInfoResponse'][0], data['nodeInfoResponse'][1])

    def send_data(self, ip:str, data:dict):
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect((ip, self.port))
        data = json.dumps(data, indent = 4)
        client.send(data.encode("utf-8"))
        client.close()

    def generateTargetCID(self, bucketDistance: int) -> str:
        myCidInt = int(self.CID, 16)
        lowerBound = 2 ** bucketDistance
        upperBound = 2 ** (bucketDistance + 1) - 1
        distance = random.randint(lowerBound, upperBound)
        targetInt = myCidInt ^ distance
        return format(targetInt, '040x')

    
myNode = Node(port=60000, bootstrapNodes=['79.230.223.138']);
while True: 
    time.sleep(5)
    print(myNode.DHT, end="\n")