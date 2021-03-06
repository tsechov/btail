#!/bin/sh
":" //# comment; exec /usr/bin/env node --harmony "$0" "$@"

/*!
 * server.js
 * Created by Kilian Ciuffolo on Oct 26, 2014
 * (c) 2014-2015
 */

'use strict'

const dgram = require('dgram')
const app = require('express')()
const serve = require('express').static
const http = require('http').Server(app)

const yargs = require('yargs')
const debug = require('debug')('rtail:server')
const webapp = require('./lib/webapp')
const updateNotifier = require('update-notifier')
const pkg = require('../package')

/*!
 * inform the user of updates
 */
updateNotifier({
  packageName: pkg.name,
  packageVersion: pkg.version
}).notify()

/*!
 * parsing argv
 */
let argv = yargs
  .usage('Usage: rtail-server [OPTIONS]')
  .example('rtail-server --web-port 8080', 'Use custom HTTP port')
  .example('rtail-server --udp-port 8080', 'Use custom UDP port')
  .example('rtail-server --web-version development', 'For debugging purposes during development')
//  .example('rtail-server --web-version unstable', 'Always uses latest develop webapp')
//  .example('rtail-server --web-version 0.1.3', 'Use webapp v0.1.3')
  .example('rtail-server --path /foo', 'serve via {HOST}:{PORT}/foo')
  .option('udp-host', {
    alias: 'uh',
    default: '127.0.0.1',
    describe: 'The listening UDP hostname'
  })
  .option('udp-port', {
    alias: 'up',
    default: 9999,
    describe: 'The listening UDP port'
  })
  .option('web-host', {
    alias: 'wh',
    default: '127.0.0.1',
    describe: 'The listening HTTP hostname'
  })
  .option('web-port', {
    alias: 'wp',
    default: 8888,
    describe: 'The listening HTTP port'
  })
  .option('web-version', {
    type: 'string',
    describe: 'Define web app version to serve'
  })
  .option('path', {
    type: 'string',
    describe: 'The path prefix to serve'
  })
  .help('help')
  .alias('help', 'h')
  .version(pkg.version, 'version')
  .alias('version', 'v')
  .strict()
  .argv

/*!
 * UDP sockets setup
 */
let streams = {}
let socket = dgram.createSocket('udp4')

socket.on('message', function (data, remote) {
  // try to decode JSON
  try { data = JSON.parse(data) }
  catch (err) { return debug('invalid data sent') }

  if (!streams[data.id]) {
    streams[data.id] = []
    io.sockets.emit('streams', Object.keys(streams))
  }

  let message = {
    timestamp: data.timestamp,
    streamid: data.id,
    host: remote.address,
    port: remote.port,
    content: data.content,
    type: typeof data.content
  }

  // limit backlog to 100 lines
  streams[data.id].length >= 100 && streams[data.id].shift()
  streams[data.id].push(message)

  debug(JSON.stringify(message))
  io.sockets.to(data.id).emit('line', message)
})


var io = require('socket.io')()

/*!
 * serve static webapp from S3
 */
var setupServer = function(path, sourceDir) {

    if(path) {
      app.use(path, serve(__dirname + sourceDir))
      io = require('socket.io')(http, {path: path + '/socket.io'})
      debug('serving from path: "%s"; sourceDir: "%s"', path, sourceDir)
    } else {
      app.use(serve(__dirname + sourceDir))
      io = require('socket.io')()
      debug('serving from path: "%s"; sourceDir: "%s"', '/', sourceDir)
    }

 }
if (!argv.webVersion) {
  if(argv.path) {
    var path = argv.path.startsWith('/') ? argv.path : '/' + argv.path
    setupServer(path, '/../dist')
  } else {
    setupServer(undefined, '/../dist')
  }
} else if ('development' === argv.webVersion) {
  setupServer('/app', '/../app')
  app.use('/node_modules', serve(__dirname + '/../node_modules'))
} else {
  throw new "only 'development' web-version is supported"
  app.use(webapp({
    s3: 'http://rtail.s3-website-us-east-1.amazonaws.com/' + argv.webVersion,
    ttl: 1000 * 60 * 60 * 6 // 6H
  }))

  debug('serving webapp from: http://rtail.s3-website-us-east-1.amazonaws.com/%s', argv.webVersion)
}

/*!
 * socket.io
 */
io.on('connection', function (socket) {
  socket.emit('streams', Object.keys(streams))
  socket.on('select stream', function (stream) {
    socket.leave(socket.rooms[0])
    if (!stream) return
    socket.join(stream)
    socket.emit('backlog', streams[stream])
  })
})

/*!
 * listen!
 */
io.attach(http, { serveClient: false })
socket.bind(argv.udpPort, argv.udpHost)
http.listen(argv.webPort, argv.webHost)

debug('UDP  server listening: %s:%s', argv.udpHost, argv.udpPort)
debug('HTTP server listening: http://%s:%s', argv.webHost, argv.webPort)
