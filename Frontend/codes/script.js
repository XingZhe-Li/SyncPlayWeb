player = new Audio()
socket = io()

document.addEventListener("alpine:init",()=>{
    data = Alpine.reactive({
        playPercent:0, // For Display Only
        view:0,  // source , playlist
        mode:0,  // repeat , repeat-1 , shuffle
        playing:false,   // For Display Only
        volume:100,      // volume
        playlist:[],     // Playlist
        playindex:-1,    // Now Playing Which One (For Display Only)
        nowat:"",         // Now At which directory
        explore:[[],[]],  // [dirs,files]
        sync:false,
        volsetter:false,
        rangable:true // If syncPlayer function Can change the timer now
    })
})

// Tool Functions
function randint(a,b){ // a int between [a,b]
    return Math.round(Math.random()*(b-a))+a
}

function getNameByUrl(url){
    return url.slice(url.lastIndexOf('/')+1)
}

function secToMs(time){
    let min = Math.floor(time/60).toString()
    let sec = parseInt(time%60).toString()
    if (min.length==1) min = '0'+min
    if (sec.length==1) sec = '0'+sec
    return min+':'+sec
}

function getFileUrlByUrl(url){ //returns in '/Music/xxx'
    let ret = url.slice(url.search("/explore")+8)
    return decodeURI(ret)
}

// Player Control
function modeSwitch(){
    if (data.sync){
        alert("同步模式仅支持列表循环")
        if (data.mode!=0)data.mode=0
        return
    }
    data.mode += 1
    if (data.mode>=3 || data.mode < 0){
        data.mode = 0
    }
}

function getNextSong(){ // return the url of next song
    let src = getFileUrlByUrl(player.src)
    let foundInList = data.playlist.includes(src)
    if (data.sync && data.mode!=0)data.mode = 0
    if (data.mode==0){ // repeat
        if (foundInList){
            let NextIndex = data.playlist.indexOf(src)+1
            if (NextIndex>=data.playlist.length){
                return data.playlist[0]
            }
            return data.playlist[NextIndex]
        }else if(data.playlist.length==0){
            return ""
        }else{
            return data.playlist[randint(0,data.playlist.length-1)]
        }
    }else if(data.mode==1){ // repeat-1
        return src
    }else if(data.mode==2){ // shuffle
        if (data.playlist.length==0){
            return ""
        }else{
            return data.playlist[randint(0,data.playlist.length-1)]
        }
    }
}

function playAndSetFolder(name){
    setListToFolder()
    player.src = "/explore"+data.nowat+"/"+name
    player.play()
    onlineSetPlaying()
}

function playerToggle(){
    let src = player.src
    if (src==""){
        let nextSrc = getNextSong()
        if (nextSrc!=""){
            player.src = "/explore"+nextSrc
            player.play()
        }
    }else{
        if (player.paused)player.play()
        else player.pause()
    }
    onlineSetPlaying()
}

function playSong(url){
    let src = getFileUrlByUrl(player.src)
    if (src==url)return 
    player.src = "/explore"+url
    player.play()
    onlineSetPlaying()
}

function playerSeek(percent){
    if (isNaN(player.duration))return
    let seekTime = player.duration * percent / 100
    player.currentTime = seekTime
    onlineSetPlaying()
}

function playerAutoNext(){
    let nextSrc = getNextSong()
    if (nextSrc!=""){
        player.src = "/explore"+nextSrc
        player.play()
        data.rangable = true
    }
}
player.addEventListener('ended',playerAutoNext)

// File Management
async function getFileList(path){
    if (path==".."){
        data.nowat = data.nowat.slice(0,data.nowat.lastIndexOf('/'))
    }else if (typeof path=='string'){
        data.nowat += "/"+path
    }
    let explore = (await fetch("/explore"+data.nowat))
    explore = await explore.json()
    data.explore = explore
}

// Playlist Control
function pushSong(name){
    let topush = data.nowat+'/'+name
    if (!data.playlist.includes(topush)){
        data.playlist.push(topush)
        onlineSetList()
    }else{
        alert(name+' Is Already In Your Playlist')
    }
}

function setListToFolder(){
    let newList = []
    for (let name of data.explore[1]){
        newList.push(data.nowat+'/'+name)
    }
    data.playlist = newList
    onlineSetList()
}

function clearList(){
    if (confirm(`${data.playlist.length} songs will be removed`)){
        data.playlist = []
        onlineSetList()
    }
}

function pushFolderToList(){
    let count = 0; 
    for (let name of data.explore[1]){
        let topush = data.nowat+'/'+name
        if (!data.playlist.includes(topush)){
            data.playlist.push(topush)
            count ++
        }
    }
    onlineSetList()
    alert(`${count} / ${data.explore[1].length} Pushed To Playlist`)
}

function popSong(url){
    if (data.playlist.includes(url)){
        let index = data.playlist.indexOf(url)
        data.playlist.splice(index,1)
        onlineSetList()
    }
}

// For Animation
function volSetOn(){
    if (!data.volsetter){
        data.volsetter = true
        let volsetter = document.querySelector('.play-vol-range')
        setTimeout(()=>{
            volsetter.focus()
        },50)
    }
}

function volSetOff(){
    let volsetter = document.querySelector('.play-vol')
    volsetter.style = "transform:scale(0.9) rotate(-90deg);opacity:0;"
    setTimeout(() => {
        data.volsetter = false
        volsetter.style = ""
    }, 200);
}

// Checkers
function syncPlayIndex(){
    let playingSrc = getFileUrlByUrl(player.src)
    if (data.playlist.includes(playingSrc)){
        let playingIndex = data.playlist.indexOf(playingSrc)
        if (data.playindex!=playingIndex){
            data.playindex = playingIndex
        }
    }else{
        data.playindex = -1
    }
}

function syncPlayerWithAudio(){
    data.playing = !player.paused
    // sync playing state
    if (isNaN(player.duration)){
        data.playPercent = 0
        cur = "00:00" ; len = "00:00"
    }else{
        if (data.rangable){
            data.playPercent = player.currentTime / player.duration *100
        }
        var cur = secToMs(player.currentTime)
        var len = secToMs(player.duration)
    }
    let playTime = document.querySelector('.play-time')
    playTime.textContent = cur+"/"+len
    // sync playing time
}

// Sync Playing
function onlineSetList(){
    if (!data.sync)return
    socket.emit('setList',data.playlist)
}

function onlineSetPlaying(){
    if (!data.sync)return
    socket.emit('setPlaying',player.src,player.currentTime,!player.paused)
}

socket.on('fetchList',(newList)=>{
    data.playlist = newList
})

socket.on('setPlaying',(src,playTime,playing)=>{
    player.src = src
    player.currentTime = playTime
    if (playing && player.paused)player.play()
    else if(!playing && !player.paused)player.pause()
})

socket.on('askPlaying',()=>{
    socket.emit('setWhat',player.src,player.currentTime,!player.paused)
})

function JoinSync(){
    if (confirm(" Join Sync Now? You Will Lost Your Playlist")){
        data.mode=0
        data.sync=true
        socket.emit("join")
    }
}

function QuitSync(){
    if (confirm(" Quit Sync Now? Then You Will be Switched into Single Mod")){
        socket.emit("leave")
        data.sync = false
    }
}

// HOOKS (Event Bindings)
document.addEventListener("DOMContentLoaded",()=>{
    getFileList()
    setInterval(() => {
        syncPlayerWithAudio()
        syncPlayIndex()
    }, 100);
})