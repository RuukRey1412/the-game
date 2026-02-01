const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let rooms = {}; 

io.on('connection', (socket) => {
    socket.on('join-room', (roomID) => {
        if (!roomID) return;
        if (!rooms[roomID]) rooms[roomID] = { players: {} };

        const room = rooms[roomID];
        const assignedRoles = Object.values(room.players);

        if (Object.keys(room.players).length < 2) {
            const role = assignedRoles.includes('p1') ? 'p2' : 'p1';
            room.players[socket.id] = role;
            socket.join(roomID);
            socket.emit('assign-role', role);
            if (Object.keys(room.players).length === 2) io.to(roomID).emit('start-game');
        } else { 
            socket.emit('error-msg', '満員です'); 
        }
    });

    socket.on('player-action', (data) => {
        if (data.roomID) io.to(data.roomID).emit('sync-action', data);
    });

    socket.on('request-draw', (data) => {
        if (data.roomID) {
            const r = Math.random() * 100;
            const type = (r < 40) ? "atk" : (r < 70) ? "def" : "sup";
            io.to(data.roomID).emit('sync-draw', { playerId: data.playerId, card: { type: type, seed: Math.random() } });
        }
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(roomID => {
            if (rooms[roomID] && rooms[roomID].players[socket.id]) {
                delete rooms[roomID].players[socket.id];
                if (Object.keys(rooms[roomID].players).length === 0) delete rooms[roomID];
            }
        });
    });
});

http.listen(process.env.PORT || 3000, () => { console.log('Server running'); });
