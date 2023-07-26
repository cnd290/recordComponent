const template = document.createElement('template');
template.innerHTML = `
  <style>
    #btnContainer {
        background-color: #5e7280;
        width: 30vw;
        height: 10vh;
        border-radius: 10px;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.35vw;
    }

    #recordBtn {
        background-color: white;
        border: 0px;
        width: 1.7vw;
        height: 1.7vw;

        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 50%;
    }
    
    #recordBtn:disabled {
        background-color: rgb(182, 183, 184)
    }
    
    #recordBtn img {
        width: 1.8vw;
        height: 1.8vw;
    }

    #recordStartImg {
        display: block;
    }

    #recordStopImg {
        display: none;
    }

    #recordDisableImg {
        display: none;
    }

  </style>

  <div class="recorder-component">
    <div id="btnContainer">
        <button id="shareScreen">Capture Screen</button>

        <button id="rec" disabled>Record</button>
        <button id="stop" disabled>Stop</button>
        <button id="recordBtn">
            <img crossorigin="anonymous" title="Record" id="recordStartImg" src="https://i.imgur.com/zFzaXMZ.png">
            <img title="Record stop" id="recordStopImg" src="img_Reference/recordPause.png">
            <img title="Record" id="recordDisableImg" src="img_Reference/recordDisable.png">
        </button>

        <button id="alter">Alter record</button>
        <button id="end" disabled>End</button>
        <a id="downloadLink" download="mediarecorder" name="mediarecorder" href></a>
    </div>
    <div id="error"></div>
  </div>
`;

//import FFmpeg
const { createFFmpeg, fetchFile } = FFmpeg; //抓function出來
const ffmpeg = createFFmpeg({ log: true }); //用function來建立ffmpeg工具
async function loadffmpeg(){
    await ffmpeg.load();                    //load工具所需要的東西
}
loadffmpeg();

class recordCom extends HTMLElement {
    constructor() {
        super();

        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.mediaRecorder;
        this.localStream = null;
        this.screenStream = null;
        this.micStream = null;
        this.chunks = [];
        this.alterSou = true;
        this.downloadLink = this.shadowRoot.querySelector("#downloadLink");
        this.shadowRoot.querySelector('#error').innerHTML = "";


    }

    //選擇要不要錄製麥克風聲音
    alterSound() {
        if (this.alterSou == true) {
            this.alterSou = false;
        } else {
            this.alterSou = true;
        }
        console.log(this.alterSou)
    }

    shareScreen() {
        this.shadowRoot.querySelector('#error').innerHTML = "";
        let thisObj = this;
        /* use the screen & audio stream */
        //系統背景要不要錄製聲音可以在分享螢幕的時候選擇
        
        // let screenConstraints = { video: true, audio: true };
        let screenConstraints = { video: { width: 1917, height: 1080 }, audio: { sampleRate: 48000, sampleSize: 16 }}; //讓畫面畫質變好 audio: true
        // let screenConstraints = { video: { width: 1920, height: 1080 }, audio: { sampleRate: 48000, sampleSize: 16 } };  //讓畫面畫質和音質更好

        navigator.mediaDevices.getDisplayMedia(screenConstraints).then(function(screenStream) {
            thisObj.screenStream = screenStream;

            //按預設的停止共享按鈕 要重置
            screenStream.getVideoTracks()[0].addEventListener("ended", () => {
                console.log("end");
                //各個按鈕要重置
                thisObj.stopShareBtnStatus();
            })

        }).then(function() {
            thisObj.shadowRoot.querySelector('#rec').disabled = false;
            thisObj.shadowRoot.querySelector('#shareScreen').disabled = true;
            thisObj.shadowRoot.querySelector('#stop').disabled = true;
            thisObj.shadowRoot.querySelector('#end').disabled = false;

        }).catch(function(err) {
            console.log(err);
            thisObj.shadowRoot.querySelector('#error').innerHTML = "You need to share your screen to run the demo";
            thisObj.reset();
        });
    }

