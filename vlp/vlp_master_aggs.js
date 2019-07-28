'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const data_path = process.argv[2]
const workers_total = process.argv[3]
const decompress_method = process.argv[4]
const es_host = process.argv[5]
const es_index = process.argv[6]
const aggs_field = process.argv[7]
const howmany = 20000
const forking_interval = 5000
const flushing_interval = 5000

const { fork } = require('child_process')
const fs = require('fs')
const elasticsearch = require('elasticsearch')

const elastic = new elasticsearch.Client({
  host: es_host
  //, log: 'trace'
})

var action = {}
action.index = { _index: es_index }
action = JSON.stringify(action)
var bulk_queue = []
var loading = false


const undone_path = data_path + 'undone/'
const done_path = data_path + 'done/'
const worker_path = 'vlp_worker_aggs.js'

var forking
var flushing
var workers_active = 0
var undone_files


function init () {
  undone_files = fs.readdirSync(undone_path)
  log('undone_files', undone_files)
  forking = setInterval(canifork, forking_interval)
  flushing = setInterval(caniflush, flushing_interval)
}

function canifork() {
  if (undone_files.length) {
    if (workers_active < workers_total) {
      fork_worker(undone_files.shift())
    }
  }
  else {
    clearInterval(forking)
  } 
}

function caniflush() {
  if (!loading && bulk_queue.length) {
    loading = true
    elastic_bulk(bulk_queue.splice(0, howmany))
  }
}

function fork_worker (file) {
  log('fork_worker', file)
  workers_active++
  log('workers_active', workers_active)

  var undone_file = undone_path + file
   
  const worker = fork(worker_path, [undone_file, decompress_method, aggs_field])

  worker.on('message', (msg) => {
    process_msg(msg)
  })
  
  worker.on('close', (code) => {
    log('finished processing', file)

    // fs.renameSync(undone_file, done_path + file)
    // log('moved to done', file)

    workers_active--
    log('workers_active', workers_active)

    if (!undone_files.length && workers_active == 0) {
      caniflush()
      clearInterval(flushing)
    }
  })
}

function process_msg (msg) {
  if (msg.type == 'aggs') {
    var aggs = msg.data

    var minute
    for (minute in aggs) {
      load(aggs[minute])
    }
  }
  else {
    log(msg)
  }
}

function load (doc) {
  // console.log('doc:', doc)

  bulk_queue.push(action)
  bulk_queue.push(JSON.stringify(doc))
}

function elastic_bulk (docs) {
  var params = {
    index: es_index, 
    body: docs.join('\n')
  }

  elastic.bulk(params, (err, res) => {
    if (err) {
      log('elastic.bulk error:', err.stack)
    }
    else {
      if (res.errors) {
        log('res', res)
        log('items[0]', res.items[0].index)
      }

      log('inserted', docs.length/2)

      if (bulk_queue.length) {
        elastic_bulk(bulk_queue.splice(0, howmany))
      }
      else {
        loading = false
      }
    }
  })
}

init()