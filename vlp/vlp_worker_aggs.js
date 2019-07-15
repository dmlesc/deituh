'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const file = process.argv[2]
const es_host = process.argv[3]
const es_index = process.argv[4]

const caniload_interval = 5000

const fs = require('fs')
const zlib = require('zlib');
const readline = require('readline');
const elasticsearch = require('elasticsearch')

const elastic = new elasticsearch.Client({
  host: es_host
  //, log: 'trace'
})

const { spawn } = require('child_process')
const howmany = 10000

var action = { index: { _index: es_index } }
action = JSON.stringify(action)
var bulk_queue = []
var loading = false
var caniload_set

var first = ''
var last = ''
var zero = ''
var logs = []

var inserted = 0

function init() {
  caniload_set = setInterval(caniload, caniload_interval)
  extract(file)
}

function caniload() {
  if (!loading && bulk_queue.length) {
    loading = true
    load(bulk_queue.splice(0, howmany))
    load(bulk_queue.splice(0, howmany))
    load(bulk_queue.splice(0, howmany))
  }
}

function extract (file) {
  const rl = readline.createInterface( {
    input: fs.createReadStream(file).pipe(zlib.createGunzip()) 
  })
  rl.on('line', (line) => { 
    transform(line)
  })
  rl.on('close', () => {
    log('close', file)

    caniload()
    clearInterval(caniload_set)
  })
}

function extract_pigz (file) {
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
  message.rs_duration = rs_duration_
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

  // log(message)
  
  bulk_queue.push(JSON.stringify(message))
}

function load_off (doc) {
  // console.log('doc:', doc)

  bulk_queue.push(action)
  bulk_queue.push(JSON.stringify(doc))
}

function load (docs) {
  var body = []

  for (var i=0; i<docs.length; i++) {
    body.push(action)
    body.push(docs[i])
  }

  var params = {
    index: es_index, 
    body: body.join('\n')
  }

  elastic.bulk(params, (err, res) => {
    if (err) {
      log('elastic.bulk error:', err.stack)
    }
    else {
      if (res.errors) {
        log('res', res)
        log('items[0]', res.items[0].index)
      }

      inserted+=docs.length

      log('inserted', inserted)
      log('bulk_queue', bulk_queue.length)

      if (bulk_queue.length) {
        load(bulk_queue.splice(0, howmany))
      }
      else {
        loading = false
      }
    }
  })
}

init()