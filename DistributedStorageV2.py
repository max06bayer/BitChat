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

    def get_local_ip(self) -> str:
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

        if 'node_info_request' in data:
            self.add_node(data['node_info_request'][0], data['node_info_request'][1])
            response = {'node_info_response': (self.public_ip, self.CID)}
            writer.write(json.dumps(response).encode())
            await writer.drain()
        elif 'closest_nodes_request' in data:
            closest_nodes = self.get_closest_nodes(data['closest_nodes_request'][1])
            response = {'closest_nodes_response': closest_nodes}
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
            writer.close(); await writer.wait_closed()
            return response
        elif 'closest_nodes_request' in data:
            response_data = await asyncio.wait_for(reader.read(1024), timeout)
            response = json.loads(response_data.decode())['closest_nodes_response']
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

        while True: 
            for index, bucket in enumerate(bucket_targets):
                closest_nodes = await self.deep_node_search(bucket)
                for node in closest_nodes:
                    if self.get_bucket_index(node[0]) == index: 
                        self.add_node(node[1], node[0])
            await asyncio.sleep(1)

    async def deep_node_search(self, cid: str, amount=4) -> list:
        closest_nodes = []; asked_nodes = []
        closest_nodes = self.get_closest_nodes(cid)
        closest_distance = float('inf')

        while True:
            next_to_ask = None
            for node in closest_nodes:
                if node not in asked_nodes:
                    distance = int(int(node[0], base=16) ^ int(cid, base=16)).bit_length() - 1
                    if distance < closest_distance:
                        next_to_ask = node
                        closest_distance = distance
            
            if not next_to_ask: break
            asked_nodes.append(next_to_ask)
            new_nodes = await self.ask_for_closest_nodes(next_to_ask[1], cid)
            all_nodes = closest_nodes + new_nodes
            all_nodes.sort(key=lambda node: int(node[0], base=16) ^ int(cid, base=16))
            closest_nodes = all_nodes[:amount]
            new_closest = int(closest_nodes[0][0], base=16) ^ int(cid, base=16)
            if new_closest >= closest_distance: break
            closest_distance = new_closest
        return closest_nodes[:amount]

    async def ask_for_closest_nodes(self, target_node_ip, cid: str) -> list:
        return await self.send_data(target_node_ip, {'closest_nodes_request': (self.public_ip, cid)})

    def get_closest_nodes(self, cid, amount=4) -> list:
        all_nodes = []
        for bucket in self.DHT:
            for node in bucket:
                all_nodes.append(node)

        all_nodes.sort(key=lambda node: int(node[0], base=16) ^ int(cid, base=16))
        return all_nodes[:amount]

    def get_bucket_index(self, cid: str) -> int:
        hash_0 = int(self.CID, base=16)
        hash_1 = int(cid, base=16)
        distance = hash_0 ^ hash_1
        return distance.bit_length() - 1

    def add_node(self, ip: str, cid: str):
        dht_index = self.get_bucket_index(cid)
        if (cid, ip) in self.DHT[dht_index]: return
        print(f"Found Node {ip} in bucket {dht_index}")
        self.DHT[dht_index].append((cid,ip))
    
    def generate_target_cid(self, bucketDistance: int) -> str:
        myCidInt = int(self.CID, base=16)
        lowerBound = 2 ** bucketDistance
        upperBound = 2 ** (bucketDistance + 1) - 1
        distance = random.randint(lowerBound, upperBound)
        targetInt = myCidInt ^ distance
        return format(targetInt, '04x')


FSN = file_system_node(port=60000, bootstrap_nodes=['79.230.223.138'])