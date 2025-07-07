const http = require('http').createServer();
const io = require('socket.io')(http, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://192.168.137.1:5173',
        'http://192.168.0.112:5173'
      ],
      credentials: true
    }
  });

let sockets = [];

io.on('connection', socket => {
  sockets.push(socket);

  socket.on('signal', data => {
    // Forward to the other peer only
    sockets.forEach(s => {
      if (s !== socket) s.emit('signal', data);
    });
  });

  socket.on('disconnect', () => {
    sockets = sockets.filter(s => s !== socket);
  });
});

http.listen(3001, () => console.log('Signaling server running on port 3001'));
