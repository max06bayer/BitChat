import socket
import json

def sendData(ip:str, data:dict):
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect((ip, 60000))
    data = json.dumps(data, indent = 4)
    client.send(data.encode("utf-8"))
    client.close()

sendData('79.230.223.138', {"message": "Hello, World!"})