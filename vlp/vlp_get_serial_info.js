'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const request = require('request')
const fs = require('fs')
const zlib = require('zlib')

const serial_aggs_file = process.argv[2]
var index = Number(process.argv[3] || 0)

var serial_list = []
var serial_info_file = 'serial_info.json.gz'
var serial_info = {}

const saving_interval = 60000
var saving


if (fs.existsSync(serial_info_file)) {
  serial_info = JSON.parse(zlib.gunzipSync(fs.readFileSync(serial_info_file)))
}

function init() {
  var lines = zlib.gunzipSync(fs.readFileSync(serial_aggs_file)).toString().split('\n')

  for (var i=0; i<lines.length; i++) {
    var serial = lines[i].split(' ')[0]
    
    if (serial != 'total' && serial != 'post') {
      serial_list.push(serial)
    }
  }

  more2do()
  saving = setInterval(save_serial_info, saving_interval)
}


function get_crtsh_id(serial) {
  var url = 'https://crt.sh/?serial=' + serial
  
  request(url, (err, res, body) => {
    if (err) { console.log('err:', err) }
    else {
      const id_patt = /href="\?id=\d{1,}/g
      var matches = body.match(id_patt)
      if (matches) {
        get_crtsh_id_info(serial, matches[0].split('=')[2])
      }
      else {
        console.log('\nnot found in crt.sh db:', serial, '\n')

        var info = {
          issuer_cn: 'not found',
          subject_cn: 'not found',
          subject_on: 'not found'
        }

        add_serial_info(serial, info)
        more2do()
      }
    }
  })
}

function get_crtsh_id_info(serial, crtsh_id) {
  var url = 'https://crt.sh/?id=' + crtsh_id
  
  request(url, (err, res, body) => {
    if (err) { console.log('err:', err) }
    else {
      const cert_td = /Certificate:.*<BR>/g
      var cert_info = body.match(cert_td)[0].replace(/(&nbsp;){2}/g, '').split('<BR>')

      var info = {
        issuer_cn: find_name(cert_info, 'Issuer:', 'commonName'),
        subject_cn: find_name(cert_info, 'Subject:', 'commonName'),
        subject_on: find_name(cert_info, 'Subject:', 'organizationName')
      }

      add_serial_info(serial, info)
      more2do()
    }
  })
}

function find_name(cert_info, heading, name) {
  for (var i=0; i<cert_info.length; i++) {
    var str = cert_info[i]
    if (str.includes(heading)) {
      for (i++; i<cert_info.length; i++) {
        str = cert_info[i]
        if (str.includes(name)) {
          var n = str.split('=')[1].replace(/&nbsp;/g, ' ').trim()
          return n
        }
      }
    }
  }
  // console.log(cert_info)

  return 'none'
}

function add_serial_info(serial, info) {
  serial_info[serial] = info
  console.log('added to serial_info:', serial, '\n', info)
}

function save_serial_info () {
  fs.writeFileSync(serial_info_file, zlib.gzipSync(JSON.stringify(serial_info)))
  log('saved serial_list', serial_info_file)
}

function more2do() {
  if (index < serial_list.length) {
    log('serials remaining', serial_list.length - index)

    var serial = serial_list[index++]
    log('index', index)

    if (serial_info[serial]) {
      log('\nalready got da info:', serial)
      more2do()
    }
    else {
      get_crtsh_id(serial)
    }
  }
  else {
    save_serial_info()
    clearInterval(saving)
  }
}

init()