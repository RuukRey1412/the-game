const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let rooms = {}; 

io.on('connection', (socket) => {
    socket.on('join-room', (roomID) => {
        if (!rooms[roomID]) {
            rooms[roomID] = {};
        }

        const roomPlayers = rooms[roomID];
        const playerCount = Object.keys(roomPlayers).length;

        if (playerCount < 2) {
            const role = playerCount === 0 ? 'p1' : 'p2';
            roomPlayers[socket.id] = role;
            socket.join(roomID);
            socket.emit('assign-role', role);

            if (Object.keys(roomPlayers).length === 2) {
                io.to(roomID).emit('start-game');
            }
        } else {
            socket.emit('error-msg', 'この部屋は満員です。');
        }
    });

    socket.on('player-action', (data) => {
        if (data.roomID) {
            io.to(data.roomID).emit('sync-action', data);
        }
    });

    socket.on('request-draw', (data) => {
        if (data.roomID) {
            const r = Math.random() * 100;
            // 提供割合: 攻撃40%, 防御30%, サポート30%
            let type = (r < 40) ? "atk" : (r < 70) ? "def" : "sup";
            
            io.to(data.roomID).emit('sync-draw', { 
                playerId: data.playerId, 
                card: { type: type, seed: Math.random() } 
            });
        }
    });

    socket.on('disconnect', () => {
        for (const roomID in rooms) {
            if (rooms[roomID][socket.id]) {
                delete rooms[roomID][socket.id];
                if (Object.keys(rooms[roomID]).length === 0) {
                    delete rooms[roomID];
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
});
