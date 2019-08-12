'use strict'
process.on('uncaught', (err) => { console.log('\nuncaught:\n', err.stack) })
const log = require('./log')

const workers_total = process.argv[2]
const data_path = process.argv[3]
const serial_aggs_path = process.argv[4]

const forking_interval = 5000

const fs = require('fs')
const { fork } = require('child_process')

const undone_path = data_path + 'undone/'
const done_path = data_path + 'done/'
const worker_path = 'vlp_serial_aggs_worker.js'

var forking
var workers_active = 0
var undone_files


function init () {
  undone_files = fs.readdirSync(undone_path)
  log('undone_files', undone_files)
  forking = setInterval(canifork, forking_interval)
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

function fork_worker (file) {
  log('fork_worker', file)
  workers_active++
  log('workers_active', workers_active)

  var undone_file = undone_path + file
   
  const worker = fork(worker_path, [undone_file, serial_aggs_path])

  worker.on('message', (msg) => {
    process_msg(msg)
  })
  
  worker.on('close', (code) => {
    log('finished processing', file)

    fs.renameSync(undone_file, done_path + file)
    log('moved to done', file)

    workers_active--
    log('workers_active', workers_active)
  })
}

function process_msg (msg) {
  log(msg)
}


init()