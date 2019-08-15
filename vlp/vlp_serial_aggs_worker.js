'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const file = process.argv[2]
const serial_aggs_path = process.argv[3]
const serial_aggs_file = serial_aggs_path + 'serial_aggs_' + file.split('_').slice(1).join('_').replace('log.gz', '.gz')

const fs = require('fs')
const zlib = require('zlib');
const readline = require('readline')

var serial_aggs = {
  post: { requests: 0 }
}

var unique_serials = 0


function init() {
  extract(file)
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
    log('unique_serials', unique_serials)

    load()
  })
}

function transform (line) {
  var line = line.split(' ')

  var method = line[2]
  var path = line[6]

  if (path.startsWith('ocsp')) {
    if (method == 'GET') {
      var path_split = path.split('/')
      var serial

      if (path.includes('baltimoreroot')) {
        serial = path_split[2]
      }
      else {
        serial = path_split[1]
      }

      if (serial && serial.length == 32) {
        if (!serial_aggs[serial]) {
          serial_aggs[serial] = { requests: 0 }
          unique_serials++
        }

        serial_aggs[serial]['requests']++
      }
    }
    else if (method == 'POST') {
      serial_aggs.post.requests++
    }
  }
}


function load () {
  var serial_arr = []

  var key

  for (key in serial_aggs) {
    var txt = key + ' ' + serial_aggs[key].requests
    serial_arr.push(txt)
  }

  // fs.writeFileSync(serial_aggs_file, zlib.gzipSync(JSON.stringify(serial_aggs)))
  fs.writeFileSync(serial_aggs_file, zlib.gzipSync((serial_arr.join('\n'))))
}


init()