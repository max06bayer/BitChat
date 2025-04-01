import asyncio
import requests
import json
import socket
import binascii
import os
import random

class file_system_node:
    def __init__(self, port:int, bootstrap_nodes:list):
        self.port = port
        self.local_ip = self.get_local_ip()
        self.public_ip = requests.get('https://api.ipify.org').content.decode('utf8')
        self.DHT = [[] for bucket in range(16)]
        self.CID = binascii.hexlify(os.urandom(2)).decode('utf-8') # Random 16 bit hash
        asyncio.run(self.start_node(bootstrap_nodes))

    async def start_node(self, bootstrap_nodes:list):
        server_task = asyncio.create_task(self.run_server())
        bootstrap_task = asyncio.create_task(self.bootstrap(bootstrap_nodes))
        await asyncio.gather(server_task, bootstrap_task)

    def get_local_ip(self):
        server = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        server.connect(('8.8.8.8', 80)); local_ip = server.getsockname()[0];
        server.close(); return local_ip
            
    async def run_server(self):
        print(f"Server started at {self.public_ip}:{self.port}")
        server = await asyncio.start_server(self.handle_connection, self.local_ip, self.port)
        async with server:
            await server.serve_forever()

    async def handle_connection(self, reader, writer):
        data_raw = await reader.read(1024)
        data = json.loads(data_raw.decode("utf-8"))
        client_address = writer.get_extra_info('peername')

        if 'node_info_request' in data:
            print(f"Received node info request from {client_address}")
            self.add_node(data['node_info_request'][0], data['node_info_request'][1])
            response = {'node_info_response': (self.public_ip, self.CID)}
            writer.write(json.dumps(response).encode())
            await writer.drain()

    async def send_data(self, ip: str, data: dict, timeout=5.0):
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, self.port), timeout=timeout)
        writer.write(json.dumps(data).encode())
        await writer.drain()
        
        if 'node_info_request' in data:
            response_data = await asyncio.wait_for(reader.read(1024), timeout)
            response = json.loads(response_data.decode())['node_info_response']
            print(f"Received node info response from {writer.get_extra_info('peername')}")
            writer.close(); await writer.wait_closed()
            return response
        else: writer.close(); await writer.wait_closed(); return None
        
    async def bootstrap(self, bootstrap_nodes):
        print(f"Bootstrapping started with CID: {self.CID}")
        bootstrap_nodes.remove(self.public_ip) if self.public_ip in bootstrap_nodes else None
        bucket_targets = []
        for i in range(16): bucket_targets.append(self.generate_target_cid(i))
        for node in bootstrap_nodes:
            new_node = await self.send_data(node, {'node_info_request': (self.public_ip, self.CID)})
            self.add_node(new_node[0], new_node[1])

        while True: await asyncio.sleep(1)

    def get_bucket_index(self, cid: str):
        hash_0 = int(self.CID, base=16)
        hash_1 = int(cid, base=16)
        distance = hash_0 ^ hash_1
        return distance.bit_length() - 1

    def add_node(self, ip: str, cid: str):
        dht_index = self.get_bucket_index(cid)
        self.DHT[dht_index].append((cid,ip))
    
    def generate_target_cid(self, bucketDistance: int) -> str:
        myCidInt = int(self.CID, base=16)
        lowerBound = 2 ** bucketDistance
        upperBound = 2 ** (bucketDistance + 1) - 1
        distance = random.randint(lowerBound, upperBound)
        targetInt = myCidInt ^ distance
        return format(targetInt, '04x')


FSN = file_system_node(port=60000, bootstrap_nodes=['79.230.223.138'])