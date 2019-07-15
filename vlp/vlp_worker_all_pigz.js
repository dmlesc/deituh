'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const file = process.argv[2]
const { spawn } = require('child_process')
const howmany = 10000

var first = ''
var last = ''
var zero = ''
var logs = []


function init() {
  //log('worker_init')

  extract(file)
}

function extract (file) {
  var cmd = 'pigz -dc ' + file
  
  const child = spawn('sh', ['-c', cmd])
  child.stdout.on('data', (data) => {
    assemble_chunk(data.toString('utf8'))
  })
  child.stderr.on('data', (data) => { log('stderr', data.toString('utf8')) })
  child.on('close', (code) => { //log('pigz_exit_code', code)
    process.send({
      type:'logs',
      data: logs
    })
  })
}

function assemble_chunk (chunk) {
  var lines = chunk.split('\n')

  first = lines[0]
  zero = last + first
  last = lines[lines.length - 1]

  lines[0] = zero

  for (var i=0; i<lines.length - 1; i++) {
    var line = lines[i]
    
    if (!line.startsWith('#Fields:')) {
      transform(line)
    }
  }
}

function transform (line) {
  var line = line.split(' ')

  var time = line[0]
  var sc_status = line[6]

  var sc_status_split = sc_status.split('/')
  var cache_status = sc_status_split[0]
  var http_status = sc_status_split[1]
  var sc_bytes = line[7]
  var cs_uri_stem = line[9]
  var cs_uri_stem_split = cs_uri_stem.split('/')
  var cname = cs_uri_stem_split[2]


  if (sc_bytes == '-') {
    sc_bytes = 0
  }
  else {
    sc_bytes = Number(sc_bytes)
  }

  var c_user_agent = line.slice(14, line.length - 3).join(' ').replace(/"/g, '')
  
  /*
  var time_taken = line[1]
  var filesize = line[3]
  var s_port = line[5]
  var rs_duration = line[11]
  var rs_bytes = line[12]
  var c_referrer = line[13]
  */

  var c_ip = line[2]
  var s_ip = line[4]
  var cs_method = line[8]
  var uri_path = '-'
  if (cs_uri_stem_split.slice(3)) {
    uri_path = cs_uri_stem_split.slice(3).join('/')
  }

  var message = {}

  /*
  message.cs_uri_stem = cs_uri_stem
  message.time_taken = time_taken
  message.filesize = filesize
  message.sc_status = sc_status
  message.sc_bytes = sc_bytes
  message.rs_duration = rs_duration
  message.rs_bytes = rs_bytes
  message.c_referrer = c_referrer
  */

  message.c_ip = c_ip
  message.s_ip = s_ip
  message.cs_method = cs_method
  message.c_user_agent = c_user_agent
  message.cache_status = cache_status
  message.http_status = http_status
  message.cname = cname
  message.uri_path = uri_path

  var d = new Date(time * 1000)
  var timestamp = d.toJSON()
  message.timestamp = timestamp

  //log(message)
  
  logs.push(message)

  if (logs.length == howmany) {
    // log('send', logs.length)

    process.send({
      type:'logs',
      data: logs.splice(0, howmany)
    })

  }
}


init()