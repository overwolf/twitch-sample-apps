(function() {
    
    document.querySelector('#btnConnect').addEventListener("click", connect);
    document.querySelector('#btnDisconnect').addEventListener("click", disconnect);
    document.querySelector('#btnSendMessage').addEventListener("click", sendMessage);
    document.querySelector('#txtMessage').addEventListener("keyup", function(e){
       if(e.keyCode == "13"){
           sendMessage();
       }
    });


    var userList = [];

    function serialize(obj) {
        var str = [];
        for (var p in obj)
            if (obj.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
            }
        return str.join("&");
    }

    function loginToTwitchApi(username, password, callback) {

        var data = {
            username: username,
            password: password,
            client_id: '!!YOUR_CLIENT_KEY!!',
            client_secret: '!!YOUR_CLIENT_SECRET!!',
            scope: 'user_read channel_stream channel_read channel_editor chat_login channel_commercial sdk_broadcast metadata_events_edit',
            grant_type: 'password'
        };

        var xhr = new XMLHttpRequest();

        //Don't forget to add the twitch API url to the externally_connectable property in your manifest.json
        xhr.open("POST", "https://api.twitch.tv/kraken/oauth2/token", true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
        xhr.setRequestHeader("Accept", "application/json, text/plain, */*");

        xhr.send(serialize(data));

        xhr.onload = function () {
            callback(JSON.parse(this.responseText));
        };

    }

    function connect() {
        console.log("connect");
        var username = document.querySelector("#txtUser").value;
        var password = document.querySelector("#txtPassword").value;

        loginToTwitchApi(username, password, function (response) {

            if(response.status){
                document.querySelector('#status').innerText = response.message;
                return;
            }
            var token = response.access_token;

            var channel = document.querySelector('#txtChannel').value;
            if (channel == "") {
                document.querySelector('#txtChannel').value = username;
                channel = username;
            }

            document.querySelector('#status').innerText = "Status: Connecting...";
            plugin.chatConnect(username, channel, token, function (e, error) {

                    if (e) {
                        document.querySelector('#status').innerText = "Status: Connected";
                    }
                    else {
                        document.querySelector('#status').innerText = "Status: Disconnected -" + error;
                    }
                    console.log("connect callback:", e, error)
                }
            )
        });
    }

    function disconnect() {
        plugin.chatDisconnect(function (e, error) {
            console.log("disconnect callbak:", e, error)

            //clear userList
            userList = [];
        });

    }


    var plugin = document.querySelector('#plugin');

    if (plugin == null) {
        document.querySelector('#title').innerText = "Plugin couldn't be loaded!";

    } else {
        document.querySelector('#title').innerText = "Plugin was loaded!";
    }

    plugin.onChatStateChanged = function (e, error) {
        if (e) {
            document.querySelector('#status').innerText = "Status: Connected";
        }
        else {
            document.querySelector('#status').innerText = "Status: Disconnected - " + error;
            userList = [];
        }
        console.log("ChatStateChanged", e, error);
    };

    function sendMessage() {
        var message = document.querySelector('#txtMessage').value;

        if (message) {
            plugin.chatSendMessage(message, function (e) {
                if (e) // message sent
                    document.querySelector('#txtMessage').value = "";

            });
        }
    }

    plugin.onChatMessageReceived = function (e) {
        var message = JSON.parse(e);

        document.querySelector('#textareaMessage').value += message.userName + ": " + decodeURIComponent(message.message) + "\n";
        document.querySelector('#textareaMessage').scrollTop = document.querySelector('#textareaMessage').scrollHeight;
        console.log("ChatMessageReceived", e);
    };

    plugin.onUsersJoinChannel = function (e) {
        var newUser = JSON.parse(e);
        newUser.users.forEach(function (user) {
            userList.push(user.disaplyName);
        });

        refreshUserTable();
        console.log("onUsersJoinChannel", e);
        console.log("onUsersJoinChannel JSON:", JSON.parse(e));
    };

    plugin.onUsersLeftChannel = function (e) {
        var leftUsser = JSON.parse(e);
        leftUsser.users.forEach(function (user) {
            removeUser(user.disaplyName);
        });
        console.log("onUsersLeftChannel", e);

        refreshUserTable();
        console.log("onUsersLeftChannel JSON:", JSON.parse(e));
    };

    plugin.onUsersUpdated = function (e) {
        console.log("onUsersUpdated :", e);
        console.log("onUsersUpdated JSON:", JSON.parse(e));
    };


    function removeUser(value) {
        var idx = userList.indexOf(value);
        if (idx != -1) {
            return userList.splice(idx, 1); // The second parameter is the number of elements to remove.
        }
        return false;
    }

    function refreshUserTable() {
        var usersTable = document.querySelector('#userTable');
        usersTable.innerHTML = "";

        userList.forEach(function (user) {
            var newTr = document.createElement("tr");
            var newTd = document.createElement("td");
            newTd.innerText = user;
            newTr.appendChild(newTd);
            usersTable.appendChild(newTd);
        });
    }
})();