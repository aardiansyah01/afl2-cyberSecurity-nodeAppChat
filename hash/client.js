const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let username = "";
let messageHashes = [];

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input;
    console.log(`Welcome, ${username} to the chat`);
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        const messageHash = crypto
          .createHash("sha256")
          .update(message)
          .digest("hex");

        messageHashes.push(messageHash);
        socket.emit("message", { username, message });
      }
      rl.prompt();
    });
  });
});

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage } = data;
  if (senderUsername !== username) {
    console.log(`${senderUsername}: ${senderMessage}`);
    rl.prompt();
  } else {
    const receivedHash = crypto
      .createHash("sha256")
      .update(senderMessage)
      .digest("hex");

    const hashIndex = messageHashes.indexOf(receivedHash);

    if (hashIndex !== -1) {
      console.log(`${senderUsername}: ${senderMessage}`);

      messageHashes.splice(hashIndex, 1);
    } else {
      console.log(
        "WARNING: the message may have been changed during transmission",
      );
      console.log(`${senderUsername}: ${senderMessage}`);
    }

    rl.prompt();
  }
});

socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});
