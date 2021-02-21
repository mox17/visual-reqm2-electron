/* class for calculating doctype relationships */
"use strict";

/**
 * @classdesc This class represent what relationships a doctype has
 */
export class DoctypeRelations {
  constructor(name) {
    this.name = name
    this.count = 0               // Number of instances
    this.needsobj = new Map()    // doctype : [id]
    this.fulfilledby = new Map() // doctype : [id]
    this.linksto = new Map()     // doctype : [id]
    this.id_list = []            // [id]
  }

  add_instance(id) {
    this.count++
    this.id_list.push(id)
  }

  add_needsobj(doctype) {
    if (this.needsobj.has(doctype)) {
      let count = this.needsobj.get(doctype)
      this.needsobj.set(doctype, count+1)
    } else {
      this.needsobj.set(doctype, 1)
    }
  }

  add_linksto(doctype, pair) {
    if (this.linksto.has(doctype)) {
      this.linksto.get(doctype).push(pair)
    } else {
      this.linksto.set(doctype, [pair])
    }
  }

  add_fulfilledby(doctype, pair) {
    if (this.fulfilledby.has(doctype)) {
      this.fulfilledby.get(doctype).push(pair)
    } else {
      this.fulfilledby.set(doctype, [pair])
    }
  }

}
