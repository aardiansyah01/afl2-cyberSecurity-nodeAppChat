const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let targetUsername = "";
let username = "";
const users = new Map();

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input;
    console.log(`Welcome, ${username} to the chat`);

    socket.emit("registerPublicKey", {
      username,
      publicKey: publicKey,
    });
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        if ((match = message.match(/^!secret (\w+)$/))) {
          targetUsername = match[1];
          console.log(`Now secretly chatting with ${targetUsername}`);
        } else if (message.match(/^!exit$/)) {
          console.log(`No more secretly chatting with ${targetUsername}`);
          targetUsername = "";
        } else {
          if (targetUsername) {
            const targetPublicKey = users.get(targetUsername);

            if (!targetPublicKey) {
              console.log(`Public key for ${targetUsername} not found`);
            } else {
              try {
                const encryptedMessage = crypto.publicEncrypt(
                  {
                    key: targetPublicKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: "sha256",
                  },
                  Buffer.from(message),
                );
                socket.emit("message", {
                  username,
                  message: JSON.stringify({
                    type: "rsa",
                    targetUsername,
                    ciphertext: encryptedMessage.toString("base64"),
                  }),
                });
              } catch (error) {
                console.log("Message encryption failed");
              }
            }
          } else {
            socket.emit("message", { username, message });
          }
        }
      }
      rl.prompt();
    });
  });
});

socket.on("init", (keys) => {
  keys.forEach(([user, key]) => users.set(user, key));
  console.log(`\nThere are currently ${users.size} users in the chat`);
  rl.prompt();
});

socket.on("newUser", (data) => {
  const { username, publicKey } = data;
  users.set(username, publicKey);
  console.log(`${username} join the chat`);
  rl.prompt();
});

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage } = data;
  if (senderUsername !== username) {
    try {
      const receivedData = JSON.parse(senderMessage);

      if (receivedData.type === "rsa") {
        if (receivedData.targetUsername === username) {
          const decryptedMessage = crypto.privateDecrypt(
            {
              key: privateKey,
              padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
              oaepHash: "sha256",
            },
            Buffer.from(receivedData.ciphertext, "base64"),
          );
          console.log(`${senderUsername}: ${decryptedMessage.toString()}`);
        } else {
          console.log(`${senderUsername}: ${receivedData.ciphertext}`);
        }
      } else {
        console.log(`${senderUsername}: ${senderMessage}`);
      }
    } catch (error) {
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
