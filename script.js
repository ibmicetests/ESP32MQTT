// MQTT Configuration
const mqtt_host = 'broker.hivemq.com';
const mqtt_port = 8884;  // WSS port
const mqtt_clientId = 'webClient_' + Math.random().toString(16).substr(2, 8);

// MQTT Topics
const TOPIC_SENSORS = 'ahmad/sensors';
const TOPIC_CONTROL = 'ahmad/control';
const TOPIC_STATUS = 'ahmad/status';

let client;
let gauges = [];
let historyChart;
let barChart;
let dataHistory = {
    temperature: [],
    humidity: [],
    battery: [],
    labels: []
};

// Initialize MQTT connection
function initMQTT() {
    const options = {
        clientId: mqtt_clientId,
        clean: true,
        protocol: 'wss',
        reconnectPeriod: 1000,
    };

    console.log('Connecting to MQTT broker...');
    client = mqtt.connect(`wss://${mqtt_host}:${mqtt_port}/mqtt`, options);

    client.on('connect', () => {
        console.log('Connected to MQTT broker');
        client.subscribe(TOPIC_SENSORS);
        client.subscribe(TOPIC_STATUS);
        updateStatusIndicator(true);
    });

    client.on('message', (topic, message) => {
        const payload = message.toString();
        
        if (topic === TOPIC_SENSORS) {
            handleSensorData(JSON.parse(payload));
        } else if (topic === TOPIC_STATUS) {
            updateStatusIndicator(payload === 'online');
        }
    });

    client.on('error', (error) => {
        console.error('MQTT Error:', error);
        updateStatusIndicator(false);
    });

    client.on('close', () => {
        console.log('MQTT Connection closed');
        updateStatusIndicator(false);
    });
}

// Initialize Gauge.js instances
function initGauges() {
    const gaugeOptions = {
        angle: -0.2,
        lineWidth: 0.2,
        radiusScale: 0.9,
        pointer: {
            length: 0.6,
            strokeWidth: 0.035,
            color: '#000000'
        },
        limitMax: false,
        limitMin: false,
        generateGradient: true,
        highDpiSupport: true,
        staticLabels: {
            font: "12px sans-serif",
            labels: [0, 20, 40, 60, 80, 100],
            color: "#000000",
            fractionDigits: 0
        },
        staticZones: [
            {strokeStyle: "#30B32D", min: 0, max: 30},
            {strokeStyle: "#FFDD00", min: 30, max: 70},
            {strokeStyle: "#F03E3E", min: 70, max: 100}
        ],
    };

    // Temperature Gauge
    const gauge1 = new Gauge(document.getElementById('gauge1')).setOptions({
        ...gaugeOptions,
        staticZones: [
            {strokeStyle: "#30B32D", min: 0, max: 25},
            {strokeStyle: "#FFDD00", min: 25, max: 50},
            {strokeStyle: "#F03E3E", min: 50, max: 100}
        ]
    });

    // Humidity Gauge
    const gauge2 = new Gauge(document.getElementById('gauge2')).setOptions({
        ...gaugeOptions,
        staticZones: [
            {strokeStyle: "#F03E3E", min: 0, max: 30},
            {strokeStyle: "#FFDD00", min: 30, max: 60},
            {strokeStyle: "#30B32D", min: 60, max: 100}
        ]
    });

    // Battery Gauge
    const gauge3 = new Gauge(document.getElementById('gauge3')).setOptions({
        ...gaugeOptions,
        staticZones: [
            {strokeStyle: "#F03E3E", min: 0, max: 20},
            {strokeStyle: "#FFDD00", min: 20, max: 50},
            {strokeStyle: "#30B32D", min: 50, max: 100}
        ]
    });

    gauges = [gauge1, gauge2, gauge3];
    gauges.forEach(gauge => {
        gauge.maxValue = 100;
        gauge.setMinValue(0);
        gauge.animationSpeed = 32;
        gauge.set(0);
    });
}

// Initialize Charts
function initCharts() {
    const ctx1 = document.getElementById('historyChart').getContext('2d');
    const ctx2 = document.getElementById('barChart').getContext('2d');

    historyChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    borderColor: 'rgb(255, 99, 132)',
                    data: []
                },
                {
                    label: 'Humidity (%)',
                    borderColor: 'rgb(54, 162, 235)',
                    data: []
                },
                {
                    label: 'Battery (%)',
                    borderColor: 'rgb(75, 192, 192)',
                    data: []
                }
            ]
        },
        options: {
            responsive: true,
            animation: {
                duration: 750
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    barChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Temperature', 'Humidity', 'Battery'],
            datasets: [{
                label: 'Current Values',
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(75, 192, 192, 0.5)'
                ],
                borderColor: [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(75, 192, 192)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function updateStatusIndicator(isOnline) {
    const statusDiv = document.getElementById('status-indicator');
    if (isOnline) {
        statusDiv.className = 'status-indicator status-online';
        statusDiv.textContent = 'Device Online';
    } else {
        statusDiv.className = 'status-indicator status-offline';
        statusDiv.textContent = 'Device Offline';
    }
}

function handleSensorData(data) {
    // Update gauges
    gauges[0].set(data.temperature);
    gauges[1].set(data.humidity);
    gauges[2].set(data.battery);

    // Update values
    document.getElementById('value1').textContent = `${data.temperature.toFixed(1)}°C`;
    document.getElementById('value2').textContent = `${data.humidity.toFixed(1)}%`;
    document.getElementById('value3').textContent = `${data.battery.toFixed(1)}%`;

    // Update history
    const timestamp = new Date().toLocaleTimeString();
    updateCharts(timestamp, data);
}

function updateCharts(timestamp, data) {
    // Update line chart
    if (historyChart.data.labels.length > 20) {
        historyChart.data.labels.shift();
        historyChart.data.datasets.forEach(dataset => dataset.data.shift());
    }

    historyChart.data.labels.push(timestamp);
    historyChart.data.datasets[0].data.push(data.temperature);
    historyChart.data.datasets[1].data.push(data.humidity);
    historyChart.data.datasets[2].data.push(data.battery);
    historyChart.update();

    // Update bar chart
    barChart.data.datasets[0].data = [data.temperature, data.humidity, data.battery];
    barChart.update();
}

function updateInterval() {
    const interval = document.getElementById('intervalInput').value;
    if (interval < 1 || interval > 3600) {
        alert('Interval must be between 1 and 3600 seconds');
        return;
    }

    if (client && client.connected) {
        client.publish(TOPIC_CONTROL, JSON.stringify({ interval: parseInt(interval) }));
        console.log('Interval update sent:', interval);
    } else {
        console.error('MQTT client not connected');
    }
}

// Initialize everything when the page loads
window.onload = () => {
    initMQTT();
    initGauges();
    initCharts();
};