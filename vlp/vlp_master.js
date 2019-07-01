'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const data_path = process.argv[2]
const workers_total = process.argv[3]
const es_host = process.argv[4]
const canifork_interval = 5000

const { fork } = require('child_process')
const fs = require('fs')
const elasticsearch = require('elasticsearch');

const elastic = new elasticsearch.Client({
  host: es_host
  //, log: 'trace'
});

const index = 'vlp'
var action = {};
action.index = { _index: index, _type: 'doc'};
const howmany = 1000
var bulk = []


const undone_path = data_path + 'undone/'
const done_path = data_path + 'done/'

var interval
var workers_active = 0
var undone_files


function init () {
  undone_files = fs.readdirSync(undone_path)
  log('undone_files', undone_files)
  interval = setInterval(canifork, canifork_interval)
}

function canifork() {
  if (undone_files.length) {
    if (workers_active < workers_total) {
      fork_worker(undone_files.shift())
    }
  }
  else {
    clearInterval(interval)
  } 
}

function fork_worker (file) {
  log('fork_worker', file)
  workers_active++
  log('workers_active', workers_active)

  var undone_file = undone_path + file
   
  const worker = fork('vlp_worker.js', [undone_file])

  worker.on('message', (msg) => { //log('msg', msg)
    parse_msg(msg)
  })
  
  worker.on('close', (code) => { //log('worker_exit_code', code)
    log('finished processing', file)

    // fs.renameSync(undone_file, done_path + file)
    // log('moved to done', file)

    workers_active--
    log('workers_active', workers_active)

    if (!undone_files.length && workers_active == 0) {
      elastic_bulk(bulk);
    }
  })
}

function parse_msg (msg) {
  if (msg.type == 'aggs') {
    var aggs = msg.data

    var minute
    for (minute in aggs) {
      load(aggs[minute])
    }
  }
  else if (msg.type == 'logs') {
    var logs = msg.data

    for (var i=0; i<logs.length; i++) {
      var doc = logs[i]
      load(log)
    }
  }
  else {
    log(msg)
  }
}

function load (doc) {
  // console.log('doc:', doc)

  bulk.push(action)
  bulk.push(doc)

  if (bulk.length >= howmany) {
    elastic_bulk(bulk.splice(0, howmany))
  }
}

function elastic_bulk (docs) {
  elastic.bulk({ body: docs }, (err, res) => {
    if (err) {
      log('elastic.bulk error:', err.stack)
    }
    else { //log('es', res); console.log(res.items[0].index)
      log('inserted', bulk.length/2)
    }
  })
}

init()