'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const file = process.argv[2]
const reduced_path = process.argv[3]
const reduced_file = reduced_path + 'reduced_' + file.split('_').slice(2).join('_')

const fs = require('fs')
const zlib = require('zlib');
const readline = require('readline')

const { spawn } = require('child_process')


var cmd = 'gzip -9 > ' + reduced_file
  
const child = spawn('sh', ['-c', cmd])
child.stdout.on('data', (data) => {
  assemble_chunk(data.toString('utf8'))
})
child.stderr.on('data', (data) => { log('stderr', data.toString('utf8')) })
child.on('close', (code) => {
  log('close', reduced_file)
})


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

    child.stdin.end()
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

  if (method == 'GET' && path.startsWith('ocsp') && !path.includes('.crt') && path.length > 13) {
    var new_path = 'ocsp'
    var str

    if (path.includes('baltimoreroot')) {
      str = path.slice(19)
      new_path += '/baltimoreroot/'
    }
    else if (path.startsWith('ocsp/')) {
      str = path.slice(5)
      new_path += '/'
    }
    else if (path.startsWith('ocspx/')) {
      str = path.slice(6)
      new_path += 'x/'
    }

    try {
      var serial = convert_to_serial(str)
      path = new_path + serial
    }
    catch (err) {
      log('err', err)
      log('line', line)
      log('file', file)
    }
  }

  var out = [timestamp, c_ip, method, http_status, bytes, cname, path, '\n'].join(' ')
  child.stdin.write(out)
}

function convert_to_serial(str) {
  var str_hex = Buffer.from(decodeURIComponent(str), 'base64').toString('hex')
  var serial = str_hex.slice(-32).toUpperCase()

  return serial
}


init()