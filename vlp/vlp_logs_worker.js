'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const file = process.argv[2]
const es_host = process.argv[3]
const es_index = process.argv[4]

const caniload_interval = 5000
const howmany = 10000

const fs = require('fs')
const zlib = require('zlib');
const readline = require('readline');
const elasticsearch = require('elasticsearch')

const elastic = new elasticsearch.Client({
  host: es_host
  //, log: 'trace'
})

var action = { index: { _index: es_index } }
action = JSON.stringify(action)
var bulk_queue = []
var loading = false
var caniload_set

var inserted = 0

function init() {
  caniload_set = setInterval(caniload, caniload_interval)
  extract(file)
}

function caniload() {
  if (!loading && bulk_queue.length) {
    loading = true

    bulk_queue.length && load(bulk_queue.splice(0, howmany))
    bulk_queue.length && load(bulk_queue.splice(0, howmany))
    // bulk_queue.length && load(bulk_queue.splice(0, howmany))
  }
}

function extract (file) {
  const rl = readline.createInterface( {
    input: fs.createReadStream(file).pipe(zlib.createGunzip()) 
  })
  rl.on('line', (line) => { 
    if (!line.startsWith('#Fields:')) {
      transform(line)
    }
  })
  rl.on('close', () => {
    log('close', file)

    caniload()
    clearInterval(caniload_set)
  })
}

function transform (line) {
  var line = line.split(' ')

  var time = line[0]
  var c_ip = line[2]
  var sc_status = line[6]
  var bytes = line[7]
  var method = line[8]
  var cs_uri_stem = line[9]
  var user_agent = line.slice(14, line.length - 3).join(' ').replace(/"/g, '')

  var d = new Date(time * 1000)
  var timestamp = d.toJSON()

  var sc_status_split = sc_status.split('/')
  var http_status = sc_status_split[1]

  bytes == '-' ? bytes = 0 : bytes = Number(bytes)

  var cs_uri_stem_split = cs_uri_stem.split('/')
  var cname = cs_uri_stem_split[2]

  var path = '-'
  if (cs_uri_stem_split.slice(3)) {
    path = cs_uri_stem_split.slice(4).join('/')
  }

  var doc = {}

  doc.timestamp = timestamp
  doc.bytes = bytes
  doc.c_ip = c_ip
  doc.cname = cname
  doc.http_status = http_status
  doc.method = method
  doc.path = path
  doc.user_agent = user_agent

  // log(doc)
  
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