    shareMic() {
        return new Promise((resolve) => {
            let thisObj = this;

            /* use the microphone stream */
            // let micConstraints = { audio: true };
            let micConstraints = {audio: { sampleRate: 48000, sampleSize: 16 }} //讓音質更好

            if (this.alterSou == true) { //如果有要錄製麥克風聲音的話
                console.log("in SOUND")
                navigator.mediaDevices.getUserMedia(micConstraints).then(function(micStream) {

                    //check to see if we have a microphone stream (audio) and only then add it
                    if (micStream && micStream.getAudioTracks().length > 0) {
                        thisObj.micStream = micStream;
                        resolve(true);
                    }

                })
            } else {
                resolve(false);
            }
        })
    }

    onCombinedStreamAvailable(...streams) {

        let thisObj = this;

        thisObj.localStream = new MediaStream();

        //create new Audio Context
        //create new MediaStream destination. create a new MediaStreamAudioDestinationNode object associated with a MediaStream representing an audio stream
        let context = new AudioContext();
        const audioDestination = context.createMediaStreamDestination();

        for (let stream of streams) {
            console.log("STUCK!");
            if (stream === null) continue;
            //videoTracks combine
            const videoTracks = stream.getVideoTracks();
            if (videoTracks && videoTracks.length > 0) {
                //add the screen video stream
                videoTracks.forEach(function(videoTrack) {
                    thisObj.localStream.addTrack(videoTrack);
                });
            }

            
            const audioTracks = stream.getAudioTracks();
            if (audioTracks && audioTracks.length > 0) {
                //建立此stream的MediaStreamAudioSourceNode物件 -> AudioContext的createMediaStreamSource() 方法用於創建一個新的 MediaStreamAudioSourceNode物件，需要傳入一MediaStream 
                const audioSource = context.createMediaStreamSource(stream);

                //add it to the destination 
                audioSource.connect(audioDestination);
            }

        }

        //combine audio stream
        audioDestination.stream.getAudioTracks().forEach(function(audioTrack) {
            console.log(audioTrack)
            thisObj.localStream.addTrack(audioTrack);
        });

    }

    // 按下capture screen後會將螢幕錄影Stream(畫面 & 系統背景音)放入screenStream

    // 按下record
    // 會先進行shareMic (看現在alter是否開啟，若開啟會匯入麥克風stream到micStream當中)
    // 接下來onCombinedStreamAvailable串接所有stream(螢幕與麥克風) 好後，存到localStream
    // =>這邊一樣onBtnRecordClicked中有判斷如果麥克風有share就會combine螢幕與麥克風，如果沒有就進行螢幕stream串接 (若沒有錄製系統背景音 screenStream也不會有audioTrack)
    // 最後就是把localStream放入錄製器中並且進行一些錄音的設置醬子
    onBtnRecordClicked() {
        this.shareMic().then((isMicShared) => { //true或false
            if (isMicShared == true) {
                this.onCombinedStreamAvailable(this.screenStream, this.micStream);
                console.log("isMicShared:" + isMicShared);
            } else {
                this.onCombinedStreamAvailable(this.screenStream);
                console.log("isMicShared:" + isMicShared);
            }
        }).then(() => {
            this.downloadLink.innerHTML = "";
            let thisObj = this;
            console.log("onBtnRecordClicked");

            if (this.localStream != null) {
                this.mediaRecorder = new MediaRecorder(this.localStream);

                this.mediaRecorder.ondataavailable = function(e) {
                    thisObj.chunks.push(e.data);
                }

                this.mediaRecorder.start(); //mediaRecorder.start(2)

                // console.log(this.mediaRecorder.state);

                this.shadowRoot.querySelector('#rec').style.background = "red";
                this.shadowRoot.querySelector('#rec').style.color = "black";

                this.shadowRoot.querySelector('#rec').disabled = true;
                this.shadowRoot.querySelector('#shareScreen').disabled = true;
                this.shadowRoot.querySelector('#stop').disabled = false;
                this.shadowRoot.querySelector('#alter').disabled = true;

            } else {
                console.log("localStream is missing");
            }
        });
    }

