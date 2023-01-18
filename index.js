// Import Libraries
const fs = require('fs')
const http = require('http')
const express = require('express')
const { Server } = require("socket.io")

// Express & socket.io Initlization
const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Configurations
const serverPort = 3000
const shareRoot = "G:\\Documents\\Saves\\Music"
const frontRoot = __dirname+"\\Frontend"

// Tool Functions
function getFileList(path){
    let dirs = []
    let files = []
    let toread = shareRoot+path
    let names = fs.readdirSync(toread)

    for (let name of names){
        let stat = fs.statSync(toread+"\\"+name)
        if (stat.isFile() && name.endsWith('.mp3')){ // Song Then Push To Files
            files.push(name)        
        }else if (stat.isDirectory()){ // Otherwise push to dirs
            dirs.push(name)
        }
    }
    return [dirs,files]
}

function dbglog(...args){
    let debug = true
    if (debug){
        console.log(...args)
    }
}

// Binding Socket Events
sockets  = []
playlist = []
whatToPlayers = []
io.on('connection',(socket)=>{
    dbglog('[socket] A New Player Entered Server in Single Mode')

    socket.on('join',()=>{
        sockets.push(socket)
        socket.emit('fetchList',playlist)
        dbglog('[socket] A New Sync Player , Now With',sockets.length)
        if (sockets.length!=0){
            whatToPlayers.push(socket)
            sockets[0].emit("askPlaying")
        }
    })
    socket.on('disconnect',()=>{
        let index = sockets.indexOf(socket)
        if (index==-1)return
        sockets.splice(index,1)
        dbglog('[socket] A Sync Player Just Left , Now With',sockets.length)
    })
    socket.on('leave',()=>{
        let index = sockets.indexOf(socket)
        sockets.splice(index,1)
        dbglog('[socket] A Sync Player Just Left , Now With',sockets.length)
    })
    socket.on('setPlaying',(src,playTime,playing)=>{
        dbglog('[socket] setPlaying called')
        for (let s of sockets){
            s.emit('setPlaying',src,playTime,playing)
        }
    })
    socket.on('setWhat',(src,playTime,playing)=>{
        dbglog('[socket] setWhat called')
        for (let s of whatToPlayers){
            s.emit('setPlaying',src,playTime,playing)
        }
        whatToPlayers = []
    })
    socket.on('setList',(newList)=>{
        playlist = newList
        for (let s of sockets){
            s.emit('fetchList',newList)
        }
    })
})

// Bind Routers
app.get(/explore.*/,(req,res)=>{
    let url = decodeURI(req.url)
    url = url.slice(url.search('/explore')+'/explore'.length)
    if (!fs.existsSync(shareRoot+url)){
        res.send("404 Nothing Was Found")
        return
    }
    let stat = fs.statSync(shareRoot+url)
    if (stat.isFile()){
        res.sendFile(shareRoot+url.replace("/","\\"))
    }else if(stat.isDirectory()){
        res.json(getFileList(url.replace("/","\\")))
    }
})

app.get(/.*/,(req,res)=>{
    let url = decodeURI(req.url)
    let askFile = frontRoot+url.replace("/","\\")

    if (!fs.existsSync(askFile)){
        res.redirect("/index.html")
        return
    }
    if (fs.statSync(askFile).isFile()){
        res.sendFile(askFile)
        return
    }else{
        res.redirect("/index.html")
        return
    }
})

// Start Listening
server.listen(serverPort,()=>{
    console.log("listening on *:3000")
})