import { sleep, fixXSS, contextMenu } from "./js/utils.js";

// Elements
const sendBtn = document.querySelector(".send");
const nicknameBtn = document.querySelector(".nickname");
const messageBox = document.querySelector(".message-box");
const messageList = document.querySelector(".messages");
const memberList = document.querySelector(".members>.list");
// Commands
const COMMANDS = [
    {
        name: "a",
        hidden: !0,
        description: "Executes an admin action.",
        exec: ({ socket, args }) => {
            socket.emit("admin-action", { args })
        }
    }
]
// Config
const API_URL = `${(location.protocol === "https:" ? "https://" : "http://")}${window.location.hostname}:${window.location.port}`;
let members = [];
/**
 * Sends a text message.
 * @param {string} text The text to send.
 */
function sendTextMessage(text) {
    socket.emit('message', {
        type: "text",
        content: (typeof text === 'string') ? text : `${text}`
    });
};

/**
 * Creates a message element and appends it to the chat.
 * @param {Object} params The message parameters.
 */
function createMessage(params) {
    const opts = {
        color: undefined,
        allowHtml: false,
        user: "System",
        content: "",
        classes: [],
        flags: [],
        date: new Date().toUTCString(),
        ...params,
    }
    
    const msg = document.createElement("div");
    msg.className = "message";
    msg.classList.add(...opts.classes);
    if(!opts.classes.includes("system")) {
        msg.innerHTML = `
            <div class="sig">
                <span class="time">${new Date(Date.parse(opts.date)).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}</span>
                <span class="author" ${opts.color ? `style="background-color: ${opts.color};"` : ""}>${fixXSS(opts.user)}</span>
                ${opts.flags.map(flag => `<span class="tag ${flag}">${flag}</span>`).join("")}
            </div>

            <div class="content messageContentFix" ${opts.color ? `style="color: ${opts.color};"` : ""}>
                ${twemoji.parse(fixXSS(opts.content))}
            </div>
        `;
    } else {
        msg.innerHTML = `
            <div class="sig">
                <span class="time">${new Date(Date.parse(opts.date)).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}</span>
                <span class="author" ${opts.color ? `style="background-color: ${opts.color};"` : ""}>${fixXSS(opts.user)}</span>
                ${opts.flags.map(flag => `<span class="tag ${flag}">${flag}</span>`).join("")}
            </div>

            <div class="content messageContentFix" ${opts.color ? `style="color: ${opts.color};"` : ""}>
                ${twemoji.parse(DOMPurify.sanitize(marked.parse(opts.content)).replaceAll("\\n", "<br>"))}
            </div>
        `;
    }

    //TODO: Context menu
    msg.addEventListener('contextmenu', e => {
        e.preventDefault();
        if(opts.id) contextMenu(opts.id);
    });
    messageList.appendChild(msg);
    messageList.scrollTo(0, messageList.scrollHeight);
}

/**
 * Reloads the member list.
 */
function reloadMemberList() {
    memberList.innerHTML = "";
    members.forEach(member => {
        memberList.innerHTML += `<div class="member" ${member.color ? `style="color: ${member.color};"` : ""}>${member.flags.map(flag => `<span class="tag ${flag}">${flag}</span>`).join("")}${fixXSS(member.user)}</div>`
    });
}

var errored = false;

// Socket
const socket = io(API_URL, {
    reconnection: false
});
window.socket = socket;
socket.on("connect", () => {
    // Nickname
    let username = localStorage.getItem("nickname") ?? prompt("Enter username");
    if (!username || username.length < 1 || username.length > 16) {
        username = "anon" + Math.floor(Math.random() * 99) + 1;
    } else {
        localStorage.setItem("nickname", username);
    }
    document.querySelector(".nickname").innerText = username;
    console.log("Username is", username);
    socket.on("online", (memberList) => {
        members = memberList;
        reloadMemberList();
    })
    // Authentication
    socket.emit("auth", { user: username });

    socket.once("auth-error", async (content) => {
        createMessage({ content, classes: ["system", "error"] });
    });

    socket.once("auth-complete", async (userId, sessionId) => {
        // Join
        socket.on("user-join", (data) => {
            members.push({ user: data.user, color: data.color, flags: data.flags, id: data.id, session_id: data.session_id });
            reloadMemberList();
            createMessage({ content: `-> User <span class="bold-noaa" style="color: ${data.color};">${fixXSS(data.user)}</span> joined the chat :D`, classes: ["system", "info"] });
        });

        // Leave
        socket.on("user-leave", (data) => {
            members = members.filter(member => member.session_id !== data.session_id);
            reloadMemberList();
            createMessage({ content: `<- User <span class="bold-noaa">${fixXSS(data.user)}</span> left the chat :(`, classes: ["system", "error"] });
        });

        // Message handling
        socket.on("message", ({ user, content, id, color, date }) => {
            const flags = members.find(member => member.id === id)?.flags || [];
            createMessage({ user, content, id, flags, color, date });
        });

        // System message handling
        socket.on("sys-message", ({ content, type }) => {
            createMessage({ content, classes: ["system", type] });
        });
        // Nickname change
        socket.on("nick-changed", (data) => {
            members = members.map(member => {
                if (member.session_id === data.session_id) {
                    member.user = data.newUser;
                }
                return member;
            })
            reloadMemberList();
            createMessage({
                content: `User **${fixXSS(data.oldUser)}** changed their username to **${fixXSS(data.newUser)}**`,
                classes: ["system", "success"],
            });
        });
        nicknameBtn.addEventListener("click", () => {
            changeUsername();
        });
    });
});
function handleSend() {
    if (messageBox.value) {
        if (messageBox.value.startsWith("/")) {
            const args = messageBox.value.slice(1).split(" ");
            const cmd = COMMANDS.find(c => c.name === args[0]);
            if (cmd) {
                cmd.exec({ socket, args });
            }
        } else {
            if(messageBox.value.length <= 2048) {
                sendTextMessage(messageBox.value);
            } else {
                alert("Message > 2048");
            }
        }

        messageBox.value = "";
    }
}
// Event listeners for message sending
sendBtn.addEventListener("click", handleSend);
messageBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
    }
})

socket.on("connect_error", (err) => {
    if(!errored) {
        errored = true;
        // location.reload();
        console.log(err);
        createMessage({ content: "You have been disconnected from the server. Reason can be found on console. [Click here to reconnect](/)", classes: ["system", "error"] });
    }
});
socket.on('disconnect', () => {
    if(!errored) {
        errored = true;
        // location.reload();
        createMessage({ content: "You have been disconnected from the server. [Click here to reconnect](/)", classes: ["system", "error"] });
    }
});

function changeUsername(username = null) {
    if (!username) {
        let newUsername = prompt("Enter a new username");
        if (newUsername) {
            changeUsername(newUsername);
        }
    } else {
        if (username.length < 1 || username.length > 18) {
            createMessage({ content: "**This nickname is not allowed.**", classes: ["system", "error"] });
        } else {
            document.querySelector(".nickname").innerText = username;
            socket.emit("change-user", username);
            socket.on("nick-changed-success", (res) => {
                if (!res) {
                    changeUsername();
                } else {
                    localStorage.setItem("nickname", username);
                }
            });
        }
    }
}
function sendMessage(msg) {
    socket.emit("message", {});
}