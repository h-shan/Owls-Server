var fs = require('fs');
var express = require('express');
var https = require('https');
var app = express();
var options = {
   key: fs.readFileSync('/home/ec2-user/private-key.pem'),
   cert: fs.readFileSync('/home/ec2-user/www_strategicsoccer_me.crt')
};
var serverPort = 4000; 
var server = https.createServer(options, app);
var io = require('socket.io')(server);

var userList = [];
var typingUsers = {};

app.get('/', function(req, res){
  res.send('<h1>Owls Server</h1>');
});

function getIndex(playerName) {
  for (var i = 0; i < userList.length; i++) {
    if (userList[i]["username"] == playerName) {
      return i;
    }
  }
  console.log("User with name \"" + playerName + "\" not found.");
  return -1;
}

server.listen(serverPort, function(){
  console.log('Listening on *:4000');
});

io.on('connection', function(clientSocket) {
  console.log('a user connected');
  io.emit("userList", userList);

  clientSocket.on('disconnect', function(){
    console.log('user disconnected');

    var clientUsername;
    for (var i=0; i<userList.length; i++) {
      if (userList[i]["id"] == clientSocket.id) {
        var opponent = userList[i]["opponent"];
        var oppIndex = getIndex(opponent);
        if (oppIndex != -1) {
          userList[oppIndex]["opponent"] = ""
          io.to(userList[oppIndex]["id"]).emit("gameOver");
        }
        userList.splice(i, 1);
        break;
      }
    }

    io.emit("userList", userList);
    io.emit("userExitUpdate", clientUsername);
  });


  clientSocket.on("exitUser", function(clientUsername){
    for (var i=0; i<userList.length; i++) {
      if (userList[i]["id"] == clientSocket.id) {
        userList.splice(i, 1);
        break;
      }
    }
    io.emit("userExitUpdate", clientUsername);
  });

  clientSocket.on("connectUser", function(clientUsername) {
      var userInfo = {};
      var foundUser = false;
      var i = getIndex(clientUsername);
      if (i != -1) {
        if (userList[i]["id"] == clientSocket.id) {
          userList[i]["opponent"] = "";
          userList[i]["isHost"] = false;
        } else {
          var currentName;
          for (var i = 1; true; i++) {
            currentName = clientUsername + " (" + i + ")"
            if (getIndex(currentName) == -1) {
              userInfo["id"] = clientSocket.id;
              userInfo["username"] = currentName;
              userInfo["opponent"] = "";
              userInfo["isHost"] = false;
              userList.push(userInfo);
              io.to(clientSocket.id).emit("nameChange", currentName);
              break;
            }
          }
        }
        userInfo = userList[i];
      } else {
        userInfo["id"] = clientSocket.id;
        userInfo["username"] = clientUsername;
        userInfo["opponent"] = "";
        userList.push(userInfo);
      }
      console.log("User with name \"" + userInfo["username"] + "\" is now connected.")

      io.emit("userList", userList);
      io.emit("userConnectUpdate", userInfo)
  });

  clientSocket.on("inviteToGame", function(clientUsername, opponentUsername) {
    console.log("Invite from " + clientUsername + " to " + opponentUsername);
    var indexOpponent = getIndex(opponentUsername);
    if (indexOpponent == -1) return;
    io.to(userList[indexOpponent]["id"]).emit("inviteToGame", clientUsername);
  });

  clientSocket.on("connectGame", function(clientUsername, otherUsername) {
    console.log("Game between: " + clientUsername + " and " + otherUsername)
    var otherId;
    var index1 = getIndex(clientUsername);
    var index2 = getIndex(otherUsername);
    if (index1 == -1) return;
    if (index2 == -1) return;
    userList[index1]["opponent"] = otherUsername;
    userList[index1]["isHost"] = true;
    userList[index2]["opponent"] = clientUsername;
    userList[index2]["isHost"] = false;
    io.to(clientSocket.id).emit("connectGameUpdate", otherUsername, true);
    io.to(userList[index2]["id"]).emit("connectGameUpdate", clientUsername, false);
  })

  clientSocket.on("gameInfo", function(opponentName, mode, playerOption, flag, screenWidth, screenHeight, friction) {
    var i = getIndex(opponentName);
    if (i == -1) return;
    io.to(userList[i]["id"]).emit("gameInfoUpdate", mode, playerOption, flag, screenWidth, screenHeight, friction);
  })

  clientSocket.on("pause", function(opponentName, pauseOption) {
    var i = getIndex(opponentName);
    if (i == -1) return;
    io.to(userList[i]["id"]).emit("pauseUpdate", pauseOption)
  })

  clientSocket.on("move", function(opponentName, moveInfo, time) {
    var i = getIndex(opponentName);
    if (i == -1) return;
    io.to(userList[i]["id"]).emit("moveUpdate", moveInfo, time);
  })
});
