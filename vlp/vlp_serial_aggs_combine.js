'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const serial_aggs_path = process.argv[2]
const serial_aggs_combined_path = process.argv[3]
var serial_aggs_combined_file

const fs = require('fs')
const zlib = require('zlib');
const readline = require('readline')

var serial_aggs = {
  post: { requests: 0 }
}

var unique_serials = 0
var undone_files


function init() {
  undone_files = fs.readdirSync(serial_aggs_path)
  log('undone_files', undone_files)

  var first = undone_files[0].split('.')[0]
  var last = undone_files[undone_files.length -1].split('.')[0].split('serial_aggs_')[1]
  serial_aggs_combined_file = serial_aggs_combined_path + first + '-' + last + '.gz'

  extract(serial_aggs_path + undone_files.shift())
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

    if (undone_files.length) {
      extract(serial_aggs_path + undone_files.shift())
    }
    else {
      load()
    }
  })
}

function transform (line) {
  var line = line.split(' ')

  var serial = line[0]
  var requests = Number(line[1])

  if (!serial_aggs[serial]) {
    serial_aggs[serial] = { requests: 0 }
    unique_serials++
  }

  serial_aggs[serial]['requests'] += requests
}

function load () {
  var serial_arr = []

  var key

  for (key in serial_aggs) {
    var txt = key + ' ' + serial_aggs[key].requests
    serial_arr.push(txt)
  }

  fs.writeFileSync(serial_aggs_combined_file, zlib.gzipSync((serial_arr.join('\n'))))
}


init()