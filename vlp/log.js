'use strict'

var log = (label, message) => {
  console.log(new Date().toJSON() + ':', label, '-', message)
}

module.exports = log