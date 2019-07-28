'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const file = process.argv[2]
const decompress_method = process.argv[3]
const aggs_field = process.argv[4]
const { spawn } = require('child_process')
const fs = require('fs')
const zlib = require('zlib');
const readline = require('readline');


var first = ''
var last = ''
var zero = ''

var aggregations = {
  overall: {}
}

var aggs_skel = {
  '2xx': 0,
  '3xx': 0,
  '4xx': 0,
  '5xx': 0,
  bytes_sent: 0
}

var extract
decompress_method == 'pigz' ? extract = extract_pigz : extract = extract_zlib


function init() {
  extract(file)
}

function extract_pigz (file) {
  var cmd = 'pigz -dc ' + file
  
  const child = spawn('sh', ['-c', cmd])
  child.stdout.on('data', (data) => {
    assemble_chunk(data.toString('utf8'))
  })
  child.stderr.on('data', (data) => { log('stderr', data.toString('utf8')) })
  child.on('close', (code) => {
    worker_on_close()
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

function extract_zlib (file) {
  const rl = readline.createInterface( {
    input: fs.createReadStream(file).pipe(zlib.createGunzip()) 
  })
  rl.on('line', (line) => { 
    if (!line.startsWith('#Fields:')) {
      transform(line)
    }
  })
  rl.on('close', () => {
    worker_on_close()
  })
}

function transform (line) {
  var line = line.split(' ')

  var time = line[0]
  var sc_status = line[6]
  var bytes = line[7]
  var cs_uri_stem = line[9]

  var sc_status_split = sc_status.split('/')
  var http_status = sc_status_split[1]

  bytes == '-' ? bytes = 0 : bytes = Number(bytes)

  var min = Math.round(time / 60) * 60
  var minute = min.toString()

  increment_fields(aggregations.overall, minute, bytes, http_status)

  var field_value

  switch(aggs_field) {
    case 'cname':
      var cs_uri_stem_split = cs_uri_stem.split('/')
      var cname = cs_uri_stem_split[2]
      field_value = cname
      break
    
    case 'user_agent':
      var user_agent = line.slice(14, line.length - 3).join(' ').replace(/"/g, '')
      field_value = user_agent
      break
      
    case 'c_ip':
      var c_ip = line[2]
      field_value = c_ip
      break
  }

  if (!aggregations[field_value]) {
    aggregations[field_value] = {}
  }

  increment_fields(aggregations[field_value], minute, bytes, http_status)
}

function increment_fields (aggs, minute, bytes, http_status) {
  if (!aggs[minute]) {
    aggs[minute] = JSON.parse(JSON.stringify(aggs_skel))
  }

  var range = http_status[0] + 'xx'
  aggs[minute][range]++
  aggs[minute].bytes_sent += bytes
}

function worker_on_close () {
  var key
  for (key in aggregations) {
    finish_aggs(key, aggregations[key])
  }
}

function finish_aggs (key, aggs) {
  var minute

  for (minute in aggs) {
    var metrics = aggs[minute]
    var total = metrics['2xx'] + metrics['3xx'] + metrics['4xx'] + metrics['5xx']
    var err_rate = (metrics['5xx'] / total) * 100

    metrics.total = total
    metrics.err_rate = err_rate
    metrics.aggs_key = key

    metrics.timestamp = (new Date(minute * 1000)).toJSON()
  }

  // log('aggs\n\n', aggs)

  process.send({
    type:'aggs',
    data: aggs
  })
}


init()