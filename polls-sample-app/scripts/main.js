(function() {
    //
    // Loading and initializing the NPAPI plugin.
    //
    

    var chatPlugin = document.querySelector('#chatPlugin');

    if (chatPlugin == null || !chatPlugin.chatConnect) {
        document.querySelector('#title').innerText = "Chat plugin couldn't be loaded!";

    } else {
        document.querySelector('#title').innerText = "Chat plugin was loaded!";

        //
        // On chat state changed (connected/disconnected)
        //
        chatPlugin.onChatStateChanged = function (e, error) {
            if (e) {
                document.querySelector('#status').innerText = "Status: Connected to chat";
            }
            else {
                document.querySelector('#status').innerText = "Status: Disconnected from chat - " + error;
            }
            console.log("ChatStateChanged", e, error);
        };

        //
        // On chat message received
        //
        chatPlugin.onChatMessageReceived = function (e) {
            var message = JSON.parse(e);

            //If this is the 'Poll ended' message, disconnect from chat.
            if (!pollData.isPollLive)
            {
                disconnect();
            }

            console.log("ChatMessageReceived", e);

            document.querySelector('#textareaMessage').value += message.userName + ": " + decodeURIComponent(message.message) + "\n";
            document.querySelector('#textareaMessage').scrollTop = document.querySelector('#textareaMessage').scrollHeight;

            //Not a poll option.
            if (message.message != "1" && message.message != "2")
            {
                return;
            }

            console.log("New vote: " + pollOptionNum);

            //Increase counter and show vote received.
            var pollOptionNum = parseInt(message.message) - 1;
            pollData.pollNumVotes[pollOptionNum] = pollData.pollNumVotes[pollOptionNum] + 1;        

            document.querySelector('#textareaMessage').value += "[POLL] Vote received: " + decodeURIComponent(message.message) + "\n";
            document.querySelector('#textareaMessage').scrollTop = document.querySelector('#textareaMessage').scrollHeight;
        };
    }

    //
    // Poll data
    //
    var pollData = {
        isPollLive: false,
        pollNumVotes: [],
        pollTimeElapsedMs: 0
    }

    //
    // Click/key listeners
    //
    document.querySelector('#btnStartPoll').addEventListener("click", connectAndDoPoll);
    document.querySelector('#btnSendMessage').addEventListener("click", sendTextMessage);
    document.querySelector('#txtMessage').addEventListener("keyup", function(e){
       if(e.keyCode == "13"){
           sendTextMessage();
       }
    });

    //
    // Twitch API Login
    //
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
		streamId: null,
		client_id: 'YOUR_CLIENT_ID',
		client_secret: 'YOUR_CLIENT_SECRET',
            scope: 'user_read channel_stream channel_read channel_editor chat_login channel_commercial sdk_broadcast metadata_events_edit'
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

    //
    // Connecting to Twitch Chat and starting the poll
    //
    function connectAndDoPoll() {
        console.log("connect");
        var username = document.querySelector("#txtUser").value;
        var password = document.querySelector("#txtPassword").value;

        loginToTwitchApi(username, password, function (response) {

            if(response.status){
                document.querySelector('#status').innerText = response.message;
                return;
            }
            var token = response.access_token;

            document.querySelector('#status').innerText = "Status: Connecting...";
            chatPlugin.chatConnect(username, username, token, function (e, error) {

                    if (e) {
                        document.querySelector('#status').innerText = "Status: Connected to chat";
                        doPoll();
                    }
                    else {
                        document.querySelector('#status').innerText = "Status: Could not connect to chat - " + error;
                    }
                    console.log("connect callback:", e, error)
                }
            )
        });
    }

    //
    // Poll logic
    //
    function doPoll() {
        var question = document.querySelector('#txtQuestion').value;
        var option1 = document.querySelector('#txtOption1').value;
        var option2 = document.querySelector('#txtOption2').value;
        var timer = parseInt(document.querySelector('#txtTimer').value);

        pollData.pollNumVotes = [0, 0];

        document.querySelector('#status').innerText = "Status: Poll is running.";
        sendMessage("poll started! " + question + " 1 - " + option1 + " 2 - " + option2);
        pollData.isPollLive = true;

        //A timeout is called when the poll ends.
        setTimeout(function () {
            if (pollData.pollNumVotes[0] + pollData.pollNumVotes[1] == 0)
            {
                sendMessage("Poll is over! No votes received.");   
            }
            else
            {
                var winningOption = -1;

                if (pollData.pollNumVotes[0] > pollData.pollNumVotes[1])
                {
                    winningOption = 0;
                }
                else if (pollData.pollNumVotes[1] > pollData.pollNumVotes[0])
                {
                    winningOption = 1;
                }

                if (winningOption >= 0)
                {
                    var percentage = parseInt((pollData.pollNumVotes[winningOption] / (pollData.pollNumVotes[0] + pollData.pollNumVotes[1])) * 100);

                    sendMessage("Poll is over! The winner is " + (winningOption + 1) + " with " + percentage + "% of the votes.");
                }
                else
                {
                    sendMessage("Poll is over! The result is a draw.");   
                }
            }

            document.querySelector('#status').innerText = "Status: Poll is over. Disconnected from chat.";
            pollData.isPollLive = false;
            pollData.pollTimeElapsedMs = 0;
        }, timer * 1000);

        //A progress interval.
        var progressInterval = setInterval(function () {

            pollData.pollTimeElapsedMs += 100;

            if (!pollData.isPollLive)
            {
                clearInterval(progressInterval);
                return;
            }

            var timeLeftMs = parseInt(document.querySelector('#txtTimer').value) * 1000 - pollData.pollTimeElapsedMs;

            document.querySelector('#status').innerText = "Status: Poll is running (" + parseFloat(timeLeftMs / 1000).toFixed(2) + " secs left)";
        }, 100);
    }

    //
    // Send text from the textbox
    //
    function sendTextMessage() {
        var message = document.querySelector('#txtMessage').value;

        if (message) {
            document.querySelector('#txtMessage').value = "";
            document.querySelector('#txtMessage').focus();
            
            sendMessage(message);
        }
    }

    //
    // Send text from parameter
    //
    function sendMessage(message) {
        if (message) {
            chatPlugin.chatSendMessage(message, function (e) {
                if (e) // message sent
                    console.log("Message send: " + message);
            });
        }
    }

    //
    // Disconnect from Twitch Chat
    //
    function disconnect() {
        chatPlugin.chatDisconnect(function (e, error) {
            console.log("disconnect callbak:", e, error)
            document.querySelector('#status').innerText = "Status: Disconnected from chat";
        });

    }
})();