const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
app.use(express.static('public'));

let rooms = {}; 

io.on('connection', (socket) => {
    socket.on('join-room', (roomID) => {
        if (!roomID) return;
        if (!rooms[roomID]) rooms[roomID] = {};
        const roomPlayers = rooms[roomID];
        
        if (Object.keys(roomPlayers).length < 2) {
            const role = Object.keys(roomPlayers).length === 0 ? 'p1' : 'p2';
            roomPlayers[socket.id] = role;
            socket.join(roomID);
            socket.emit('assign-role', role);
            
            if (Object.keys(roomPlayers).length === 2) {
                // 両者揃ったら全員にゲーム開始を通知
                io.to(roomID).emit('start-game');
            }
        } else { 
            socket.emit('error-msg', '満員です'); 
        }
    });

    socket.on('player-action', (data) => {
        if (data.roomID) {
            // .to() ではなく io.to() を使うことで、自分を含む全員に同期させる
            io.to(data.roomID).emit('sync-action', data);
        }
    });

    socket.on('request-draw', (data) => {
        if (data.roomID) {
            // フロント側で決定したtypeがあればそれを使用、なければサーバーで抽選
            let type = data.type;
            if (!type) {
                const r = Math.random() * 100;
                type = (r < 40) ? "atk" : (r < 70) ? "def" : "sup";
            }
            
            // 全員に誰が何を引いたか（シード値含め）同期
            io.to(data.roomID).emit('sync-draw', { 
                playerId: data.playerId, 
                card: { type: type, seed: Math.random() } 
            });
        }
    });

    socket.on('disconnecting', () => {
        // 全ての参加中ルームからプレイヤーを削除
        socket.rooms.forEach(roomID => {
            if (rooms[roomID] && rooms[roomID][socket.id]) {
                delete rooms[roomID][socket.id];
                if (Object.keys(rooms[roomID]).length === 0) {
                    delete rooms[roomID];
                }
            }
        });
    });
});

http.listen(3000, () => { console.log('Server running on port 3000'); });
