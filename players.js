var MAX_IDLE = 100
var IDLE_AFTER_TURNS = 2

// couchdb
var SERVER = 'swarmation.cloudant.com'
var PORT = 5984
var DB = 'players'
var AUTH = 'aWNoaW1tYXJldmlsaWNoaWNoYXRpb25kOlFTaXVhcENuT2huWGlTdlBTcG00RG9JcA=='

var sys = require('sys')
var http = require('http')

function makeRequest(method, path, message, callback) {
  message = JSON.stringify(message)
  var request = http.createClient(PORT, SERVER).request(method, '/'+DB+'/' + path, {
    'content-length': message ? message.length : null,
    'content-type': 'application/json',
    authorization: 'Basic ' + AUTH,
    host: SERVER + ':' + PORT
  })
  if (message) request.write(message)
  request.on('response', function(response) {
    var body = []
    response.on('data', function(chunk) {
      body.push(chunk)
    })
    response.on('end', function() {
      var resp = JSON.parse(body.join(''))
      callback(resp)
    })
  })
  request.end()
}

var PLAYERS = this.PLAYERS = {}

var Player = this.Player = function Player(client) {
    this.id = client.id
    this.client = client
    this.idleTurns = 0
}

Player.get = function(client) {
  if (!PLAYERS[client.id]) PLAYERS[client.id] = new Player(client)
  return PLAYERS[client.id]
}

Player.byId = function(id) {
  return PLAYERS[id]
}

Player.getList = function() {
  var list = []
  for (var id in PLAYERS) {
      list.push(PLAYERS[id].getInfo())
  }
  return list
}

Player.getActive = function() {
  var n = 0
  for (var id in PLAYERS) {
      if (!PLAYERS[id].idleTurns) n++
  }
  return n
}

Player.endTurn = function(socket) {
  for (var id in PLAYERS) PLAYERS[id].endTurn()
}

Player.prototype = {
  setInfo: function(info) {
    for (var key in info) {
      if ((key == 'id') || (key == 'type')) continue
      if ((info[key] !== undefined) && (info[key] !== null)) this[key] = info[key]
    }
  },

  getInfo: function() {
    return {
      id: this.id,
      left: this.left,
      top: this.top,
      name: this.name,
      score: this.score,
      total: this.total,
      succeeded: this.succeeded
    }
  },

  setActive: function() {
    this.active = true
  },

  endTurn: function() {
    if (this.active) {
      this.idleTurns = 0
    } else {
      if (this.idleTurns == IDLE_AFTER_TURNS) {
        this.client.emit('message', { type: 'idle', id: this.id })
        this.client.broadcast.emit('message', { type: 'idle', id: this.id })
      }
      this.idleTurns++
      if (this.idleTurns > MAX_IDLE) this.kick()
    }
    this.active = false
  },

  save: function(message) {
    if (!message._id) delete message._id
    if (!message._rev) delete message._rev
    delete message.type
    delete message.id
    var p = this
    makeRequest('POST', '', message, function(doc) {
      console.log(doc)
      if (doc.error == 'conflict') {
        sys.log('CONFLICT! ' + JSON.stringify(message))
      }
      if (doc.ok == true) p.client.emit('message', { type: 'saved', player: doc.id, rev: doc.rev })
    })
  },

  load: function(player) {
    if (!player) return
    var p = this
    makeRequest('GET', player, null, function(doc) {
      p.getInfo(doc)
      doc.type = 'info'
      doc.id = p.id
      p.client.emit('message', doc)
      p.client.broadcast.emit('message', doc)
    })
  },

  disconnect: function(sockets) {
    sockets.emit('message', { type: 'disconnected', id: this.id })
    delete PLAYERS[this.id]
  },

  kick: function(socket) {
    this.client.emit('message', { type: 'kick', reason: 'idle' })
    this.client.broadcast.emit('message', { type: 'disconnected', id: this.id })
    this.client.connection.end()
    delete PLAYERS[this.id]
  }

}
