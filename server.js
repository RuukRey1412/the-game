const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = {}; 

io.on('connection', (socket) => {
    if (Object.keys(players).length < 2) {
        const role = Object.keys(players).length === 0 ? 'p1' : 'p2';
        players[socket.id] = role;
        socket.emit('assign-role', role);
        if (Object.keys(players).length === 2) io.emit('start-game');
    } else {
        socket.disconnect();
    }

    socket.on('player-action', (data) => io.emit('sync-action', data));

    socket.on('request-draw', (data) => {
        const r = Math.random() * 100;
        // 提供割合: 攻撃40%, 防御30%, サポート30%
        let type = (r < 40) ? "atk" : (r < 70) ? "def" : "sup";
        io.emit('sync-draw', { 
            playerId: data.playerId, 
            card: { type: type, seed: Math.random() } 
        });
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

http.listen(3000, () => { console.log('Server running: http://localhost:3000'); });