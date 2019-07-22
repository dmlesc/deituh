'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const file = process.argv[2]
const { spawn } = require('child_process')
const aggs_conf = require('./aggs_conf')

var first = ''
var last = ''
var zero = ''
var logs = []

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

var key
for (key in aggs_conf) {
  var value = aggs_conf[key]
  aggregations[key] = {}

  var type
  for (type in value) {
    aggregations[key][type] = {
      match: value[type],
      aggs: {}
    }
  }
}


function init() {
  extract(file)
}

function extract (file) {
  var cmd = 'pigz -dc ' + file
  
  const child = spawn('sh', ['-c', cmd])
  child.stdout.on('data', (data) => {
    assemble_chunk(data.toString('utf8'))
  })
  child.stderr.on('data', (data) => { log('stderr', data.toString('utf8')) })
  child.on('close', (code) => {
    var key
    for (key in aggregations) {
      if (key == 'user_agent') {
        var type
        for (type in aggregations[key]) {
          finish_aggs(type, aggregations[key][type].aggs)
        }
      }
      else {
        finish_aggs(key, aggregations[key])
      }
    }
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
  var bytes = line[7]
  var cs_uri_stem = line[9]

  var sc_status_split = sc_status.split('/')
  var http_status = sc_status_split[1]

  var cs_uri_stem_split = cs_uri_stem.split('/')
  var cname = cs_uri_stem_split[2]

  if (bytes == '-') {
    bytes = 0
  }
  else {
    bytes = Number(bytes)
  }

  var user_agent = line.slice(14, line.length - 3).join(' ').replace(/"/g, '')
  
  var min = Math.round(time / 60) * 60
  var minute = min.toString()

  calc_aggs(aggregations.overall, minute, bytes, http_status)

  if (!aggregations[cname]) {
    aggregations[cname] = {}
  }
  calc_aggs(aggregations[cname], minute, bytes, http_status)

  var aggs = match_aggs(user_agent, 'user_agent')
  if (aggs) {
    calc_aggs(aggs, minute, bytes, http_status)
  }
}

function calc_aggs (aggs, minute, bytes, http_status) {
  if (!aggs[minute]) {
    aggs[minute] = JSON.parse(JSON.stringify(aggs_skel))
  }

  var range = http_status[0] + 'xx'
  aggs[minute][range]++
  aggs[minute].bytes_sent += bytes
}

function match_aggs (field, key) {
  var type
  for (type in aggregations[key]) {
    var value = aggregations[key][type]

    if (field.includes(value.match)) {
      return value.aggs
    }
  }

  return false
}

function finish_aggs (type, aggs) {
  var minute

  for (minute in aggs) {
    var metrics = aggs[minute]
    var total = metrics['2xx'] + metrics['3xx'] + metrics['4xx'] + metrics['5xx']
    var err_rate = (metrics['5xx'] / total) * 100

    metrics.total = total
    metrics.err_rate = err_rate
    metrics.aggs_type = type

    metrics.timestamp = (new Date(minute * 1000)).toJSON()
  }

  // log('aggs\n\n', aggs)

  process.send({
    type:'aggs',
    data: aggs
  })
}


init()