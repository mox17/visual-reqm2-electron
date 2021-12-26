import { vql_validate } from './vql-search.js'
import { search_tooltip } from './reqm2oreqm.js'

/** When true only search ID field */
export let search_language = 'reg' // search language
/** regex for matching requirements */
export let search_pattern = ''
/** initial set of excluded doctypes */
export let excluded_doctypes = []

export function set_excluded_doctypes (ed) {
  excluded_doctypes = ed
}

export function set_search_pattern (patt) {
  search_pattern = patt
}

export function set_search_language (lang) {
  search_language = lang
}

function search_validate(str) {
  switch(search_language) {
    case 'ids':
    case 'reg':
      try {
        // eslint-disable-next-line no-unused-vars
        let _regex_rule = new RegExp(str)
      } catch (err) {
        return err.message
      }
      return null

    case 'vql':
      return vql_validate(str)
  }
  return null
}

/**
 * Check if content of field is OK
 * @param {DOM object} field
 * @returns true if field OK
 */
 export function search_regex_validate(field) {
  let text = field.value
  let validation_error = search_validate(text)
  if (text && validation_error) {
    if (!field.errorbox) {
      const rect = field.getBoundingClientRect();
      const left = rect.left;
      const top = rect.bottom;
      const width = field.clientWidth
      field.errorbox = document.createElement('div');
      field.errorbox.innerHTML = validation_error
      field.errorbox.classList.add('search_terms')
      field.errorbox.setAttribute('style', `background: #f0a0a0;
                                            padding: 6px;
                                            position: absolute;
                                            top: ${top}px;
                                            left: ${left}px;
                                            width: ${width}px;
                                            border: 2px solid #ff0000;
                                            font-family: 'Courier New', monospace;
                                            `);
      field.errorbox.style.fontSize = "75%"
      field.parentNode.appendChild(field.errorbox);
    } else {
      field.errorbox.innerHTML = validation_error;
      field.errorbox.style.display = 'block';
    }
  } else if (field.errorbox) {
    field.errorbox.style.display = 'none';
  }
  return !(text && validation_error)
}

export function set_search_language_hints(lang) {
  let input = document.getElementById('search_regex')
  switch (lang) {
    case 'vql':
      input.placeholder = "VQL search\nrem: or chg: or new: select changes\nAND, OR, NOT and ( ) operators\nand ao() co() selections supported"
      break
    case 'reg':
    case 'ids':
      input.placeholder = "Regex search\nnewlines are ignored\nrem:|chg:|new: select changes"
      break
  }
  document.getElementById('search_tooltip').innerHTML = search_tooltip(lang)
}

/**
 * Update radio-button for language selection as well as search_language variable
 * @param {string} lang 'ids', 'req' or 'vql' from cmd line, settings or context file
 */
 export function set_search_language_buttons (lang) {
  switch (lang) {
    case 'ids':
      document.getElementById('id_checkbox_input').checked = true
      break
    case 'reg':
      document.getElementById('regex_checkbox_input').checked = true
      break
    case 'vql':
      document.getElementById('vql_checkbox_input').checked = true
      break
    }
    set_search_language(lang)
    set_search_language_hints(lang)
  }

/**
 * Get the regular expression from "Selection criteria" box
 * @return {string} regular expression
 */
 export function get_search_regex_clean () {
  const raw_search = document.getElementById('search_regex').value
  let clean_search
  if (search_language === 'vql') {
    clean_search = raw_search
  } else {
    clean_search = raw_search.replace(/\n/g, '') // ignore all newlines in regex
  }
  return clean_search
}

