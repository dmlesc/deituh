var line = line.split(' ')

var time = line[0]
// var time_taken = line[1]
var c_ip = line[2]
// var filesize = line[3]
var s_ip = line[4]
// var s_port = line[5]
var sc_status = line[6]
var bytes = line[7]
var method = line[8]
var cs_uri_stem = line[9]
// var rs_duration = line[11]
// var rs_bytes = line[12]
// var c_referrer = line[13]
var user_agent = line.slice(14, line.length - 3).join(' ').replace(/"/g, '')

var min = Math.round(time / 60) * 60
var minute = min.toString()

var d = new Date(time * 1000)
var timestamp = d.toJSON()

var sc_status_split = sc_status.split('/')
var cache_status = sc_status_split[0]
var http_status = sc_status_split[1]

if (bytes == '-') {
  bytes = 0
}
else {
  bytes = Number(bytes)
}

var cs_uri_stem_split = cs_uri_stem.split('/')
var cname = cs_uri_stem_split[2]

var path = '-'
if (cs_uri_stem_split.slice(3)) {
  path = cs_uri_stem_split.slice(3).join('/')
}


if (http_status.startsWith('5')) {
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
  var method = line[8]
  var path = '-'
  if (cs_uri_stem_split.slice(3)) {
    path = cs_uri_stem_split.slice(3).join('/')
  }

  var message = {}

  /*
  message.cs_uri_stem = cs_uri_stem
  message.time_taken = time_taken
  message.filesize = filesize
  message.sc_status = sc_status
  message.bytes = bytes
  message.rs_duration = rs_duration
  message.rs_bytes = rs_bytes
  message.c_referrer = c_referrer
  */

  message.time = time
  message.c_ip = c_ip
  message.s_ip = s_ip
  message.method = method
  message.user_agent = user_agent
  message.cache_status = cache_status
  message.http_status = http_status
  message.cname = cname
  message.path = path

  var d = new Date(time * 1000)
  var timestamp = d.toJSON()
  message.timestamp = timestamp

  //log(message)
  
  logs.push(message)
}