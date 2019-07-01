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
    // process.send({
    //   type:'logs',
    //   data: logs
    // })

    finish_aggs('overall', aggregations.overall)

    // var key
    // for (key in aggregations) {
    //   var type
    //   for (type in aggregations[key]) {
    //     finish_aggs(type, aggregations[key][type].aggs)
    //   }
    // }
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
  
  var min = Math.round(time / 60) * 60
  var minute = min.toString()

  // if (http_status.startsWith('5')) {
  //   /*
  //   var time_taken = line[1]
  //   var filesize = line[3]
  //   var s_port = line[5]
  //   var rs_duration = line[11]
  //   var rs_bytes = line[12]
  //   var c_referrer = line[13]
  //   */

  //   var c_ip = line[2]
  //   var s_ip = line[4]
  //   var cs_method = line[8]
  //   var uri_path = '-'
  //   if (cs_uri_stem_split.slice(3)) {
  //     uri_path = cs_uri_stem_split.slice(3).join('/')
  //   }

  //   var message = {}

  //   /*
  //   message.cs_uri_stem = cs_uri_stem
  //   message.time_taken = time_taken
  //   message.filesize = filesize
  //   message.sc_status = sc_status
  //   message.sc_bytes = sc_bytes
  //   message.rs_duration = rs_duration
  //   message.rs_bytes = rs_bytes
  //   message.c_referrer = c_referrer
  //   */

  //   message.time = time
  //   message.c_ip = c_ip
  //   message.s_ip = s_ip
  //   message.cs_method = cs_method
  //   message.c_user_agent = c_user_agent
  //   message.cache_status = cache_status
  //   message.http_status = http_status
  //   message.cname = cname
  //   message.uri_path = uri_path

  //   var d = new Date(time * 1000)
  //   var timestamp = d.toJSON()
  //   message.timestamp = timestamp

  //   //log(message)
    
  //   logs.push(message)
  // }

  calc_aggs(aggregations.overall, minute, sc_bytes, http_status)

  // var aggs = match_aggs(c_user_agent, 'user_agent')
  // if (aggs) {
  //   calc_aggs(aggs, minute, sc_bytes, http_status)
  // }

  // var aggs = match_aggs(cname, 'cname')
  // if (aggs) {
  //   calc_aggs(aggs, minute, sc_bytes, http_status)
  // }
}

function calc_aggs(aggs, minute, bytes, http_status) {
  if (!aggs[minute]) {
    aggs[minute] = JSON.parse(JSON.stringify(aggs_skel))
  }

  aggs[minute].bytes_sent += bytes
  
  if (http_status.startsWith('2')) {
    aggs[minute]['2xx']++
  }
  else if (http_status.startsWith('3')) {
    aggs[minute]['3xx']++
  }
  else if (http_status.startsWith('4')) {
    aggs[minute]['4xx']++
  }
  else if (http_status.startsWith('5')) {
    aggs[minute]['5xx']++
  }
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

function finish_aggs(type, aggs) {
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