    onBtnStopClicked() {
        let thisObj = this;
        this.mediaRecorder.onstop = async function() {
            console.log("mediaRecorder.onstop");

            let blob = new Blob(thisObj.chunks, { type: "video/webm" });
            thisObj.chunks = [];


            thisObj.transcode(new Uint8Array(await (blob).arrayBuffer())); //webm轉成mp4 


            let videoURL = window.URL.createObjectURL(blob);

            // thisObj.downloadLink.href = videoURL;
            // thisObj.downloadLink.innerHTML = "Download video file";
        }

        this.shadowRoot.querySelector('#rec').disabled = false;
        this.shadowRoot.querySelector('#shareScreen').disabled = true;
        this.shadowRoot.querySelector('#stop').disabled = true;
        this.shadowRoot.querySelector('#alter').disabled = false;


        this.mediaRecorder.stop();
        // console.log(this.mediaRecorder.state);
        // console.log("recorder stopped");

        this.shadowRoot.querySelector('#rec').style.background = "";
        this.shadowRoot.querySelector('#rec').style.color = "";

        // 按下stop則會清空localStream
        this.localStream = null;

    }


    async transcode(webmArr) {
        const name = "recordName";
        ffmpeg.FS('writeFile', name, await fetchFile(webmArr));
        await ffmpeg.run('-i', name, '-max_muxing_queue_size', '1024', 'output.mp4');
        const data = await ffmpeg.FS('readFile', 'output.mp4');
        // const video = document.getElementById('player');
        // video.src = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

        let videoURL = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        this.downloadLink.href = videoURL;
        this.downloadLink.innerHTML = "Download video file";
        // this.downloadLink.click(); //可以到時候寫一個button 在這時候才出現一個下載按鈕 然後點了會處發這個this.downloadLink.click() 然後this.downloadLink.innerHTML可以註解掉


        //     // 生成 Blob 的網址
        // let href = URL.createObjectURL(blob);

        // // 生成 html 超連結（Blob網址）標籤，放入body
        // let link = document.createElement("a");
        // document.body.appendChild(link);
        // link.href = href;
        // link.download = fileName;
        // // 手動 click
        // link.click();
    }




    endSharing() {


        // let thisObj = this;
        // if (this.screenStream) {
        //   this.screenStream.getVideoTracks().forEach(function(videoTrack) {
        //     videoTrack.stop();
        //     thisObj.stopShareBtnStatus(thisObj.shadowRoot);
        //   });
        // }

        // 隱藏 Chrome 的通知欄
        if (typeof chrome !== "undefined" && chrome.notifications) {
            chrome.notifications.clear("screenShareNotification");
        }
        this.stopShareBtnStatus();



        // 停止所有的影音串流 (MediaStream)
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
        }

    }

    reset() {
        this.shadowRoot.querySelector('#rec').disabled = true;
        this.shadowRoot.querySelector('#shareScreen').disabled = false;
        this.shadowRoot.querySelector('#stop').disabled = true;
        this.shadowRoot.querySelector('#alter').disabled = false;
        this.shadowRoot.querySelector('#end').disabled = true;
    }

    stopShareBtnStatus() {
        this.shadowRoot.querySelector('#rec').disabled = true;
        this.shadowRoot.querySelector('#shareScreen').disabled = false;
        this.shadowRoot.querySelector('#stop').disabled = true;
        this.shadowRoot.querySelector('#alter').disabled = false;
        this.shadowRoot.querySelector('#end').disabled = true;
        this.downloadLink.innerHTML = "";
    }

    connectedCallback() {
        this.shadowRoot.querySelector('#shareScreen').addEventListener('click', () => this.shareScreen());
        this.shadowRoot.querySelector('#rec').addEventListener('click', () => this.onBtnRecordClicked());
        this.shadowRoot.querySelector('#stop').addEventListener('click', () => this.onBtnStopClicked());
        this.shadowRoot.querySelector('#alter').addEventListener('click', () => this.alterSound());
        this.shadowRoot.querySelector('#end').addEventListener('click', () => this.endSharing());
    }

    disconnectedCallback() {
        this.shadowRoot.querySelector('#shareScreen').removeEventListener();
    }
}

window.customElements.define('recorder-component', recordCom);
