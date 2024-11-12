const express = require('express');
const http = require('http');
const mqtt = require('mqtt');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);

// MQTT Configuration
const mqtt_broker = 'broker.hivemq.com';
const mqtt_port = 1883;
const mqtt_clientId = 'server_' + Math.random().toString(16).substr(2, 8);

// MQTT Topics
const TOPIC_SENSORS = 'ahmad/sensors';
const TOPIC_CONTROL = 'ahmad/control';
const TOPIC_STATUS = 'ahmad/status';

// Serve static files
app.use(express.static(__dirname));

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Connect to MQTT broker
const mqttClient = mqtt.connect(`mqtt://${mqtt_broker}:${mqtt_port}`, {
    clientId: mqtt_clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
});

// MQTT connection handling
mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    
    // Subscribe to topics
    mqttClient.subscribe([TOPIC_SENSORS, TOPIC_STATUS], () => {
        console.log('Subscribed to topics');
    });
});

// MQTT message handling
mqttClient.on('message', (topic, payload) => {
    console.log('Received Message:', topic, payload.toString());
});

// MQTT error handling
mqttClient.on('error', (error) => {
    console.error('MQTT Error:', error);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    clients.add(ws);

    // Forward MQTT messages to WebSocket clients
    const mqttHandler = (topic, message) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                topic: topic,
                payload: message.toString()
            }));
        }
    };
    mqttClient.on('message', mqttHandler);

    // Handle WebSocket messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Forward control messages to MQTT
            if (data.type === 'control') {
                mqttClient.publish(TOPIC_CONTROL, JSON.stringify(data.payload));
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
        mqttClient.removeListener('message', mqttHandler);
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server...');
    server.close(() => {
        console.log('Server closed');
        mqttClient.end();
        process.exit(0);
    });
});