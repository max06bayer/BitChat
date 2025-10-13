import json
from typing import OrderedDict
import numpy as np
import ast

# EXPERIMENT:
# Is the meshroom toxic (1) or not (0)
# First Parameter: Mushroom size
# Second Parameter: Mushroom smell
# Only the size is < 2 and the smell is bigger than 1, it is toxic

dataset = [
    (np.array([0, 0]), np.array([0])),
    (np.array([0, 1]), np.array([0])),
    (np.array([0, 2]), np.array([1])),
    (np.array([0, 3]), np.array([1])),
    (np.array([1, 0]), np.array([0])),
    (np.array([1, 1]), np.array([0])),
    (np.array([1, 2]), np.array([1])),
    (np.array([1, 3]), np.array([1])),
    (np.array([2, 0]), np.array([0])),
    (np.array([2, 1]), np.array([0])),
    (np.array([2, 2]), np.array([0])),
    (np.array([2, 3]), np.array([1])),
    (np.array([3, 0]), np.array([0])),
    (np.array([3, 1]), np.array([0])),
    (np.array([3, 2]), np.array([0])),
    (np.array([3, 3]), np.array([0])),
]

class NeuralNetwork:
    def __init__(self, size: list):
        self.inputs = np.array([0 for _ in range(size[0])])
        self.layers = [np.array([0 for _ in range(_)]) for _ in size[1:]]
        self.weights = [np.random.randn(size[i + 1], size[i]) for i in range(len(size) - 1)]
        self.bias = [np.zeros(size[i + 1]) for i in range(len(size) - 1)]

    def forward(self, inputs: np.ndarray) -> np.ndarray:
        self.inputs = inputs
        for i, _ in enumerate(self.layers):
            prev_layer = self.layers[i - 1] if i > 0 else self.inputs
            self.layers[i] = np.tanh(np.dot(self.weights[i], prev_layer) + self.bias[i])
        return self.layers[-1]

    def error(self, data: list) -> float:
        predictions = np.sum([self.forward(d[0]) for d in data], axis=0)
        output = np.sum([d[1] for d in data], axis=0)
        return (np.abs(output - predictions)) / len(data)
        

    def backpropagation_step(self, inputs: np.ndarray, target: np.ndarray, learning_rate=0.01) -> float:
        a = [inputs]; z = []
        for i in range(len(self.weights)):
            z.append(np.dot(self.weights[i], a[-1]) + self.bias[i])
            a.append(np.tanh(z[-1]))
        
        d = (a[-1] - target) * (1 - np.tanh(z[-1]) ** 2)
        nw = [np.zeros(w.shape) for w in self.weights]
        nb = [np.zeros(b.shape) for b in self.bias]
        nw[-1] = np.outer(d, a[-2])
        nb[-1] = d
        
        for l in range(2, len(self.weights) + 1):
            d = np.dot(self.weights[-l+1].T, d) * (1 - np.tanh(z[-l]) ** 2)
            nw[-l] = np.outer(d, a[-l-1])
            nb[-l] = d
        for i in range(len(self.weights)):
            self.weights[i] -= learning_rate * nw[i]
            self.bias[i] -= learning_rate * nb[i]
        return np.sum((a[-1] - target) ** 2)

    def train(self, data, epochs=100, learning_rate=0.01):
        for epoch in range(epochs * 100):
            losses = [self.backpropagation_step(x, y, learning_rate) for x, y in data]
            if epoch % 100 == 0:
                print(f'\rEpoch {int(epoch / 100)}, avg loss: {np.mean(losses):.6f}', end='')


# n1 = NeuralNetwork([2, 4, 4, 4, 1])
# n1.train(dataset, epochs=10, learning_rate=0.05)

class PrepareConversations:
    def __init__(self):
        pass

    def words_lookup_table(self) -> list:
        lookup_table = OrderedDict({})
        with open('movie_lines.txt', 'r', encoding='iso-8859-1') as movie_lines:
            lines = movie_lines.readlines()
            for line in lines:
                words = line.split('+++')
                lookup_table[words[0][:-1]] = words[-1][1:-1]
        with open('words_lookup_table.json', 'w') as word_table:
            word_table.write(json.dumps(lookup_table, indent=4))
        return lookup_table

    def conversations_order(self):
        lookup_table = list(self.words_lookup_table().keys())
        word_conversations = []
        with open('movie_conversations.txt', 'r') as conversations:
            lines = conversations.readlines()
            for i, line in enumerate(lines):
                print(i)
                words = ast.literal_eval(line.split('+++$+++ ')[-1])
                indexes = [lookup_table.index(word) for word in words]
                word_conversations.append(indexes)
        with open('words_conversations.json', 'w') as word_table:
            word_table.write(json.dumps(word_conversations, indent=4))


c1 = PrepareConversations()
# c1.words_lookup_table()
c1.conversations_order()