// importScripts("../modules/viz.js/viz.js");
import Viz from 'viz.js'

onmessage = function (e) {
  const result = Viz(e.data.src, e.data.options)
  postMessage(result)
}
