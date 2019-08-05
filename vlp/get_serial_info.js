'use strict'

const csv_parse = require('csv-parse/lib/sync')
const csv_stringify = require('csv-stringify/lib/sync')
const request = require('request')
const fs = require('fs')
const zlib = require('zlib')

const top_urls_csv_file = process.argv[2]
const output_csv_file = process.argv[3]

const new_columns = 'URL,Hits,Percentage,Ave Bytes Out,Total Bytes Out,Ave Bytes In,Total Bytes In,Ave Bytes Remote,Total Bytes Remote,Transfer Rate,Duration'
var lines = fs.readFileSync(top_urls_csv_file).toString().split('\n');
lines[0] = new_columns;

const top_url_metrics = csv_parse(lines.join('\n'), {
  columns: true,
  skip_empty_lines: true
})

var serial_skel = {
  total_hits: 0,
  total_bytes_out: 0,
  issuer_cn: '',
  subject_cn: '',
  subject_on: ''
}

var serial_metrics = {}
var serial_list = []
var serial_info_file = 'serial_info.json.gz'
var serial_info = {}

if (fs.existsSync(serial_info_file)) {
  serial_info = JSON.parse(zlib.gunzipSync(fs.readFileSync(serial_info_file)))
}

function extract_oscp_gets(url_metrics) {
  for (var i=0; i<url_metrics.length; i++) {
    var metrics = url_metrics[i]
    var url = metrics.URL

    if (url.includes('ocsp/') && !url.includes('.crt') && url.length > 13) {
      var path

      if (url.includes('baltimoreroot')) {
        path = url.slice(27)
      }
      else {
        path = url.slice(13)
      }

      var serial = convert_path_to_serial(path)

      if (!serial_metrics[serial]) {
        serial_metrics[serial] = JSON.parse(JSON.stringify(serial_skel))
        serial_list.push(serial)
      }

      serial_metrics[serial].paths.push(path)
      serial_metrics[serial].hits.push(metrics.Hits)
      serial_metrics[serial].bytes_out.push(metrics['Total Bytes Out'])
      serial_metrics[serial].percentage.push(metrics.Percentage)
    }
  }

  make_sumations()
}

function convert_path_to_serial(path) {
  var path_base64 = decodeURIComponent(path)
  var path_hex = Buffer.from(path_base64, 'base64').toString('hex')
  var serial = path_hex.slice(-32).toUpperCase()
  // console.log('serial:', serial)

  return serial
}

function make_sumations() {
  var serial

  for (serial in serial_metrics) {
    var metrics = serial_metrics[serial]

    var total_hits = 0
    for (var i=0; i<metrics.hits.length; i++) {
      total_hits += Number(metrics.hits[i])
    }

    var total_bytes_out = 0
    for (var i=0; i<metrics.bytes_out.length; i++) {
      var bytes_out = metrics.bytes_out[i].split(' ')
      if (bytes_out[1] == 'GB') {
        total_bytes_out += Number(bytes_out[0]) * 1e9
      }
      else if (bytes_out[1] == 'MB') {
        total_bytes_out += Number(bytes_out[0]) * 1e6
      }
    }

    var total_percentage = 0;
    for (var i=0; i<metrics.percentage.length; i++) {
      total_percentage += Number(metrics.percentage[i].split(' ')[0])
    }

    metrics.total_hits = total_hits
    metrics.total_bytes_out = total_bytes_out
    metrics.total_percentage = total_percentage
  }

  more2do()
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
        add_serial_info_to_metrics(serial, serial_info[serial])
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
      add_serial_info_to_metrics(serial, serial_info[serial])
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

function add_serial_info_to_metrics(serial, info) {
  var metrics = serial_metrics[serial]
  metrics.issuer_cn = info.issuer_cn
  metrics.subject_cn = info.subject_cn
  metrics.subject_on = info.subject_on
}

function more2do() {
  if (serial_list.length) {
    console.log('serials remaining:', serial_list.length)

    var serial = serial_list.shift()
    if (serial_info[serial]) {
      console.log('\nalready got da info:', serial)
      add_serial_info_to_metrics(serial, serial_info[serial])
      more2do()
    }
    else {
      get_crtsh_id(serial)
    }
  }
  else {
    fs.writeFileSync(serial_info_file, zlib.gzipSync(JSON.stringify(serial_info)))
    console.log('saved serial_list:', serial_info_file)
    // console.log(serial_metrics)

    output_csv()
  }
}

function output_csv() {
  var serial_records = []
  var columns = ['serial', 'total_hits', 'total_bytes_out', 'total_percentage', 'issuer_cn', 'subject_cn', 'subject_on']
  serial_records.push(columns)

  var serial

  for (serial in serial_metrics) {
    var metrics = serial_metrics[serial]
    var row = [serial];

    for (var i=1; i<columns.length; i++) {
      row.push(metrics[columns[i]])
    }
    serial_records.push(row)
  }
  
  fs.writeFileSync(output_csv_file, csv_stringify(serial_records))
  console.log('saved output_csv_file:', output_csv_file)

  console.log('\ndone')
}


extract_oscp_gets(top_url_metrics)