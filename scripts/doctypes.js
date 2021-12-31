/* class for calculating doctype relationships */
'use strict'

/**
 * @classdesc This class represent what relationships a doctype has
 */
export class DoctypeRelations {
  constructor (name) {
    this.name = name
    this.count = 0 // Number of instances
    this.needsobj = new Map() // doctype : [id]
    this.fulfilledby = new Map() // doctype : [id]
    this.linksto = new Map() // doctype : [id]
    this.idList = [] // [id]
  }

  addInstance (id) {
    this.count++
    this.idList.push(id)
  }

  addNeedsobj (doctype) {
    if (this.needsobj.has(doctype)) {
      const count = this.needsobj.get(doctype)
      this.needsobj.set(doctype, count + 1)
    } else {
      this.needsobj.set(doctype, 1)
    }
  }

  addLinksto (doctype, pair) {
    if (this.linksto.has(doctype)) {
      this.linksto.get(doctype).push(pair)
    } else {
      this.linksto.set(doctype, [pair])
    }
  }

  addFulfilledby (doctype, pair) {
    if (this.fulfilledby.has(doctype)) {
      this.fulfilledby.get(doctype).push(pair)
    } else {
      this.fulfilledby.set(doctype, [pair])
    }
  }
}
