  "use strict";

  import ReqM2Oreqm, { xml_escape } from './diagrams.js'
  import get_color, { save_colors_fs, load_colors_fs } from './color.js'
  import { handle_settings, get_ignored_fields, program_settings, load_safety_rules_fs, open_settings } from './settings.js'
  import Viz from 'viz.js'
  import { ipcRenderer, remote, clipboard, shell, app } from 'electron'
  import { base64StringToBlob, arrayBufferToBlob } from 'blob-util'
  import fs from 'fs'
  import https from 'https'

  let mainWindow = remote.getCurrentWindow();

  // ------ utility functions and extensions --------
  String.prototype.format = function () {
    var i = 0, args = arguments;
    return this.replace(/{}/g, function () {
      return typeof args[i] != 'undefined' ? args[i++] : '';
    });
  };

  // Define trim() operation if not existing
  if (typeof(String.prototype.trim) === "undefined")
  {
      String.prototype.trim = function()
      {
          return String(this).replace(/^\s+|\s+$/g, '');
      };
  }

  // Define remove() operation if not existing
  if (typeof(Array.prototype.remove) === "undefined")
  {
    Array.prototype.remove = function() {
      var what, a = arguments, L = a.length, ax;
      while (L && this.length) {
          what = a[--L];
          while ((ax = this.indexOf(what)) !== -1) {
              this.splice(ax, 1);
          }
      }
      return this;
    };
  }

  // Helper for exporting ReqExp to JSON
  RegExp.prototype.toJSON = function() { return this.source; };

  // ----------------------------------------------------------

  var beforeUnloadMessage = null;

  var resizeEvent = new Event("paneresize");
  Split(['#oreqm_div', '#graph'], {
    sizes: [15, 85],
    onDragEnd: function() {
      var svgOutput = document.getElementById("svg_output");
      if (svgOutput != null) {
        svgOutput.dispatchEvent(resizeEvent);
      }
    }
  });

  // Handlers for menu operations triggered via RPC
  ipcRenderer.on('about', (item, window, key_ev) => {
    show_about()
  });

  ipcRenderer.on('save_colors', (item, window, key_ev) => {
    save_colors_fs()
  });

  ipcRenderer.on('load_colors', (item, window, key_ev) => {
    load_colors_fs(update_doctype_table)
  });

  ipcRenderer.on('load_safety', (item, window, key_ev) => {
    load_safety_rules_fs()
  });

  ipcRenderer.on('save_diagram_as', (item, window, key_ev) => {
    menu_save_as()
  });

  ipcRenderer.on('save_issues_as', (item, window, key_ev) => {
    save_problems()
  });

  ipcRenderer.on('show_issues', (item, window, key_ev) => {
    show_problems()
  });

  ipcRenderer.on('open_settings', (item, window, key_ev) => {
    open_settings()
  });

  /**
   * Main processing triggered mainwin starts here.
   * Command line parameters are received here
   */
  ipcRenderer.on('argv', (event, parameters, args) => {
    let ok = true;
    let main = false;
    let ref = false;

    handle_settings(settings_updated)
    /*
    let c_args = ''
    for (let i = 0; i < parameters.length; i++) {
        c_args += parameters[i] + '  \n'
    }
    alert(c_args)
    */

    if (program_settings.check_for_updates) {
      check_newer_release_available()
    }
    if (args.oreqm_main !== undefined) {
      //console.log(fs.statSync(args.oreqm_main));
      let main_stat = fs.statSync(args.oreqm_main);
      if (main_stat && main_stat.isFile()) {
        //console.log(args.oreqm_main, main_stat);
        main = true;
      } else {
        console.log("Not a file.", args.oreqm_main);
        ok = false;
      }
    }
    if (args.oreqm_ref !== undefined) {
      let ref_stat = fs.statSync(args.oreqm_main);
      if (ref_stat && ref_stat.isFile()) {
        //console.log(args.oreqm_ref, ref_stat);
        ref = true;
      } else {
        console.log("Not a file.", args.oreqm_ref);
        ok = false;
      }
    }
    if (ok && main) {
      load_file_main_fs(args.oreqm_main, ref ? args.oreqm_ref : null);
    }
    cmd_line_parameters(args)
  });

  /**
   * Callback when updated settings a taken into use
   */
  function settings_updated() {
    if (oreqm_main) {
      // settings can affect the rendering, therefore cache must be flushed
      oreqm_main.clear_cache()
    }
  }

  /**
   * Handle command line parameters related to 'batch' execution, i.e. without opening a window
   * @param {*} args the input argument object
   */
  function cmd_line_parameters(args) {
    if (args.select !== undefined) {
      search_pattern = args.select
      document.getElementById('search_regex').value = args.select
    }
    if (args.excluded_ids !== undefined) {
      document.getElementById('excluded_ids').value = args.excluded_ids
    }
    if (args.id_only) {
      document.getElementById('id_checkbox_input').checked = args.id_only
    }
    if (args.excluded_doctypes !== undefined) {
      let excl_dt = args.excluded_doctypes.split(',')
      if (oreqm_main) {
         oreqm_main.set_excluded_doctypes(excl_dt)
      }
    }
  }

  var parser = new DOMParser();
  var vizjs_worker;
  var svg_result;
  var oreqm_main
  var oreqm_ref
  var image_type = 'none'
  var image_mime = ''
  var image_data = ''
  var auto_update = true
  var no_rejects = true   // shall specobjects with status===rejected be displayed?
  var search_pattern = '' // regex for matching requirements
  var excluded_ids = ''   // \n separated list of ids
  var id_checkbox = false // flag for scope of search
  var dot_source = ''
  var panZoom = null
  var latest_version = 'unknown'

  document.getElementById("prog_version").innerHTML = remote.app.getVersion()
  document.getElementById("auto_update").checked = auto_update

  function viz_working_set() {
    document.getElementById("viz_working").innerHTML = '<span style="color: #ff0000">WORKING</span>'
  }

  function viz_loading_set() {
    document.getElementById("viz_working").innerHTML = '<span style="color: #ff0000">LOADING</span>'
  }

  function viz_parsing_set() {
    document.getElementById("viz_working").innerHTML = '<span style="color: #ff0000">PARSING</span>'
  }

  function viz_comparing_set() {
    document.getElementById("viz_working").innerHTML = '<span style="color: #ff0000">COMPARING</span>'
  }

  function viz_working_clear() {
    document.getElementById("viz_working").innerHTML = '<span style="color: #000000"></span>'
  }

  function updateGraph() {
    if (vizjs_worker) {
      vizjs_worker.terminate();
      vizjs_worker = null
    }
    vizjs_worker = new Worker("./lib/worker.js");

    clear_diagram()

    document.querySelector("#output").classList.add("working");
    document.querySelector("#output").classList.remove("error");

    vizjs_worker.onmessage = function(e) {
      document.querySelector("#output").classList.remove("working");
      document.querySelector("#output").classList.remove("error");

      svg_result = e.data;

      viz_working_clear()
      updateOutput();
    }

    vizjs_worker.onerror = function(e) {
      document.querySelector("#output").classList.remove("working");
      document.querySelector("#output").classList.add("error");

      var message = e.message === undefined ? "An error occurred while processing the graph input." : e.message;

      var error = document.querySelector("#error");
      while (error.firstChild) {
        error.removeChild(error.firstChild);
      }

      document.querySelector("#error").appendChild(document.createTextNode(message));

      console.error(e);
      console.log(dot_source)
      viz_working_clear()
      e.preventDefault();
    }

    dot_source = oreqm_main != null ? oreqm_main.get_dot() : "digraph foo {\nfoo -> bar\nfoo -> baz\n}\n"
    var params = {
      src: dot_source,
      options: {
        engine: "dot", //document.querySelector("#engine select").value,
        format: document.querySelector("#format select").value
        , totalMemory: 4 * 16 * 1024 *1024
      }
    };

    // Instead of asking for png-image-element directly, which we can't do in a worker,
    // ask for SVG and convert when updating the output.

    if (params.options.format === "png-image-element") {
      params.options.format = "svg";
    }

    if (document.querySelector("#format select").value === 'dot-source') {
      updateOutput();
    } else {
      vizjs_worker.postMessage(params);
      viz_working_set()
    }
  }

  var svg_element = null

  function clear_diagram() {
    const graph = document.querySelector("#output");

    var svg = graph.querySelector("svg");
    if (svg) {
      graph.removeChild(svg);
    }

    var text = graph.querySelector("#text");
    if (text) {
      graph.removeChild(text);
    }

    var img = graph.querySelector("img");
    if (img) {
      graph.removeChild(img);
    }
  }

  function updateOutput() {
    const graph = document.querySelector("#output");

    var svg = graph.querySelector("svg");
    if (svg) {
      graph.removeChild(svg);
    }

    var text = graph.querySelector("#text");
    if (text) {
      graph.removeChild(text);
    }

    var img = graph.querySelector("img");
    if (img) {
      graph.removeChild(img);
    }

    if (!svg_result) {
      return;
    }

    if (document.querySelector("#format select").value === "svg" && !document.querySelector("#raw input").checked) {
      svg_element = parser.parseFromString(svg_result, "image/svg+xml").documentElement;
      svg_element.id = "svg_output";
      graph.appendChild(svg_element);

      panZoom = svgPanZoom(svg_element, {
        panEnabled: true,
        zoomEnabled: true,
        dblClickZoomEnabled: false,
        controlIconsEnabled: true,
        preventMouseEventsDefault: false,
        fit: true,
        center: true,
        minZoom: 0.02,
        maxZoom: 200,
        zoomScaleSensitivity: 0.3
      });

      svg_element.addEventListener('paneresize', function() {
        panZoom.resize();
      }, false);
      window.addEventListener('resize', function() {
        panZoom.resize();
      });

      /*
      // This time, add the listener to the graph itself
      svg_element.addEventListener('click', event => {
        let str = ""
        if (!event.altKey) { // This test allows Alt-drag to function
          // Grab all the siblings of the element that was actually clicked on
          for (const sibling of event.target.parentElement.children) {
            // Check if they're the title
            if (sibling.nodeName != 'title') continue;
            str = sibling.innerHTML;
            break;
          }
          const ta = document.createElement('textarea');
          ta.value = str;
          ta.setAttribute('readonly', '');
          ta.style = { position: 'absolute', left: '-9999px' };
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      }); */

      svg_element.addEventListener('focus', function() {
        this.addEventListener('keypress', function() {
            //console.log(e.keyCode);
        });
      }, svg_element);

      document.getElementById('graph').onkeyup = function(e) {
        if (e.key == 'n') {
          // alert("N key was pressed");
          next_selected()
        } else if (e.key == 'p') {
          // alert("P key was pressed");
          prev_selected()
        // } else if (e.ctrlKey && e.which == 66) {
        //   alert("Ctrl + B shortcut combination was pressed");
        // } else if (e.ctrlKey && e.altKey && e.which == 89) {
        //   alert("Ctrl + Alt + Y shortcut combination was pressed");
        // } else if (e.ctrlKey && e.altKey && e.shiftKey && e.which == 85) {
        //   alert("Ctrl + Alt + Shift + U shortcut combination was pressed");
        }
        //console.log(e)
      };

      // context menu setup
      var menuNode = document.getElementById('node-menu');
      svg_element.addEventListener('contextmenu', event => {
        let str = ""
        event.preventDefault()
        // Grab all the siblings of the element that was actually clicked on
        for (const sibling of event.target.parentElement.children) {
          // Check if they're the title
          if (sibling.nodeName != 'title') continue;
          str = sibling.innerHTML;
          break;
        }
        selected_node = str
        if ((menuNode.style.display==='')||
            (menuNode.style.display==='none')||
            (menuNode.style.display==='initial')) {
          // show context menu
          let stage = document.getElementById('output');
          var containerRect = stage.getBoundingClientRect();
          menuNode.style.display = 'initial';
          menuNode.style.top = "0"
          menuNode.style.left = "0"
          update_menu_options(selected_node)
          let menu_width = menuNode.clientWidth
          let menu_height = menuNode.clientHeight
          let menu_rel_x = 2
          let menu_rel_y = 2
          if ((event.pageX+menu_width+menu_rel_x+20) >= containerRect.right) {
            menu_rel_x = -menu_rel_x - menu_width
          }
          if ((event.pageY+menu_height+menu_rel_y+28) >= containerRect.bottom) {
            menu_rel_y = -menu_rel_y - menu_height - 16 // compensate height of a row
          }
          menuNode.style.top  = /*containerRect.top  +*/ event.pageY + menu_rel_y + 'px';
          menuNode.style.left = /*containerRect.left +*/ event.pageX + menu_rel_x + 'px';
        } else {
          // Remove on 2nd right-click
          menuNode.style.display = 'none';
        }
      });

      window.addEventListener('click', function(e) {
        // hide context menu
        if (menuNode.style.display !== 'none') {
          menuNode.style.display = 'none';
          e.preventDefault();
        }
      });

      // Setup for download of image
      image_type = 'svg'
      image_mime = 'image/svg+xml'
      image_data = svg_result
    } else if (document.querySelector("#format select").value === "png-image-element") {
      var image = Viz.svgXmlToPngImageElement(svg_result, 1);
      graph.appendChild(image);
      image_type = 'png'
      image_mime = 'image/png'
      image_data = image
    } else if (document.querySelector("#format select").value === "dot-source") {
      var dot_text = document.createElement("div");
      dot_text.id = "text";
      dot_text.appendChild(document.createTextNode(dot_source));
      graph.appendChild(dot_text);
      image_type = 'dot'
      image_mime = 'text/vnd.graphviz'
      image_data = svg_result
    } else {
      var plain_text = document.createElement("div");
      plain_text.id = "text";
      plain_text.appendChild(document.createTextNode(svg_result));
      graph.appendChild(plain_text);
      image_type = 'txt'
      image_mime = 'text/plain'
      image_data = svg_result
    }
  }

  window.addEventListener("beforeunload", function() {
    return beforeUnloadMessage;
  });

  document.getElementById('menu_copy_id').addEventListener("click", function() {
    copy_id_node(false)
  });

  document.getElementById('menu_copy_ffb').addEventListener("click", function() {
    copy_id_node(true)
  });

  function copy_id_node(ffb_format) {
    const ta = document.createElement('textarea');
    if (ffb_format) {
      let rec = oreqm_main.requirements.get(selected_node)
      ta.value = '{}:{}:{}'.format(selected_node, rec.doctype, rec.version)
    } else {
      ta.value = selected_node
    }
    ta.setAttribute('readonly', '');
    ta.style = { position: 'absolute', left: '-9999px' };
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  /*
  document.getElementById('menu_copy_svg').addEventListener("click", function() {
    copy_svg2()
  }); */

  function copy_svg() {
    // Copy svg image to clipboard as <img src="data:image/svg;base64,..." width="" height="" alt="diagram" />
    let clip_txt = '<img src="data:image/svg;base64,{}" width="{}" height="{}" alt="diagram"/>'.format(
      btoa(svg_result), svg_element.getAttribute('width'), svg_element.getAttribute('height'))
    const ta = document.createElement('textarea'); // 'img' ??
    ta.value = clip_txt
    ta.setAttribute('readonly', '');
    ta.style = { position: 'absolute', left: '-9999px' };
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  function copy_svg2() {
    var image_blob = arrayBufferToBlob(svg_result, 'image/svg+xml')
    console.log(image_blob)
    let item = new ClipboardItem({'image/svg+xml': image_blob})
    console.log(item)
    navigator.clipboard.write([item]).then(function() {
      console.log("Copied to clipboard successfully!");
    }, function(error) {
      console.error("unable to write to clipboard. Error:");
      console.log(error);
    })
}

  document.getElementById('menu_copy_png').addEventListener("click", function() {
    copy_png()
  });

  function copy_png() {
    let image = Viz.svgXmlToPngImageElement(svg_result, 1, png_callback);
  }

  function png_callback(ev, png) {
    if (ev === null) {
      var image_blob = base64StringToBlob(png.src.slice(22), 'image/png')
      //console.log(image_blob)
      let item = new ClipboardItem({'image/png': image_blob})
      //console.log(item)
      navigator.clipboard.write([item]).then(function() {
        //console.log("Copied to clipboard successfully!");
      }, function(error) {
        //console.error("unable to write to clipboard. Error:");
        //console.log(error);
      })
    }
  }

  document.getElementById('menu_save_as').addEventListener("click", function() {
    menu_save_as()
  });

  function menu_save_as() {
    const save_options = {
      filters: [
        { name: 'SVG files', extensions: ['svg']},
        { name: 'PNG files', extensions: ['png']},
      ],
      properties: ['openFile']
      }
    let savePath = remote.dialog.showSaveDialogSync(null, save_options)
    if (typeof(savePath) !== 'undefined') {
      if (savePath.endsWith('.svg') || savePath.endsWith('.SVG')) {
        fs.writeFileSync(savePath, svg_result, 'utf8')
      } else if (savePath.endsWith('.png') || savePath.endsWith('.PNG')) {
        Viz.svgXmlToPngImageElement(svg_result, 1, (ev, png) => {
          if (ev === null) {
            const data_b64 = png.src.slice(22)
            const buf = new Buffer.from(data_b64, 'base64');
            fs.writeFileSync(savePath, buf, 'utf8')
          } else {
            console.log("error generating png:", ev)
          }
        });
      } else {
        alert("Unsupported file types in\n"+savePath)
      }
    }
  }

  /*
  document.querySelector("#engine select").addEventListener("change", function() {
      updateGraph();
    }); */

  document.querySelector("#format select").addEventListener("change", function() {
    if (document.querySelector("#format select").value === "svg") {
      document.querySelector("#raw").classList.remove("disabled");
      document.querySelector("#raw input").disabled = false;
    } else {
      document.querySelector("#raw").classList.add("disabled");
      document.querySelector("#raw input").disabled = true;
    }

    updateGraph();
  });

  document.querySelector("#raw input").addEventListener("change", function() {
    updateOutput();
  });

  function update_menu_options(node_id) {
    // get individual context menu options as appropriate
    if (oreqm_main && oreqm_main.check_node_id(node_id)) {
      // a node was right-clicked
      document.getElementById('menu_copy_id').classList.remove('custom-menu_disabled')
      document.getElementById('menu_copy_ffb').classList.remove('custom-menu_disabled')
      document.getElementById('menu_exclude').classList.remove('custom-menu_disabled')
      document.getElementById('menu_xml_txt').classList.remove('custom-menu_disabled')
      document.getElementById('menu_search_txt').classList.remove('custom-menu_disabled')
      if (selected_node_check(node_id)) {
        // it is a selected node
        document.getElementById('menu_select').classList.add('custom-menu_disabled')
        document.getElementById('menu_deselect').classList.remove('custom-menu_disabled')
      } else {
        document.getElementById('menu_select').classList.remove('custom-menu_disabled')
        document.getElementById('menu_deselect').classList.add('custom-menu_disabled')
      }
    } else {
      // click not on nodes
      document.getElementById('menu_select').classList.add('custom-menu_disabled')
      document.getElementById('menu_deselect').classList.add('custom-menu_disabled')
      document.getElementById('menu_exclude').classList.add('custom-menu_disabled')
      document.getElementById('menu_copy_id').classList.add('custom-menu_disabled')
      document.getElementById('menu_copy_ffb').classList.add('custom-menu_disabled')
      document.getElementById('menu_xml_txt').classList.add('custom-menu_disabled')
      document.getElementById('menu_search_txt').classList.add('custom-menu_disabled')
    }
  }

  function set_doctype_count_shown(visible_nodes, selected_nodes) {
    // Update doctype table with counts of nodes actually displayed
    let doctypes = visible_nodes.keys()
    let shown_count = 0
    for (const doctype of doctypes) {
      let shown_cell = document.getElementById("doctype_shown_{}".format(doctype))
      if (shown_cell) {
        shown_cell.innerHTML = visible_nodes.get(doctype).length
        shown_count += visible_nodes.get(doctype).length
      }
    }
    let shown_cell_totals = document.getElementById("doctype_shown_totals")
    if (shown_cell_totals) {
      shown_cell_totals.innerHTML = shown_count
    }
    doctypes = selected_nodes.keys()
    let selected_count = 0
    for (const doctype of doctypes) {
      let selected_cell = document.getElementById("doctype_select_{}".format(doctype))
      if (selected_cell) {
        selected_cell.innerHTML = selected_nodes.get(doctype).length
        selected_count += selected_nodes.get(doctype).length
      }
    }
    let selected_cell_totals = document.getElementById("doctype_select_totals")
    if (selected_cell_totals) {
      selected_cell_totals.innerHTML = selected_count
    }
  }

  function clear_doctypes_table() {
    const element = document.getElementById("dyn_doctype_table");
    if (element) {
      element.parentNode.removeChild(element);
    }
  }

  function display_doctypes_with_count(doctype_dict) {
    let doctype_names = Array.from(doctype_dict.keys())
    doctype_names.sort()
    let excluded = oreqm_main.get_excluded_doctypes() // so we can tick them again
    //console.log(doctype_names)

    const element = document.getElementById("dyn_doctype_table");
    if (element) {
      element.parentNode.removeChild(element);
    }
    let table = document.createElement("table")
    table.id = "dyn_doctype_table"
    let row = table.insertRow();
    let cell
    table.className = 'doctype_table'
    cell = row.insertCell();
    cell.innerHTML = "<b>doctype</b>";
    cell = row.insertCell();
    cell.innerHTML = "<b>count</b>";
    cell = row.insertCell();
    cell.innerHTML = "<b>shown</b>";
    cell = row.insertCell();
    cell.innerHTML = "<b>select</b>";
    cell = row.insertCell();
    cell.innerHTML = '<input type="checkbox" id="doctype_all" title="set all off or on"><b>exclude</b>';
    cell.addEventListener("click", doctype_filter_all_change);
    let doctype_totals = 0
    for (var doctype_name of doctype_names) {
      row = table.insertRow();
      row.style.backgroundColor = get_color(doctype_name)
      cell = row.insertCell();
      cell.innerHTML = doctype_name;

      cell = row.insertCell();
      cell.innerHTML = doctype_dict.get(doctype_name).length;
      doctype_totals += doctype_dict.get(doctype_name).length;

      cell = row.insertCell();
      cell.innerHTML = '<div id="doctype_shown_{}">0</div>'.format(doctype_name)

      cell = row.insertCell();
      cell.innerHTML = '<div id="doctype_select_{}">0</div>'.format(doctype_name)

      cell = row.insertCell();
      let checked = excluded.includes(doctype_name)
      //console.log("dt table", doctype_name, checked)
      cell.innerHTML = '<div><input type="checkbox" id="doctype_{}" {}/></div>'.format(doctype_name, checked ? 'checked' : '')
      cell.addEventListener("click", doctype_filter_change);
      cell = null
    }
    // Totals row
    row = table.insertRow();
    cell = row.insertCell();
    cell.innerHTML = "totals:";

    cell = row.insertCell();
    cell.innerHTML = doctype_totals

    cell = row.insertCell();
    cell.innerHTML = '<div id="doctype_shown_totals">0</div>'

    cell = row.insertCell();
    cell.innerHTML = '<div id="doctype_select_totals">0</div>'

    document.getElementById("doctype_table").appendChild(table);
  }

  function doctype_filter_change() {
    set_doctype_all_checkbox()
    //console.log("doctype_filter_change (click)")
    if (auto_update) {
      filter_graph()
    }
  }

  function doctype_filter_all_change() {
    toggle_exclude()
    if (auto_update) {
      filter_graph()
    }
  }

  document.getElementById('auto_update').addEventListener("click", function() {
    //console.log("auto_update_click")
    auto_update = document.getElementById("auto_update").checked
    if (auto_update) {
      filter_graph()
    }
  });

  document.getElementById('id_checkbox_input').addEventListener("change", function() {
    filter_change()
  });

  document.getElementById('search_regex').addEventListener("change", function() {
    filter_change()
  });

  document.getElementById('excluded_ids').addEventListener("change", function() {
    filter_change()
  });

  function filter_change() {
    //console.log("filter_change")
    if (auto_update) {
      filter_graph()
    }
  }

  function set_auto_update(state) {
    document.getElementById("auto_update").checked = state
    auto_update = state
  }

  function process_data_main(name, data) {
    // Process the loaded data
    viz_parsing_set()
    oreqm_main = new ReqM2Oreqm(name, data, [], [])
    document.getElementById('name').innerHTML = oreqm_main.filename
    document.getElementById('size').innerHTML = (Math.round(data.length/1024))+" KiB"
    document.getElementById('timestamp').innerHTML = oreqm_main.timestamp
    const node_count = oreqm_main.get_node_count()
    if (node_count < 500) {
      set_auto_update(true)
    }
    if (oreqm_ref) { // if we have a reference do a compare
      viz_comparing_set()
      let gr = compare_oreqm(oreqm_main, oreqm_ref)
      set_doctype_count_shown(gr.doctype_dict, gr.selected_dict)
    }
    viz_working_clear()
    display_doctypes_with_count(oreqm_main.get_doctypes())
    if (auto_update) {
      filter_graph()
    } else {
      oreqm_main.set_svg_guide()
      updateGraph()
    }
    document.getElementById('get_ref_oreqm_file').disabled = false
    document.getElementById('clear_ref_oreqm').disabled = false
    set_window_title(name)
  }

  function set_window_title(extra) {
    let title = "Visual ReqM2 - {}".format(extra)
    mainWindow.setTitle(title);
  }

  function load_file_main(file) {
    //console.log("load_file_main", file);
    clear_diagram()
    clear_doctypes_table()
    viz_loading_set()
    // setting up the reader
    let reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = readerEvent => {
      process_data_main(file.path.length ? file.path : file.name, readerEvent.target.result)
    }
  }

  function load_file_main_fs(file, ref_file) {
    //console.log("load_file_main", file);
    clear_diagram()
    clear_doctypes_table()
    viz_loading_set()
    // read file asynchronously
    fs.readFile(file, 'UTF-8', (err, data) => {
      process_data_main(file, data)
      if (ref_file) {
        load_file_ref_fs(ref_file);
      }
    });
  }

  document.getElementById('get_main_oreqm_file').addEventListener("click", function() {
    get_main_oreqm_file()
  });

  function get_main_oreqm_file() {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.oreqm'

    input.onchange = e => {
      // getting a hold of the file reference
      let file = e.target.files[0];
      clear_diagram()
      load_file_main(file)
    }
    input.click();
  }

  function process_data_ref(name, data) {
    // Process the loaded data
    oreqm_main.remove_ghost_requirements(true)
    update_doctype_table()
    viz_parsing_set()
    oreqm_ref = new ReqM2Oreqm(name, data, [], [])
    document.getElementById('ref_name').innerHTML = name
    document.getElementById('ref_size').innerHTML = (Math.round(data.length/1024))+" KiB"
    document.getElementById('ref_timestamp').innerHTML = oreqm_ref.get_time()
    viz_comparing_set()
    let gr = compare_oreqm(oreqm_main, oreqm_ref)
    viz_working_clear();
    set_doctype_count_shown(gr.doctype_dict, gr.selected_dict)
    display_doctypes_with_count(oreqm_main.get_doctypes())
    if (auto_update) {
      filter_graph()
    }
    set_window_title("{} vs. {}".format(oreqm_main.filename, oreqm_ref.filename))
  }

  function load_file_ref(file) {
    // Load reference file
    if (oreqm_main) {
      viz_loading_set();
      let reader = new FileReader();
      reader.readAsText(file, 'UTF-8');
      reader.onload = readerEvent => {
        process_data_ref(file.path.length ? file.path : file.name, readerEvent.target.result)
      }
    } else {
      alert("No main file selected")
    }
  }

  function load_file_ref_fs(file) {
    // Load reference file
    if (oreqm_main) {
      viz_loading_set();
      // read file asynchronously
      fs.readFile(file, 'UTF-8', (err, data) => {
        process_data_ref(file, data)
      });
    } else {
      alert("No main file selected")
    }
  }

  document.getElementById('get_ref_oreqm_file').addEventListener("click", function() {
    get_ref_oreqm_file()
  });

  function get_ref_oreqm_file() {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.oreqm'

    input.onchange = e => {
      // getting a hold of the file reference
      let file = e.target.files[0];
      load_file_ref(file)
    }
    input.click();
  }

  function get_excluded_doctypes() {
    // Get the list of doctypes with checked 'excluded' status
    let excluded_list = []
    if (oreqm_main) {
      const doctypes = oreqm_main.get_doctypes()
      const names = doctypes.keys()
      for (const doctype of names) {
        const cb_name = "doctype_{}".format(doctype)
        const status = document.getElementById(cb_name);
        if (status && status.checked) {
          excluded_list.push(doctype)
        }
        //console.log(doctype, status, status.checked)
      }
    }
    return excluded_list
  }

  function toggle_exclude() {
    if (oreqm_main) {
      const doctypes = oreqm_main.get_doctypes()
      const names = doctypes.keys()
      let ex_list = get_excluded_doctypes()
      const new_state = ex_list.length === 0
      for (const doctype of names) {
        const box = document.getElementById("doctype_{}".format(doctype))
        if (new_state != box.checked) {
          box.checked = new_state
        }
      }
      doctype_filter_change();
    }
  }

  document.getElementById('invert_exclude').addEventListener("click", function() {
    invert_exclude()
  });

  function invert_exclude() {
    // Invert the exclusion status of all doctypes
    if (oreqm_main) {
      const doctypes = oreqm_main.get_doctypes()
      const names = doctypes.keys()
      for (const doctype of names) {
        var box = document.getElementById("doctype_{}".format(doctype));
        box.checked = !box.checked
      }
      doctype_filter_change();
    }
  }

  function set_doctype_all_checkbox() {
    // Set the checkbox to reflect overall status
    const doctypes = oreqm_main.get_doctypes()
    const names = doctypes.keys()
    let ex_list = get_excluded_doctypes()
    const dt_all = document.getElementById("doctype_all");
    if (ex_list.length === 0) {
      dt_all.indeterminate = false
      dt_all.checked = false
    } else if (ex_list.length === Array.from(names).length) {
      dt_all.indeterminate = false
      dt_all.checked = true
    } else {
      dt_all.indeterminate = true
      dt_all.checked = true
    }

  }

  function get_search_regex_clean() {
    let raw_search = document.getElementById("search_regex").value
    let clean_search = raw_search.replace(/\n/g, '') // ignore all newlines in regex
    return clean_search
  }

  document.getElementById('filter_graph').addEventListener("click", function() {
    filter_graph()
  });

  function filter_graph() {
    reset_selection()
    if (oreqm_main) {
      oreqm_main.set_no_rejects(no_rejects)
      handle_pruning()
      // Collect filter criteria and generate .dot data
      id_checkbox = document.querySelector("#id_checkbox input").checked
      search_pattern = get_search_regex_clean()
      //console.log("filter_graph()", search_pattern)
      if (search_pattern) {
        if (id_checkbox) {
          id_search(search_pattern)
        } else {
          txt_search(search_pattern)
        }
        updateGraph();
      } else {
        // no pattern specified
        let title = oreqm_main.construct_graph_title(true, null, oreqm_ref, false, "")
        const graph = oreqm_main.create_graph(
          select_all,
          program_settings.top_doctypes,
          title,
          [],
          program_settings.max_calc_nodes,
          program_settings.show_coverage,
          program_settings.color_status);
        set_doctype_count_shown(graph.doctype_dict, graph.selected_dict)
        updateGraph();
      }
    }
  }

  /**
   * Take exclusion parameters (excluded doctypes and excluded <id>s) from UI and transfer to oreqm object
   */
  function handle_pruning() {
    if (oreqm_main) {
      let ex_id_list = []
      const excluded_ids = document.getElementById("excluded_ids").value.trim()
      if (excluded_ids.length) {
        ex_id_list = excluded_ids.split(/[\n,]+/)
      }
      oreqm_main.set_excluded_ids(ex_id_list)
      let ex_dt_list = get_excluded_doctypes()
      oreqm_main.set_excluded_doctypes(ex_dt_list)
    }
  }

  var selected_nodes = []  // List of id's matching search criteria
  var selected_index = 0   // Currently selected <id>
  var selected_node = null // <id> of currently selected node
  // Manage selection highlight in diagram (extra bright red outline around selected specobject)
  var selected_polygon = null // The svg id of the rectangle around a selected specobject in diagram
  var selected_width = ""  // width as a string
  var selected_color = ""  // color as #RRGGBB string

  function reset_selection() {
    selected_nodes = []
    selected_index = 0
    let nodeSelectEntries = document.getElementById('nodeSelect')
    nodeSelectEntries.innerHTML = ''
  }

  /**
   * Set list of selected <id>'s in combobox above diagram
   * @param {list} selection - list of <id>'s
   */
  function set_selection(selection) {
    selected_nodes = selection
    selected_index = 0
    let nodeSelectEntries = document.getElementById('nodeSelect')
    nodeSelectEntries.innerHTML = '<option>'+selected_nodes.join('</option>\n<option>')+'</option>'
  }

  function selected_node_check(node) {
    return selected_nodes.includes(node)
  }

  function clear_selection_highlight() {
    if (selected_polygon) {
      selected_polygon.setAttribute('stroke-width', selected_width)
      selected_polygon.setAttribute('stroke', selected_color)
      selected_polygon = null
    }
  }

  /**
   * Set highlight in svg around specified node
   * @param {DOMobject} node - SVG object. Naming is 'sel_'+id
   */
  function set_selection_highlight(node) {
    clear_selection_highlight()
    let outline = node.querySelector('.cluster > polygon');
    if (outline) {
      selected_polygon = outline
      selected_width = selected_polygon.getAttribute('stroke-width')
      selected_color = selected_polygon.getAttribute('stroke')
      selected_polygon.setAttribute('stroke-width', "8")
      selected_polygon.setAttribute('stroke', "#FF0000")
    }
  }

  // Combobox handler
  document.getElementById('nodeSelect').addEventListener("change", function() {
    // Select node from drop-down
    clear_selection_highlight()
    center_node(selected_nodes[document.getElementById("nodeSelect").selectedIndex])
  });

  document.getElementById('prev_selected').addEventListener("click", function() {
    prev_selected();
  });

  function prev_selected() {
    // step backwards through nodes and center display
    if (oreqm_main && selected_nodes.length) {
      if (selected_index > selected_nodes.length) selected_index = 0
      selected_index--
      if (selected_index < 0) selected_index = selected_nodes.length - 1
      document.getElementById("nodeSelect").selectedIndex = selected_index;
      center_node(selected_nodes[selected_index])
    }
  }

  document.getElementById('next_selected').addEventListener("click", function() {
    next_selected()
  });

  function next_selected() {
    // step forwards through nodes and center display
    if (oreqm_main && selected_nodes.length) {
      if (selected_index > selected_nodes.length) selected_index = 0
      selected_index++
      if (selected_index >= selected_nodes.length) selected_index = 0
      document.getElementById("nodeSelect").selectedIndex = selected_index;
      center_node(selected_nodes[selected_index])
    }
  }

  /**
   * Search all id strings for a match to regex and create selection list
   * @param {string} regex - regular expression
   */
  function id_search(regex) {
    var results = oreqm_main.find_reqs_with_name(regex)
    oreqm_main.clear_marks()
    oreqm_main.mark_and_flood_up_down(results, COLOR_UP, COLOR_DOWN)
    const graph = oreqm_main.create_graph(select_color,
                                          program_settings.top_doctypes,
                                          oreqm_main.construct_graph_title(true, null, oreqm_ref, id_checkbox, search_pattern),
                                          results,
                                          program_settings.max_calc_nodes,
                                          program_settings.show_coverage,
                                          program_settings.color_status)
    set_doctype_count_shown(graph.doctype_dict, graph.selected_dict)
    set_selection(graph.selected_nodes)
  }

  /**
   * Search combined tagged string for a match to regex and create selection list
   * @param {string} regex - search criteria
   */
  function txt_search(regex) {
    var results = oreqm_main.find_reqs_with_text(regex)
    oreqm_main.clear_marks()
    oreqm_main.mark_and_flood_up_down(results, COLOR_UP, COLOR_DOWN)
    const graph = oreqm_main.create_graph(select_color,
                                          program_settings.top_doctypes,
                                          oreqm_main.construct_graph_title(true, null, oreqm_ref, id_checkbox, search_pattern),
                                          results,
                                          program_settings.max_calc_nodes,
                                          program_settings.show_coverage,
                                          program_settings.color_status)
    set_doctype_count_shown(graph.doctype_dict, graph.selected_dict)
    set_selection(graph.selected_nodes)
  }

  document.getElementById('clear_ref_oreqm').addEventListener("click", function() {
    clear_reference_oreqm()
  });

  function clear_reference_oreqm()
  {
    if (oreqm_ref) {
      oreqm_ref = null
      oreqm_main.remove_ghost_requirements(true)
      update_doctype_table()
      document.getElementById('ref_name').innerHTML = ''
      document.getElementById('ref_size').innerHTML = ''
      document.getElementById('ref_timestamp').innerHTML = ''
      if (auto_update) {
        filter_graph()
      }
    }
    set_window_title(oreqm_main.filename)
  }

  // Setup for the "about" dialog
  var aboutPane = document.getElementById("aboutPane");

  // Get the button that opens the modal
  var aboutButton = document.getElementById("aboutButton");

  // Get the <span> element that closes the modal
  var aboutPaneClose = document.getElementById("aboutPaneClose");

  function show_about() {
    aboutPane.style.display = "block";
  }

  // When the user clicks the button, open the modal
  aboutButton.onclick = function() {
    show_about()
  }

  // When the user clicks on <span> (x), close the modal
  aboutPaneClose.onclick = function() {
    aboutPane.style.display = "none";
  }

  // Setup for the raw node display dialog (raw text and diff (for changed reqs))
  var nodeSource = document.getElementById("nodeSource");

  // Get the <span> element that closes the modal
  var nodeSourceClose = document.getElementById("nodeSourceClose");

   // When the user clicks on <span> (x), close the modal
  nodeSourceClose.onclick = function() {
    nodeSource.style.display = "none";
  }

  // When the user clicks anywhere outside of the modal, close it
  window.onbeforeunload = function() {
    return //"Graph is going away..."
  }

  var problemPopup = document.getElementById("problemPopup");

  // Get the button that opens the modal
  var issuesButton = document.getElementById("issuesButton");

  // When the user clicks the button, open the modal
  issuesButton.onclick = function() {
    show_problems()
  }

  // Setup for the raw node display dialog (raw text and diff (for changed reqs))
  // Get the <span> element that closes the modal
  var problemPopupClose = document.getElementById("problemPopupClose");

  // When the user clicks on <span> (x), close the modal
  problemPopupClose.onclick = function() {
    problemPopup.style.display = "none";
  }

  var settingsPopup = document.getElementById("settingsPopup");

  var settingsPopupClose = document.getElementById("settingsPopupClose");

  // When the user clicks on <span> (x), close the modal
  settingsPopupClose.onclick = function() {
    settingsPopup.style.display = "none";
  }

  // When the user clicks anywhere outside of the modal, close it
  window.onbeforeunload = function() {
    return //"Graph is going away..."
  }

  // When the user clicks anywhere outside one of the modal dialogs, close it
  window.onclick = function(event) {
    if (event.target == aboutPane) {
      aboutPane.style.display = "none";
    } else if (event.target == nodeSource) {
      nodeSource.style.display = "none";
    } else if (event.target == problemPopup) {
      problemPopup.style.display = "none";
    } else if (event.target == settingsPopup) {
      settingsPopup.style.display = "none";
    }
  }

  // Selection/deselection of nodes by right-clicking the diagram
  document.getElementById('menu_select').addEventListener("click", function() {
    // Add node to the selection criteria (if not already selected)
    let node = selected_node
    let node_select_str = "{}$".format(node)
    let search_pattern = document.getElementById("search_regex").value.trim()
    if (oreqm_main && oreqm_main.check_node_id(node)) {
      if (!search_pattern.includes(node_select_str)) {
        if (search_pattern.length) {
          node_select_str = '\n|'+node_select_str
        }
        search_pattern += node_select_str
        //document.querySelector("#id_checkbox input").checked = true
        document.getElementById("search_regex").value = search_pattern
        filter_change()
      }
    }
  });

  document.getElementById('menu_deselect').addEventListener("click", function() {
    // Remove node to the selection criteria (if not already selected)
    let node = selected_node
    let node_select_str = new RegExp("(^|\\|){}\\$".format(node))
    let org_search_pattern = document.getElementById("search_regex").value.trim()
    let search_pattern = org_search_pattern.replace(/\n/g, '')
    let new_search_pattern = search_pattern.replace(node_select_str, '')
    if (new_search_pattern[0] === '|') {
      new_search_pattern = new_search_pattern.slice(1)
    }
    new_search_pattern = new_search_pattern.replace(/\|/g, '\n|')
    if (new_search_pattern !== search_pattern) {
      document.getElementById("search_regex").value = new_search_pattern
      //console.log("deselect_node() - search ", node, search_pattern, new_search_pattern)
      filter_change()
    } else {
      let alert_text = "'{}' is not a selected node\nPerhaps try 'Exclude'?".format(node)
      alert(alert_text)
    }
  });

  document.getElementById('menu_exclude').addEventListener("click", function() {
    // Add node to the exclusion list
    if (oreqm_main && oreqm_main.check_node_id(selected_node)) {
        var excluded_ids = document.getElementById("excluded_ids").value.trim()
      if (excluded_ids.length) {
        excluded_ids += '\n' + selected_node
      } else {
        excluded_ids = selected_node
      }
      document.getElementById("excluded_ids").value = excluded_ids
      filter_change()
    }
  });

  document.getElementById('clear_search_regex').addEventListener("click", function() {
    clear_search_regex()
  });

 function clear_search_regex() {
    document.getElementById("search_regex").value = ""
    filter_change()
  }

  document.getElementById('clear_excluded_ids').addEventListener("click", function() {
    clear_excluded_ids()
  });

  function clear_excluded_ids() {
    document.getElementById("excluded_ids").value = ""
    filter_change()
  }

  /**
   * Center svg diagram around the selected specobject
   * @param {string} node_name
   */
  function center_node(node_name) {
    let found = false
    // Get translation applied to svg coordinates by Graphviz
    let graph0 = document.querySelectorAll('.graph')[0]
    let trans_x = graph0.transform.baseVal[2].matrix.e
    let trans_y = graph0.transform.baseVal[2].matrix.f
    // Grab all the siblings of the element that was actually clicked on
    let titles = document.querySelectorAll('.node > title');
    let bb
    let node
    for (node of titles ) {
      if (node.innerHTML === node_name) {
        found = true
        bb = node.parentNode.getBBox()
        break;
      }
    }
    if (found) {
      set_selection_highlight(document.getElementById('sel_{}'.format(node_name)))
      let output = document.getElementById("output");
      let sizes = panZoom.getSizes()
      let rz = sizes.realZoom;
      let window_width = output.clientWidth/rz
      let window_height = output.clientHeight/rz
      let req_center_x = bb.x + bb.width * 0.5
      let req_center_y = bb.y

      let centerpos_x = sizes.viewBox.width * 0.5
      let centerpos_y = sizes.viewBox.height * 0.3
      if (window_width > sizes.viewBox.width) {
        centerpos_x += (window_width-sizes.viewBox.width) * 0.5
      }
      if (window_width < sizes.viewBox.width) {
        centerpos_x -= (sizes.viewBox.width-window_width) * 0.5
      }
      if (window_height > sizes.viewBox.height) {
        req_center_y -= (window_height-sizes.viewBox.height) * 0.3
      }
      if (window_height < sizes.viewBox.height) {
        centerpos_y -= (sizes.viewBox.height-window_height) * 0.3
      }
      // console.log(centerpos_x, centerpos_y)
      let pan_vector_x = (centerpos_x - req_center_x - trans_x)*rz
      let pan_vector_y = (centerpos_y - req_center_y - trans_y)*rz
      // console.log(pan_vector_x, pan_vector_y)
      panZoom.pan({x: pan_vector_x, y: pan_vector_y});
    }
  }

  // drop file handling
  const drop_area_main = document.getElementById('drop_area_main');
  const drop_area_ref = document.getElementById('drop_area_ref');

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    drop_area_main.addEventListener(eventName, preventDefaults, false)
    drop_area_ref.addEventListener(eventName, preventDefaults, false)
    document.body.addEventListener(eventName, preventDefaults, false)
  })

  // Highlight drop area when item is dragged over it
  ;['dragenter', 'dragover'].forEach(eventName => {
    drop_area_main.addEventListener(eventName, highlight_main, false)
    drop_area_ref.addEventListener(eventName, highlight_ref, false)
  })

  ;['dragleave', 'drop'].forEach(eventName => {
    drop_area_main.addEventListener(eventName, unhighlight_main, false)
    drop_area_ref.addEventListener(eventName, unhighlight_ref, false)
  })

  drop_area_main.addEventListener('drop', (event) => {
    event.stopPropagation();
    event.preventDefault();
    //console.log(event.dataTransfer.files);
    process_dropped_file(event, true)
  });

  drop_area_ref.addEventListener('drop', (event) => {
    event.stopPropagation();
    event.preventDefault();
    //console.log(event.dataTransfer.files);
    process_dropped_file(event, false)
  });

  function preventDefaults (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  function highlight_main() {
    drop_area_main.classList.add('highlight')
  }

  function highlight_ref() {
    if (oreqm_main) {
      drop_area_ref.classList.add('highlight')
    }
  }

  function unhighlight_main() {
    drop_area_main.classList.remove('highlight')
  }

  function unhighlight_ref() {
    drop_area_ref.classList.remove('highlight')
  }

  // Main oreqm file
  drop_area_main.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    // Style the drag-and-drop as a "copy file" operation.
    event.dataTransfer.dropEffect = 'copy';
  });

  // Reference oreqm file
  drop_area_ref.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    // Style the drag-and-drop as a "copy file" operation.
    if (oreqm_main) {
      event.dataTransfer.dropEffect = 'copy';
    } else {
      event.dataTransfer.dropEffect = 'none';
    }
  });

  document.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'none';
  });

  function process_dropped_file(ev, main_file) {
    // Process dropped file, if there is just one file
    let dropped_file
    let count = 0
    let i = 0
    if (ev.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      for (i = 0; i < ev.dataTransfer.items.length; i++) {
        // If dropped items aren't files, reject them
        if (ev.dataTransfer.items[i].kind === 'file') {
          count++
          var file = ev.dataTransfer.items[i].getAsFile();
          //console.log('... file[' + i + '].name = ' + file.name);
          dropped_file = file
        }
      }
    } else {
      // Use DataTransfer interface to access the file(s)
      for (i = 0; i < ev.dataTransfer.files.length; i++) {
        //console.log('... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
        dropped_file = ev.dataTransfer.files[i]
        count++
      }
    }
    if (count === 1) {
      if (main_file) {
        load_file_main(dropped_file)
      } else {
        load_file_ref(dropped_file)
      }
    }
  }

  // Hierarchy button handler
  document.getElementById('show_doctypes').addEventListener("click", function() {
    show_doctypes()
  });

  function show_doctypes() {
    // Show the graph of doctype relationships
    if (oreqm_main) {
      oreqm_main.scan_doctypes(false)
      updateGraph();
    }
  }

  // Safety button handler
  document.getElementById('show_doctypes_safety').addEventListener("click", function() {
    show_doctypes_safety()
  });

  function show_doctypes_safety() {
    // Show the graph of doctype relationships
    if (oreqm_main) {
      oreqm_main.scan_doctypes(true)
      updateGraph();
    }
  }

  /**
   * Add git style '+', '-' in front of changed lines.
   * The part can be multi-line and is expected to end with a newline
   * @param {object} part - diff object
   * @return {string} - updated string
   */
  function src_add_plus_minus(part) {
    let insert = part.added ? '+' : part.removed ? '-' : ' '
    let txt = part.value
    let last_char = txt.slice(-1)
    txt = txt.slice(0, -1)
    txt = insert + txt.split(/\n/gm).join('\n'+insert)
    return txt + last_char
  }

  document.getElementById('menu_xml_txt').addEventListener("click", function() {
    show_source()
  });

  /**
   * Show selected node as XML
   */
  function show_source() {
    if (selected_node.length) {
      var ref = document.getElementById('req_src');
      if (oreqm_ref && oreqm_main.updated_reqs.includes(selected_node)) {
        // create a diff
        let text_ref = xml_escape(oreqm_ref.get_node_text_formatted(selected_node))
        let text_main = xml_escape(oreqm_main.get_node_text_formatted(selected_node))
        let result = '<h2>XML format (changed specobject)</h2><pre>'
        let diff = Diff.diffLines(text_ref, text_main)
        diff.forEach(function(part){
          // green for additions, red for deletions, black for common parts
          let color = part.added ? 'green' : part.removed ? 'red' : 'grey';
          let font = 'normal'
          if (part.added || part.removed) {
            font = 'bold'
          }
          result += '<span style="color: {}; font-weight: {};">{}</span>'.format(color, font, src_add_plus_minus(part))
        });
        result += '</pre>'
        ref.innerHTML = result
      } else {
        let header_main = "<h2>XML format</h2>"
        if (oreqm_main.removed_reqs.includes(selected_node)) {
          header_main = "<h2>XML format (removed specobject)</h2>"
        } else if (oreqm_main.new_reqs.includes(selected_node)) {
          header_main = "<h2>XML format (new specobject)</h2>"
        }
        ref.innerHTML = '{}<pre>{}</pre>'.format(header_main, xml_escape(oreqm_main.get_node_text_formatted(selected_node)))
      }
      nodeSource.style.display = "block";
    }
  }

  /**
   * Context menu handler to show internal tagged search format
   */
  document.getElementById('menu_search_txt').addEventListener("click", function() {
    show_internal()
  });

  function show_internal() {
    // Show selected node as internal tagged string
    if (selected_node.length) {
    var ref = document.getElementById('req_src');
      let header_main = "<h2>Internal tagged 'search' format</h2>"
      let a_txt = oreqm_main.get_all_text(selected_node).replace(/\n/g, '\u21B5\n')
      ref.innerHTML = '{}<pre>{}</pre>'.format(header_main, xml_escape(a_txt))
      nodeSource.style.display = "block";
    }
  }

  function show_problems() {
    // Show problems colleced in oreqm_main
    var ref = document.getElementById('problem_list');
    let header_main = `\
<h2>Detected problems</h2>
`
    let problem_txt = 'Nothing to see here...'
    if (oreqm_main) {
      problem_txt =  xml_escape(oreqm_main.get_problems())
    }
    ref.innerHTML = '{}<pre>{}</pre>'.format(header_main, problem_txt)
    problemPopup.style.display = "block";
  }

  document.getElementById('save_problems').addEventListener("click", function() {
    save_problems()
  });

  function save_problems() {
    let problems = oreqm_main.get_problems()
    if (problems.length > 0) {
      let SavePath = remote.dialog.showSaveDialogSync(null,
        {
          filters: [{ name: 'TXT files', extensions: ['txt']}],
          properties: ['openFile']
        })
      if (typeof(SavePath) !== 'undefined') {
        fs.writeFileSync(SavePath, problems, 'utf8')
      }
    } else {
      alert("There are no issues")
    }
  }

  document.getElementById('clear_problems').addEventListener("click", function() {
    clear_problems()
  });

  function clear_problems() {
    if (oreqm_main) {
      oreqm_main.clear_problems()
      show_problems()
    }
  }

  /**
   * Update doctype table. Colors associated with doctypes may have changed, therefore cached
   * visualization data is cleared.
   */
  function update_doctype_table() {
    if (oreqm_main) {
      oreqm_main.clear_cache()
      display_doctypes_with_count(oreqm_main.doctypes)
      if (auto_update) {
        filter_graph()
      }
    }
  }

  /**
   * Handle display (or not) of rejected specobjects
   */
  document.getElementById('no_rejects').addEventListener("click", function() {
    no_rejects_click()
  });

  function no_rejects_click() {
    no_rejects = document.getElementById("no_rejects").checked
    if (auto_update) {
      filter_graph()
    }
  }

  /**
   * Compare two oreqm files, each represented as objects.
   * The main object will have visualization elements added and default diff related search terms are added.
   * @param {object} oreqm_main
   * @param {object} oreqm_ref
   * @return {object} diff graph
   */
  function compare_oreqm(oreqm_main, oreqm_ref) {
    // Both main and reference oreqm have been read.
    // Highlight new, changed and removed nodes in main oreqm (removed are added as 'ghosts')
    let results = oreqm_main.compare_requirements(oreqm_ref, get_ignored_fields())
    let new_search_array = []
    let raw_search = document.getElementById("search_regex").value.trim()
    // This is a hack, these prefixes are a hidden part of 'delta' reqs <id>, and a search term is constructed to find them
    // Also avoid adding them more than once.
    if (!raw_search.includes('new:')) new_search_array.push('new:')
    if (!raw_search.includes('chg:')) new_search_array.push('chg:')
    if (!raw_search.includes('rem:')) new_search_array.push('rem:')
    let new_search = new_search_array.join('|')
    if (new_search.length && raw_search) {
      raw_search = new_search + '|\n' + raw_search
    } else if (new_search.length) {
      raw_search = new_search
    }
    document.getElementById("search_regex").value = raw_search
    //console.log(results)
    const graph = oreqm_main.create_graph(select_color,
                                          program_settings.top_doctypes,
                                          oreqm_main.construct_graph_title(true, null, oreqm_ref, id_checkbox, search_pattern),
                                          [],
                                          program_settings.max_calc_nodes,
                                          program_settings.show_coverage,
                                          program_settings.color_status)
    return graph
  }

  // some ways to select a subset of specobjects
  // eslint-disable-next-line no-unused-vars
  function select_all(_node_id, rec, _node_color) {
    // Select all - no need to inspect input
    if (no_rejects) {
      return rec.status !== 'rejected'
    }
    return true
  }

  /**
   * Values for tagging nodes visited while traversing UP and DOWN the graph of specobjects
   */
  const COLOR_UP = 1
  const COLOR_DOWN = 2

  function select_color(node_id, rec, node_color) {
    // Select colored nodes
    return node_color.has(COLOR_UP) || node_color.has(COLOR_DOWN)
  }

  /* auto-update logic */

  const notification = document.getElementById('notification');
  const auto_update_message = document.getElementById('auto-update-message');
  const restartButton = document.getElementById('restart-button');

  ipcRenderer.on('update_available', () => {
    ipcRenderer.removeAllListeners('update_available');
    auto_update_message.innerText = 'A new update is available. Downloading now...';
    notification.classList.remove('hidden');
  });

  ipcRenderer.on('update_downloaded', () => {
    ipcRenderer.removeAllListeners('update_downloaded');
    auto_update_message.innerText = 'Update Downloaded. It will be installed on restart. Restart now?';
    restartButton.classList.remove('hidden');
    notification.classList.remove('hidden');
  });

  function closeNotification() {
    notification.classList.add('hidden');
  }
  function restartApp() {
    ipcRenderer.send('restart_app');
  }

  document.getElementById('close-button').addEventListener("click", function() {
    closeNotification()
  });

  document.getElementById('restart-button').addEventListener("click", function() {
    restartApp()
  });

  // Open https:// urls in external browser
  if (document.readyState != "complete") {
    document.addEventListener('DOMContentLoaded', function() {
      prepareTags()
    }, false);
  } else {
    prepareTags();
  }

  function url_click_handler(e, url) {
    e.preventDefault()
    document.shell_openExternal(url)
  }

  /**
   * Make URLs clickable
   */
  function prepareTags() {
    document.url_click_handler = url_click_handler
    document.shell_openExternal = shell.openExternal
    let aTags = document.getElementsByTagName("a");
    for (var i = 0; i < aTags.length; i++) {
      //console.log(aTags[i])
      //aTags[i].setAttribute("onclick", "require('shell').openExternal('" + aTags[i].href + "')");
      aTags[i].setAttribute("onclick", "document.url_click_handler(event, '" + aTags[i].href + "')");
      aTags[i].href = "#";
    }
    return false;
  }

  /**
   * Get latest release tag from github and check against this version.
   * Update 'About' dialog with release version and set button green.
   */
  function check_newer_release_available() {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/repos/mox17/visual-reqm2-electron/releases/latest',
      headers: {
        'Accept': "application/vnd.github.v3+json",
        'User-Agent': 'com.mox17.visualreqm2'
     }
    }

    https.get(options, (resp) => {
      let data = '';

      resp.on('data', (chunk) => {
        data += chunk;
      });

      resp.on('end', () => {
        let latest_rel = JSON.parse(data)
        //console.log(latest_rel.explanation);
        latest_version = latest_rel.name
        //console.log(latest_version);
        if (latest_version !== remote.app.getVersion()) {
          aboutButton.style.background = '#00FF00'
        }
        document.getElementById('latest_release').innerHTML = ` available for download is ${latest_version}`
      })
    }).on("error", (err) => {
      console.log("Error: " + err.message);
    })
  }

  // process.on('uncaughtException', function (err) {
  //   console.log("uncaughtException:", err);
  // })
